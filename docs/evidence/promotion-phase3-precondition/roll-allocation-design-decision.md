# Phase 3.1 — Roll Allocation Design Decision (ADR, Design Review Only)

**Status:** DESIGN REVIEW ONLY — no implementation performed, no code modified.
**Date:** 2026-08-05
**Scope:** Select the concurrency-safe roll-allocation architecture for the promotion engine, before any code changes.
**Author role:** Lead Backend Architect.

---

## 0. Established project context (cited, not re-derived)

- Promotion failures are dominated by roll-allocation contention — 88–94% of the FULL run's 241 failures; reproduced at 17–19% on a healthy, isolated environment (evidence: `failure-breakdown.md §4, §5`).
- Scheduler overhead is minor, not a failure source — +5.7% wall, statistically equivalent failure rates direct vs scheduled (evidence: `runtime-regression-analysis.md §3-B`).
- PromotionJob architecture is accepted; per-student atomicity, per-mutation audit, and tenant isolation are frozen (evidence: `DECISIONS.md`; `implementation-summary.md §2`).
- Background jobs are accepted and unaffected by this decision (evidence: `implementation-summary.md §3`).

---

## 1. Scope and constraints (DO NOT)

Do NOT modify code. Do NOT implement any solution. Do NOT benchmark. Do NOT optimize queries. Do NOT change schema. Do NOT touch PromotionJob. Do NOT touch PRESERVE_SECTION. Produce design only.

## 2. Decision constraints (frozen invariants the chosen design MUST preserve)

The chosen option MUST NOT:

- Change promotion business rules.
- Change section assignment strategy (PRESERVE_SECTION is a separate phase).
- Change tenant isolation.
- Reduce audit granularity (one promote audit event per promoted student).
- Replace per-student atomicity unless a separate ADR is approved.
- Introduce breaking schema changes (additive, non-breaking changes remain permissible).
- Require rewriting PromotionJob.
- Require rewriting PromotionJobBatch.

If an option requires violating any frozen invariant, mark that criterion **FAIL** and explain why.

Do not invent Option D or combine multiple options unless explicitly requested in a future ADR.

---

## 3. Evidence traceability rule

For every claim below:

- Evidence-supported claims are cited by artifact (e.g. `failure-breakdown.md §4`, `runtime-regression-analysis.md §3`, `DECISIONS.md #18`).
- Claims without an artifact are labeled **Architectural Judgment — Not Evidence Derived**.
- Evidence and judgment are never blended in the same sentence without distinguishing which part is which.

Artifacts cited: `failure-breakdown.md`, `runtime-regression-analysis.md`, `remaining-students-verification.md`, `phase3-readiness.md`, `DECISIONS.md #18`, `implementation-summary.md`, `promotion-service.ts`, `schema.prisma`, `prisma/seed.ts`, `StudentProfile.tsx`, `sections/[id]/page.tsx`, `api/students` routes, `enrollment-relation-naming.md`.

---

## 4. Design options

### OPTION A — Serialize Per Section

Section-level lock/serialization before roll allocation. Smallest code change; keeps the existing per-student transaction shape.

Design in detail: acquire a section-scoped mutual-exclusion token (PostgreSQL advisory lock keyed by `(school_id, class_id, section_id)` — no schema change — or a per-section lock row `SELECT … FOR UPDATE` if the advisory-key hashing is deemed too opaque) at the top of the per-student target write, release on commit/abort. Applies to **both** write paths that insert a roll into a target section: the happy path (`promotion-service.ts:483, 601`) and the collision-retry path (`retryWithFreeRoll`, `promotion-service.ts:731-751`).

### OPTION B — Atomic Allocation

Advisory lock / sequence / `INSERT...RETURNING` / atomic counter per section. Allocation becomes atomic; lock held briefly; roll still assigned during promotion.

Design in detail: a per-section counter row (new additive table, e.g. `roll_counters(school_id, class_id, section_id, next_roll)` PK on the section triple) whose increment is atomic (`UPDATE … SET next_roll = next_roll + 1 … RETURNING next_roll`) executed inside the promotion transaction. The unique partial index (`schema.prisma:938`) remains as a backstop. Requires backfilling counters for all existing sections.

### OPTION C — Deterministic Post-Promotion

Promote students (commit) → collect promoted students → sort → assign rolls (separate commit). Roll allocation removed from the promotion write path entirely.

Design in detail: phase 1 promotes every student with `rollNumber: null` in the unchanged per-student transaction (close source + create target + audit — `promotion-service.ts:607-623`). Phase 2, still inside `runPromotionBatch` (so PromotionJob/JobBatch are untouched), collects the batch's promoted students, sorts them by a stable key, and assigns rolls in a single-writer transaction (per section), skipping rows that already have a roll (idempotent). The partial unique index (`schema.prisma:938`) enforces uniqueness of the assigned values; a unique violation during phase 2 is handled as "next free value".

---

## 5. Option C — required intermediate-state sub-evaluation

Independent of the generic correctness question, because C is the only option whose roll assignment commits after the promotion:

1. **State of `rollNumber` between the promotion commit and the roll-assignment commit: NULL.** Not a placeholder — any non-null placeholder value would collide in the partial unique index (`schema.prisma:938`). NULL is schema-legal: `rollNumber` is a nullable column (evidence: `promotion-service.ts:100` `rollNumber: string | null`), the index exempts NULL rows by construction (`WHERE roll_number IS NOT NULL`), and the students API writes NULL rolls on admission today (`api/students/route.ts:117`, `api/students/[id]/route.ts:104`).

2. **Can existing modules observe this intermediate state? Yes — display modules, all gracefully:**
   - Class/section roster page renders `rollNumber || "—"` (`sections/[id]/page.tsx:166`); the section API orders by `rollNumber asc` (NULLS LAST) (`api/sections/[id]/route.ts:32`).
   - Student Profile renders `active.rollNumber || "—"` (`StudentProfile.tsx:370, 384`); the edit form leaves the field empty (NULL round-trips through `StudentEditForm.tsx`).
   - Attendance: eligibility is ACTIVE-enrollment based; the summary path reads Category A rows by any status with `joinedAt`/`leftAt` window filters and does not read `rollNumber` (evidence: `enrollment-relation-naming.md:104`). Attendance does not depend on roll.
   - Promotion UI: shows class/section transitions and counters, not rolls (evidence: `PromotionClient.tsx` per `implementation-summary.md §3`).
   - Reports: report surfaces are "Coming Soon" stubs; no report module reads enrollment rolls today (evidence: `DECISIONS.md #17` route matrix).

3. **Invariant violations?** No established invariant depends on a non-null roll:
   - Attendance eligibility depends on ACTIVE enrollment, not on roll (evidence: `enrollment-relation-naming.md:104`).
   - The DB-enforced uniqueness invariant (`enrollments_target_roll_active_key`, `schema.prisma:938`) exempts NULL by definition — it is weakened only in the sense that the batch's own rows are temporarily unconstrained; it is re-asserted by phase 2 within the same `runPromotionBatch` call.
   - The only invariant relaxed is the data-convention "every ACTIVE enrollment carries a roll" — true for all seed data (`seed.ts` assigns rolls to every enrollment) but not DB-enforced and already display-handled. **[Judgment]** Practical precedent: no NULL-roll ACTIVE enrollment has ever been observed in this system's runtime data; the intermediate state would be unprecedented in practice, even though schema-legal.

4. **Exposure window and compensating controls:**
   - Normal path: the NULL state lasts for phase 2's duration — one single-writer UPDATE pass per batch (seconds) — bounded by the batch lifecycle because phase 2 executes inside `runPromotionBatch`; a batch is not COMPLETED until rolls are assigned.
   - Crash path: if the process dies between phase 1 and phase 2, ACTIVE students carry NULL rolls until the batch is retried. Compensating control: the batch remains FAILED (the crash aborts `runPromotionBatch`), the retry job re-runs the batch — phase 1 is idempotent (already-promoted students are skipped by the existing-target guard, `promotion-service.ts:560`) and phase 2 fills remaining NULLs deterministically (skip non-NULL). This exposure is bounded by the same retry discipline that governs the current 84-unresolved cohort (`remaining-students-verification.md §3`).
   - Residual risk: a concurrent non-promotion write (students API admission/roll-edit) could claim a roll inside the window; phase 2's unique-violation handling ("next free") absorbs it. **[Judgment]** Rare (admissions into a mid-promotion target year), but must be coded; not measured.
   - Additional display compensating control: the existing `"—"` renderers already mask un-rolled students in every view that reads rolls (evidence as in 2 above); no view hiding work is needed.

---

## 6. Evaluation — eight criteria

### 6.1 Correctness (per-student atomicity, rollback, retry, idempotency)

**A.** Mutual exclusion per section removes the verified read-then-write race (`promotion-service.ts:731-739`) by construction; retries become first-come-first-served, so the 4-attempt exhaustion (verified 23/120 direct, 21/120 scheduler, `failure-breakdown.md §4`) cannot occur. Per-student transaction shape, rollback, and idempotency (existing-target guard `promotion-service.ts:560`) are unchanged. Residual same-roll collisions from happy-path carry-over (`promotion-service.ts:483`) are resolved by the now-race-free smallest-free fallback — identical semantics to today minus the race. **Confidence: High** (race mechanism verified; elimination by construction).

**B.** Atomic counter increment inside the promotion transaction issues unique values — race-free by construction. **However:** to be sound, the happy-path carry-over (`promotion-service.ts:483`) must also draw from the counter; otherwise carry-over values collide with counter-issued values and the retry path survives as today. A counter that only serves the retry path therefore degenerates to A's problem without A's serialization (evidence: the carry-over insert writes into the same section/roll namespace, `promotion-service.ts:601` vs `:751`). Clean B requires **changing the roll-preservation behavior** — a promotion business-rule change (frozen constraint §2). **Confidence: High** on the primitive's atomicity (standard DB semantics); **Medium** on its constraint compatibility (derived from the frozen rule).

**C.** Allocation is removed from the concurrent write path entirely; phase 2 is a single-writer deterministic pass — race-free by construction. Per-student promotion transaction remains atomic (status + target + audit in one commit, one audit per student, `promotion-service.ts:607-623`). The workflow, however, is no longer atomic end-to-end (NULL-roll intermediate state, §5). This is a **FAIL on the frozen "per-student atomicity" constraint unless the compensating control in §5.4 is accepted as preserving the invariant's intent** (the promotion itself is atomic; only roll assignment is deferred, and job COMPLETED gates on it). **Confidence: Medium** (design sound, constraint tension real; resolution requires an explicit acceptance of the compensating control).

### 6.2 Compatibility (PRESERVE_SECTION, PromotionJob, PromotionJobBatch, async, batching, multi-tenant)

**A.** PRESERVE_SECTION: orthogonal — the lock is keyed by target section, taken after section selection; with sections preserved, source rolls transfer 1:1 with no collisions by construction (each source section's rolls are unique within it — evidence: `seed.ts:471` one roll per student per section), so the fallback path is rarely exercised. **[Judgment]** Collision-free-by-construction when sections are preserved; not measured in this session. PromotionJob/JobBatch: untouched — the change is confined to `promotion-service.ts`, the function the job already calls (`implementation-summary.md §3`). Future async/multi-tenant: the advisory-lock form is DB-resident and process-independent (see §6.8). **Confidence: High** (job contract unchanged; lock keyed after section selection is derivable from code `promotion-service.ts:574-605`).

**B.** PRESERVE_SECTION: structurally at odds — a counter re-numbers students, discarding preserved rolls; special-casing carry-over reintroduces the collision path the counter was meant to remove. **[Judgment]** Architectural reasoning; the tension is derivable from the two write paths (`promotion-service.ts:483, 731-751`). PromotionJob/JobBatch: untouched. Multi-tenant: counter row is DB-resident. **Confidence: Medium** (derivation from code; the design tension is structural).

**C.** PRESERVE_SECTION: best fit of the three — phase 2 assigns `roll = source roll` per preserved section deterministically, collision-free by construction (source-section rolls are unique; `seed.ts:471`). **[Judgment]** Ideal mapping for the preserved-section case; not measured. PromotionJob/JobBatch: untouched — phase 2 is internal to `runPromotionBatch`; `onProgress` and batch counters are unaffected (`implementation-summary.md §3`). Async/batching/multi-tenant: the two-phase shape decouples allocation from the write path, which is the most future-friendly (§6.8). **Confidence: High** (job contract unchanged; deterministic mapping derivable).

### 6.3 Performance (remove or move the bottleneck; lock contention; worker utilization; scalability)

**A.** Removes the retry storm (23 exhausted-retry students in a 46 s direct run, `failure-breakdown.md §4`) and relieves the measured bottleneck: ~40 promoted/min against 6 workers on a 6-connection pool (`runtime-regression-analysis.md §4`). Serialization caps per-class write concurrency at #sections = 3 (evidence: `seed.ts:9` 45 sections / 15 classes). **[Judgment]** Expected productive throughput: 120 students ≈ 16–25 s per class at the observed 0.39 s/student (`runtime-regression-analysis.md §6`) vs the 46–187 s observed (`failure-breakdown.md §2`); the lock's serialization cost is bounded by the per-student transaction duration (0.39 s healthy, 0.5–2.5 s degraded — `runtime-regression-analysis.md §6`). Not measured in this phase.

**B.** Counter increment is a single row-lock UPDATE per student. **[Judgment]** Typical sub-10 ms row-lock update latency; not measured here. Contention is serialized per section but is far shorter than the per-student transaction, so effective parallelism ≈ A's, minus any retry storm. Rollback inside the transaction gives gapless counters.

**C.** Fastest path: phase 1 has **zero** collisions by construction (no carry-over, no retry loop — `retryWithFreeRoll` is eliminated entirely, `promotion-service.ts:655-712`); phase 2 is a small sorted UPDATE pass per batch. **[Judgment]** Expected full-run time = 1,457 × ~0.39 s / 6 workers + seconds of phase-2 ≈ 2–4 min vs the observed 27.2 min (`failure-breakdown.md §2`); not measured.

### 6.4 Complexity (effort, maintenance, debugging, operational risk)

**A.** Smallest of the three: one lock acquisition at the two write sites (`promotion-service.ts:483-605` happy path, `:731-751` retry path); no schema change in the advisory-lock form; the existing 4-attempt loop remains as an inert backstop. **Confidence: High** (two localized sites; derivable from code).

**B.** New counter table + migration + backfill of all existing sections + switch of both allocation sites to the counter + a documented behavior change (roll preservation dropped) — moderate-to-high effort including a data migration. **[Judgment]** Operational burden is the backfill and the semantics change; not measured.

**C.** New two-phase flow inside `runPromotionBatch`: collect promoted → sort → single-writer roll pass with NULL-skip and unique-violation handling; the retry job's interplay (idempotent phase 2) must be coded and tested. Moderate effort; debugging cost is the intermediate state (must query un-rolled students). **[Judgment]** Higher than A, lower than B; not measured.

### 6.5 Failure modes (deadlocks, races, starvation, partial completion, retry, crash recovery)

**A.** Deadlock: none by construction — one lock per transaction, no lock ordering. Starvation: none — PostgreSQL lock queues are FIFO. **[Judgment]** Standard DB semantics; not measured. Crash: DB releases transaction-level locks on abort; a whole-batch crash leaves students in the same recovery posture as today's 84-unresolved cohort (retry re-runs the batch; `remaining-students-verification.md §3`). **Confidence: High** (race eliminated by construction; crash path identical to current, evidenced).

**B.** Deadlock: none (single counter row per transaction). Counter desync with data — manual roll edits via the students API (`api/students/[id]/route.ts:104`) can advance rolls without touching the counter, later colliding with counter-issued values; the backstop index converts these into retry-exhausted failures again. **[Judgment]** Desync risk is derivable from the two writers; frequency not measured. Crash: counter increment and promotion are one transaction — atomic.

**C.** Crash between phases → ACTIVE students with NULL rolls until retry (compensating control §5.4; batch stays FAILED until phase 2 completes). No deadlock (single-writer phase 2); no starvation; phase-2 unique violation from a concurrent non-promotion writer is absorbed by "next free". **Confidence: Medium** (controls specified in design; not exercised in this phase).

### 6.6 Database impact (indexes, constraints, transaction scope, locking, pool usage)

**A.** No schema change (advisory-lock form); lock duration = per-student transaction. Reduces concurrent write bursts to #sections (3) per class, easing the observed 6-connection pool saturation (`runtime-regression-analysis.md §4`); the partial unique index (`schema.prisma:938`) remains the backstop. **Confidence: High** (index untouched; pool behavior evidenced).

**B.** Additive counter table; unique index remains the backstop; one extra UPDATE per student; the counter row becomes a hot row per section. **[Judgment]** Hot-row contention acceptable at 120 students/class; needs monitoring at larger scales; not measured.

**C.** No schema change. During the NULL window the partial index (`schema.prisma:938`) does not constrain the batch's rows (by its `WHERE roll_number IS NOT NULL` clause); phase 2 re-asserts uniqueness. No new locks (single-writer phase 2). **Confidence: High** (index semantics evidenced by its definition).

### 6.7 Audit compatibility (one audit event per promoted student, no weakened guarantees)

**A.** Unchanged — one promote audit per student inside the same transaction (`promotion-service.ts:607-623`); the 1:1 property was verified (1,093 audits = 1,093 promoted, exactly-1 per student — `failure-breakdown.md §1`). **Confidence: High**.

**B.** Unchanged — same single-transaction audit; no new events needed (the audit does not record the roll value today, `promotion-service.ts:614-621`). **Confidence: High**.

**C.** One promote audit per student preserved (phase-1 transaction unchanged, `promotion-service.ts:607-623`). Phase 2 writes no audit events — but the audit records no roll today (`promotion-service.ts:614-621`), so granularity is not weakened. **[Judgment]** If roll-level audit history becomes a requirement, phase 2 needs its own events; no frozen invariant requires it. **Confidence: High** (audit shape evidenced; judgment only on the optional future requirement).

### 6.8 Future evolution (multi-tenant, distributed workers, queue infrastructure, horizontal scaling)

**A.** **Architectural Judgment — Not Evidence Derived:** advisory locks are DB-resident, so the serialization survives multiple processes/instances; per-section keys keep tenants isolated under `DECISIONS.md #18`'s per-tenant pools; queue infrastructure unaffected.

**B.** **Architectural Judgment — Not Evidence Derived:** the counter row is DB-resident and multi-process safe; hot-row contention at high concurrency may require partitioned or per-tenant counter sets.

**C.** **Architectural Judgment — Not Evidence Derived:** the decoupled two-phase shape is the most future-friendly — distributed workers can promote concurrently and a deterministic coordinator pass assigns rolls; multi-tenant impact per `DECISIONS.md #18` is neutral (allocation is tenant-keyed by school/class/section).

_(Section 8 is entirely Architectural Judgment, as no investigation artifact addresses multi-tenant or distributed execution; per the mandate it must not outweigh criteria 1–2.)_

---

## 7. Comparison matrix

| Criteria                   | Option A — Serialize Per Section                                                                                                                                                                       | Option B — Atomic Allocation                                                                                                                                                              | Option C — Deterministic Post-Promotion                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Correctness**         | Race removed by construction; retry exhaustion (23/120, 21/120 — `failure-breakdown.md §4`) becomes impossible; transaction shape, rollback, idempotency unchanged (`promotion-service.ts:560`). High. | Atomic counter = race-free primitive; but clean form requires dropping roll preservation (frozen rule) or degenerates to A's problem (`promotion-service.ts:483` vs `:751`). Medium-High. | Allocation off the write path; per-student transaction stays atomic with 1 audit (`promotion-service.ts:607-623`); workflow atomicity relaxed (NULL window, §5) — constraint FAIL unless compensating control accepted. Medium. |
| **2. Compatibility**       | PRESERVE_SECTION orthogonal (lock keyed after section selection); Job/Batch untouched (`implementation-summary.md §3`). High.                                                                          | PRESERVE_SECTION structurally at odds (counter re-numbers, discards preserved rolls). Medium.                                                                                             | PRESERVE_SECTION best fit (deterministic roll = source roll per preserved section); Job/Batch untouched. High.                                                                                                                  |
| **3. Performance**         | Retry storm removed; concurrency capped at 3 sections/class; **[Judgment]** ≈16–25 s/class vs 46–187 s observed (`failure-breakdown.md §2`).                                                           | Counter update ~sub-10 ms/student **[Judgment]**; parallelism ≈ A minus retries.                                                                                                          | Zero collisions in phase 1 (retry loop eliminated, `promotion-service.ts:655-712`); **[Judgment]** fastest of the three.                                                                                                        |
| **4. Complexity**          | Smallest: one lock at two write sites; no schema change. High.                                                                                                                                         | New table + migration + backfill + behavior change. Medium.                                                                                                                               | Two-phase flow + idempotent roll pass + NULL-skip logic. Medium.                                                                                                                                                                |
| **5. Failure modes**       | No deadlock/starvation; crash path = today's posture (`remaining-students-verification.md §3`). High.                                                                                                  | No deadlock; counter/data desync via `api/students/[id]/route.ts:104` roll edits → backstop-index failures again. Medium.                                                                 | Crash between phases leaves NULL rolls until retry (control §5.4); rare concurrent-writer collision absorbed by next-free. Medium.                                                                                              |
| **6. Database impact**     | No schema change; index (`schema.prisma:938`) backstop; eases 6-connection pool saturation (`runtime-regression-analysis.md §4`). High.                                                                | Additive counter table; hot-row per section **[Judgment]**. Medium.                                                                                                                       | No schema change; index exempts NULL by definition (`schema.prisma:938`); uniqueness re-asserted in phase 2. High.                                                                                                              |
| **7. Audit compatibility** | Unchanged; 1:1 verified (`failure-breakdown.md §1`). High.                                                                                                                                             | Unchanged; no new events needed (audit has no roll, `promotion-service.ts:614-621`). High.                                                                                                | One audit preserved; phase 2 adds none (audit has no roll today). High.                                                                                                                                                         |
| **8. Future evolution**    | **Architectural Judgment — Not Evidence Derived:** DB-resident lock; multi-process safe; per-tenant keys under `DECISIONS.md #18`.                                                                     | **Architectural Judgment — Not Evidence Derived:** DB-resident counter; hot-row concern at scale.                                                                                         | **Architectural Judgment — Not Evidence Derived:** most decoupled shape; coordinator pass suits distributed workers.                                                                                                            |

---

## 8. Confidence table (all three options)

| #   | Conclusion                                                                                 | Confidence                  | Basis                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Race in `withRlsForRetry` is the dominant failure driver (17–19% healthy-env reproduction) | High                        | `failure-breakdown.md §4, §5` (measured reproduction)                                                                                                                      |
| 2   | A eliminates the race by construction (mutual exclusion over both write sites)             | High                        | `promotion-service.ts:483, 601, 731-751`; mechanism verified, fix by construction                                                                                          |
| 3   | A preserves current roll semantics exactly (carry-over + smallest-free fallback)           | High                        | `promotion-service.ts:483, 737-739`; direct-run failure reasons all retry-exhausted (`failure-breakdown.md §4`)                                                            |
| 4   | A keeps PromotionJob/JobBatch untouched                                                    | High                        | `implementation-summary.md §3` (job calls `runPromotionBatch`; `onProgress` contract)                                                                                      |
| 5   | A needs no schema change (advisory-lock form)                                              | High                        | Design scope; no table needed for advisory locks (judgment on PG API surface — **Architectural Judgment**)                                                                 |
| 6   | A caps per-class write concurrency at 3 sections                                           | High                        | `seed.ts:9` (45 sections / 15 classes)                                                                                                                                     |
| 7   | A's expected batch time ≈16–25 s vs 46–187 s observed                                      | Low                         | **Architectural Judgment — Not Evidence Derived** (extrapolation from `runtime-regression-analysis.md §6` per-student times)                                               |
| 8   | B's atomic counter primitive is race-free                                                  | High                        | Standard DB row-lock semantics (architectural reasoning on a standard primitive — **Architectural Judgment**, not measured in this codebase)                               |
| 9   | B's clean form requires dropping roll preservation (frozen rule)                           | Medium                      | Derived from code: counter must be single source of truth (`promotion-service.ts:483` vs `:751`) — evidence, but the rule's frozenness interpretation is the judgment part |
| 10  | B counter/data desync risk via students API roll edits                                     | Medium                      | `api/students/[id]/route.ts:104` (two writers to the same namespace); frequency not measured                                                                               |
| 11  | C phase 1 eliminates retry path entirely                                                   | High                        | `promotion-service.ts:655-712` — `retryWithFreeRoll` unreachable when rolls are NULL (design-implied)                                                                      |
| 12  | C intermediate NULL-roll state is schema-legal                                             | High                        | `schema.prisma:938` (index exempts NULL); `promotion-service.ts:100` (nullable); `api/students/route.ts:117`                                                               |
| 13  | C intermediate state is display-safe                                                       | High                        | `sections/[id]/page.tsx:166`, `StudentProfile.tsx:370` (`"—"` renderers)                                                                                                   |
| 14  | C violates no attendance/eligibility invariant                                             | High                        | `enrollment-relation-naming.md:104` (eligibility = ACTIVE, roll-independent)                                                                                               |
| 15  | C's NULL state is data-unprecedented in this system                                        | Medium                      | **Architectural Judgment — Not Evidence Derived** (seed always assigns rolls, `seed.ts`; no NULL-roll observation logged)                                                  |
| 16  | C workflow atomicity relaxation is bounded by the batch lifecycle                          | Medium                      | Design: phase 2 inside `runPromotionBatch` gates COMPLETED (§5.4) — control specified, not exercised                                                                       |
| 17  | C is the best fit for PRESERVE_SECTION roll mapping                                        | Medium                      | **Architectural Judgment — Not Evidence Derived** (deterministic roll = source roll per preserved section; source rolls unique per section, `seed.ts:471`)                 |
| 18  | C's expected full-run time ≈2–4 min vs 27.2 min observed                                   | Low                         | **Architectural Judgment — Not Evidence Derived** (extrapolation from `runtime-regression-analysis.md §6`)                                                                 |
| 19  | §8 multi-tenant/distributed claims for all three options                                   | Low (unmeasured by mandate) | **Architectural Judgment — Not Evidence Derived** (no artifact addresses multi-tenant/distributed execution)                                                               |
| 20  | Scheduler overhead (+5.7%) is not a failure source (context)                               | High                        | `runtime-regression-analysis.md §3-B` (measured)                                                                                                                           |

---

## 9. Recommendation

### 9.1 Selection

**Option A — Serialize Per Section** (PostgreSQL advisory lock keyed by `(school_id, class_id, section_id)`, acquired in both the happy path and the retry path, held for the per-student transaction, released on commit/abort). Exactly one option. Not "A or B", not "B/C".

### 9.2 Why A is preferred (weighted criteria 1–2 first)

1. **Correctness (weight 1):** A is the only option that removes the verified root cause — the read-then-write race (`promotion-service.ts:731-739`) that produced 17–19% failures on a healthy environment (`failure-breakdown.md §4`) — with **zero relaxation of any frozen invariant**. Mutual exclusion makes the smallest-free computation (`:737-739`) fresh by construction; the 4-attempt exhaustion becomes unreachable. Per-student atomicity, rollback, idempotency, and the existing-target guard (`:560`) are untouched. Correctness of the _fix_ does not depend on accepting a constraint relaxation, a compensating control, or a business-rule change — it depends only on the lock being taken, which is a bounded, verifiable code change.
2. **Compatibility (weight 2):** A changes nothing the other options would: no PromotionJob/JobBatch change (`implementation-summary.md §3`), no schema change (advisory-lock form), no change to roll semantics or section strategy. PRESERVE_SECTION (Phase 3.3) is orthogonal — the lock is keyed by the target section _after_ section selection (`promotion-service.ts:574-605`), and when sections are preserved the carry-over semantics produce collision-free transfers without even exercising the fallback.
3. **Criteria 3–7 (supporting, not decisive):** smallest complexity (two write sites, no migration — §6.4); no deadlock/starvation/desync failure modes (§6.5); no schema or index change and a side-benefit of easing the measured 6-connection pool saturation (`runtime-regression-analysis.md §4`); audit shape identical with the verified 1:1 property (`failure-breakdown.md §1`).
4. **Section 8 (noted, not decisive):** the DB-resident advisory lock survives multi-process/distributed execution — **Architectural Judgment — Not Evidence Derived** — but this did not drive the selection; criteria 1–2 did.

### 9.3 Why the other two are rejected (specific reasons)

**Option B rejected because:**

- Its clean, sound form requires making the per-section counter the single source of truth for rolls — which **changes the roll-preservation behavior** (`promotion-service.ts:483`), a promotion business rule frozen by §2. Its constraint-compatible form (counter only for the retry path) still collides with carry-over inserts and degenerates to A's problem without A's serialization (evidence: both paths write the same namespace, `:601` vs `:751`).
- It is **structurally at odds with PRESERVE_SECTION**: counter re-numbering discards the preserved-roll mapping that Phase 3.3 depends on.
- It adds the most operational surface of the three (new table, backfill, hot-row, counter/data desync risk via `api/students/[id]/route.ts:104` roll edits) — rejected on criteria 1–2 and 4–6, not on any measured performance difference.

**Option C rejected because:**

- It **requires relaxing the frozen per-student-atomicity invariant** (promotion ends at commit 1; the student exists ACTIVE-with-NULL-roll until commit 2 — §5). The compensating control (§5.4) is credible, but the §2 constraints explicitly require a separate ADR before any atomicity change, and this ADR's mandate is to fix the _verified_ defect — a race — not to restructure the write path.
- Its determinism and PRESERVE_SECTION affinity are real advantages (confidence #17, Medium — judgment), but they are advantages _for future phases_, not necessities for the verified root cause; A already makes PRESERVE_SECTION work (collision-free carry-over when sections are preserved).
- It introduces the only failure mode in the set that can strand students in a data-unprecedented intermediate state (confidence #15, Medium — judgment) and the only unique-violation edge case from concurrent non-promotion writers (§5.4).

### 9.4 Trade-offs

**Accepted:**

1. Per-class write concurrency is capped at #sections (3) during roll insertion — peak parallelism drops; compensated by the elimination of the retry storm (the measured bottleneck was pool saturation at 6 connections, `runtime-regression-analysis.md §4`, not worker count). **Confidence: High** on the cap (seed data), Low on the net-win timing (judgment).
2. Roll order remains nondeterministic (whoever holds the lock first gets the smallest free value) — this preserves current semantics; determinism is deferred to Phase 3.3's section-preserved mapping, where it becomes deterministic by construction.
3. Lock latency per student (one advisory-lock round trip per per-student transaction) — bounded by the observed 0.39–2.5 s transaction envelope (`runtime-regression-analysis.md §6`).
4. Advisory-lock key hashing must be defined and reviewed (optionally replaced by a lock row if rejected) — a small, reviewable design decision, not a mechanism change.

**Rejected:**

1. Option C's deterministic assignment and two-phase shape — attractive but requires the atomicity relaxation §2 forbids without a separate ADR; not needed to fix the verified root cause.
2. Option B's counter cleanliness — requires the frozen roll-preservation rule change; structurally conflicts with PRESERVE_SECTION.
3. Any hybrid of A+B or A+C — forbidden by §2 ("do not combine multiple options unless explicitly requested in a future ADR").

### 9.5 Recommendation Quality Gate (self-check)

1. **Why A solves the VERIFIED root cause:** the verified defect is the concurrent read-then-write in smallest-free allocation (`promotion-service.ts:731-739`) whose exhaustion produced 23/120 and 21/120 failures with zero connectivity errors (`failure-breakdown.md §4`); A serializes that allocation per section, making the check-then-insert atomic. It does not merely improve performance — it removes the failure mechanism.
2. **Why B and C fail weighted criteria:** B fails criterion 1 (constraint-compatible form leaves the carry-over collision path alive) and criterion 2 (roll preservation conflict with PRESERVE_SECTION); C fails criterion 1 by the frozen-atomicity constraint (§5.4, §6.1-C) — both rejected on 1–2, not on §8.
3. **Accepted trade-offs:** listed in §9.4.
4. **Rejected trade-offs:** listed in §9.4.
5. **Why A best supports Phase 3.3 (PRESERVE_SECTION):** the lock is keyed by the target section after section selection; preserved sections receive their source rolls collision-free by construction; the fallback path only exists for the non-preserved funnel case. **[Judgment]** Expected mapping verified only by construction, not measured.
6. **Why A best supports the long-term PromotionJob architecture:** zero changes to the job, batch, progress, retry, or RLS surfaces (`implementation-summary.md §3`); the fix lives entirely inside the engine function the job already calls.

---

## 10. Decision impact

**Promotion Engine:** add a section-scoped advisory lock (`pg_advisory_xact_lock` on a hash of school+class+section) acquired in `processOne` before the target insert (`promotion-service.ts:601`) and in `retryWithFreeRoll` before each retry attempt (`:731-751`); the existing 4-attempt loop stays as an inert backstop. Evidence-grounded: both write sites are identified in code; the race they share is verified (`failure-breakdown.md §4`). No schema change; no business-rule change.

**PromotionJob / PromotionJobBatch:** unaffected. Evidence: the job calls `runPromotionBatch` and consumes `onProgress`/counters only (`implementation-summary.md §3`); nothing in the job contract reads or writes rolls.

**PRESERVE_SECTION (Phase 3.3):** enabled with no interaction: the lock keys on the target section determined by the (future) preservation logic. **[Judgment]** With sections preserved, same-roll collisions disappear by construction (unique rolls per source section, `seed.ts:471`), so the fallback is rarely exercised; this is reasoning from code, not measured.

**Future optimization (Phase 3.4, <60 s objective):** A removes the retry storm, the dominant per-batch latency (46–187 s batches — `failure-breakdown.md §2`); **[Judgment]** expected full-run time drops to the low single-digit minutes at workers=6, still above the 60 s objective, so Phase 3.4's bulk-optimization decision gate remains meaningful. The objective does not override any frozen invariant (per the task framing).

**Future scalability:** the advisory lock is DB-resident, so it works across processes/instances and per-tenant pools (`DECISIONS.md #18`). **Architectural Judgment — Not Evidence Derived.**

---

## 11. Risks — documented per option

**Option A**

- Lock latency/round-trip per student if implemented naively (mitigate: single advisory-lock call per transaction, hash precomputed). **[Judgment]**
- If the lock is accidentally taken only in the retry path and not the happy path, carry-over collisions recur (mitigate: cover both sites; the two sites are enumerated in §6.4). Confidence that both sites are covered: High (code-derived).
- Advisory-key collisions across tenants if hashing is weak (mitigate: key includes school_id; collision of a 64-bit hash is negligible **[Judgment]**).

**Option B**

- Counter/data desync from non-promotion roll writes (`api/students/[id]/route.ts:104`) → backstop-index failures recur. Medium confidence.
- Backfill errors leave counters behind existing data → immediate collisions on first run. **[Judgment]**
- Behavior change (roll preservation dropped) may surprise users/UI consumers if not documented. High confidence it is a change (code-derived).

**Option C**

- Crash between phases strands ACTIVE students with NULL rolls until retry (mitigate: batch stays FAILED; phase 2 idempotent; §5.4). Medium confidence (control specified, not exercised).
- Concurrent non-promotion writer claims a roll inside the window (mitigate: next-free handling). **[Judgment]**, rare.
- NULL-roll state is unprecedented in system data — operational unfamiliarity. Medium confidence (§5.3, judgment).

---

## 12. Success criteria — compliance check

- ✓ Exactly one option selected (Option A, §9.1).
- ✓ Every rejected option includes explicit rejection reasoning (§9.3, per option).
- ✓ Every evaluation cell cites evidence or is explicitly labeled Architectural Judgment (matrix §7; §8 cells all labeled; §6.8 all labeled).
- ✓ Confidence table covers all three options, not just the winner (§8, rows 1–7 A, 8–10 B, 11–18 C).
- ✓ Option C's intermediate-state sub-evaluation is answered explicitly (§5, four questions each answered directly).
- ✓ Section 8 does not outweigh Sections 1–2 in the stated rationale (§9.2 point 4, §9.3 rejection reasons cite criteria 1–2).
- ✓ Risks documented per option (§11).
- ✓ Accepted and rejected trade-off lists present (§9.4).
- ✓ The chosen option is shown to solve the VERIFIED root cause, not merely improve performance (§9.5.1).
- ✓ No unsupported architectural assumptions remain unlabeled — every non-cited claim carries the Architectural Judgment label.
- ✓ No implementation performed, no code modified — this document is design only.
