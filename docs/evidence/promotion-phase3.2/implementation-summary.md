# Phase 3.2 — Section-Scoped Roll-Allocation Mutex: Implementation Summary

> Status: **VERIFIED** — all STOP conditions absent (no duplicate rolls, no NULL rolls, no
> deadlocks, no lock timeouts, no lock bypass, no allocator failures at workers=1/3/6/12).
> Approved design: **ADR Option A — Serialize Per Section**
> (`../promotion-phase3-precondition/roll-allocation-design-decision.md` §9).
> Design-only Phase 3.1; this document is the implementation-only Phase 3.2 record.

## 1. Change footprint (implementation-only)

| File                                            | Change                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `src/services/promotion/promotion-roll-lock.ts` | **NEW** — section mutex module (single shared implementation)             |
| `src/services/promotion/promotion-service.ts`   | Both roll-ALLOCATION paths wrapped (`:602` happy path, `:750` retry path) |
| `docs/evidence/promotion-phase3.2/`             | Run harness, job regression, this evidence set                            |

Nothing else changed: **no schema, no business rules, no audit shape, no API, no
PromotionJob / PromotionJobBatch, no worker-count default, no pool size.** The in-memory
mutex option was rejected (per ADR §11) — the primitive is database-resident
(`pg_advisory_xact_lock`), correct across processes and instances.

## 2. The mutex primitive

```sql
SELECT set_config('lock_timeout', '20000', true),
       pg_advisory_xact_lock(hashtext(${schoolId}),
                             hashtext(${toAcademicYearId + classId + sectionId}));
```

Semantics (verified in this phase):

- **Transaction-scoped** — released automatically at COMMIT/ABORT, the earliest point at
  which the allocated roll is durable and visible to a concurrent allocator. "Release
  right after INSERT" would be incorrect (a following used-rolls read could still run
  against the uncommitted state).
- **One lock key per transaction** — exactly one key acquired per per-student
  transaction; no lock ordering ⇒ **no deadlock possible** (0 deadlocks observed in every
  run).
- **`lock_timeout` (20 s)** is set transaction-locally via `set_config(..., true)` (not a
  session-level `SET`), so an unacquirable mutex **fails with 55P03** instead of hanging
  forever; the per-student transaction aborts atomically and the existing retry policy
  continues. 0 lock timeouts observed.
- **Safe under transaction-mode pooling** — the advisory lock is bound to the
  transaction, which pins the backend session for its duration.
- **`$executeRaw`, never `$queryRaw`** — `pg_advisory_xact_lock` returns a `void` column
  that Prisma's `$queryRaw` cannot deserialize (verified failure, `promotion-roll-lock.ts`
  comment `:127`); `$executeRaw` runs the statement and returns only the affected row
  count.

## 3. The two allocation paths (invariant: no roll inserted without the mutex)

| Path            | Location                                       | Critical section                                                                                                   |
| --------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Happy path      | `processOne` (`promotion-service.ts:602`)      | `enrollment.create` (target) + `auditLog.create` (promote)                                                         |
| Collision retry | `withRlsForRetry` (`promotion-service.ts:750`) | used-rolls read → smallest-free computation → close source → create target → audit (`rollCollisionRecovery: true`) |

The retry path's read-then-write race (the verified pre-fix defect —
`failure-breakdown.md` §4: 23/120 direct, 21/120 scheduler failures at workers=6) is
eliminated because the used-rolls read and the insert now hold the same section mutex.

Work performed **outside** the critical section (correct and measured):

- source enrollment close (happy path, `:593`) — touches the source section, not the
  target roll space;
- source re-verify (`withRlsForRetry`, `:741`) — read-only guard against double processing.

Non-allocation paths audited and left untouched:

- `passOutStudent` (pass-out batch) — copies `finalRollNumber` into `passed_out_records`,
  allocates nothing, never enters the mutex (verified: **0 acquisitions** in the g14 run);
- Students API (`api/students/route.ts`, `api/students/[id]/route.ts`) — user-supplied
  roll numbers (validation, not allocation); partial unique index
  `enrollments_target_roll_active_key` remains the backstop.

Guard: `withSectionRollLock` throws if `sectionId` is null — a roll can never be inserted
without a section, hence without the mutex (`promotion-roll-lock.ts:114`).

## 4. Verification executed (all runs on the certified baseline 1457/103/0)

| Run (RUN_ID)   | Scope                  | Workers | Result                                         | Lock acquisitions                | Wait avg / max / p95 (ms) | Retries | Wall    |
| -------------- | ---------------------- | ------- | ---------------------------------------------- | -------------------------------- | ------------------------- | ------- | ------- |
| workers-1      | g04→g05 (120)          | 1       | 120/120, 0 failed                              | 210                              | 104 / 409 / 108           | 90      | 164.6 s |
| workers-3      | g04→g05 (120)          | 3       | 120/120, 0 failed                              | 210                              | 387 / 1023 / 719          | 90      | 77.0 s  |
| workers-6      | g04→g05 (120)          | 6       | **120/120, 0 failed** (pre-fix: **23 failed**) | 210                              | 1149 / 1866 / 1842        | 90      | 67.2 s  |
| workers-12     | g04→g05 (120)          | 12      | 120/120, 0 failed                              | 208                              | 1160 / 2156 / 1740        | 88      | 66.9 s  |
| passout-g12-w6 | g12→g13 (119)          | 6       | 119/119, 0 failed                              | 209                              | 1155 / 1945 / 1844        | 90      | 67.1 s  |
| passout-g14-w6 | g14 → PASSED OUT (120) | 6       | 120 passed out, 0 failed                       | **0** (pass-out never allocates) | —                         | 0       | 17.6 s  |
| job regression | g04 via PromotionJob   | 6       | COMPLETED 120/120, 0 failed                    | 217                              | 1130 / 2115 / 1640        | 97      | 74.6 s  |

Every run: **duplicate-roll SQL PASS** (assigned_rolls == unique_rolls for every section),
**NULL-roll count 0**, lockTimeouts=0, deadlocks=0, otherFailures=0.

Retry attempts (~90 per 120-student run) are the structural carry-over collisions; every
one recovered on the first retry attempt under the lock (retryAttempts == 90, failed=0).

## 5. Integrity checks

- **Baseline restore**: certified script `docs/evidence/tmp-1.1-restore.ts` run before
  every worker run and after the aborted full-school run — PRE-STATE always
  1457 ACTIVE / 103 ACTIVE / 0 passed-out records / 0 students PASSED_OUT (raw output in
  `terminal-output.txt`).
- **Aborted full-school run** (operator-aborted `full-school-w6`, 05:58:13Z): partial
  state (774 promoted, 88 passed out) was fully cleaned by the restore; re-verified
  1457/103/0 before the next run. No partial-run residue.
- **Tenant isolation**: fixture school (`fixture_school_b`) enrollment count unchanged
  (1) across all runs; attendance (46,927) and guardians (3,132) counts byte-identical
  before/after — promotion touches only enrollments/students/audit_logs.
- **Audit 1:1**: job regression created exactly 120 `audit_logs` (entity=enrollment,
  action=promote) for 120 promoted students.

## 6. STOP-condition checklist (all clear)

| Condition                                           | Result                                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| Duplicate roll numbers in any section               | **Not observed** (raw SQL, 6 runs)                                            |
| Any lock bypass (roll allocation outside the mutex) | **None** — both allocators wrapped; pass-out/API paths audited non-allocators |
| Deadlock at any worker count                        | **0** (12 runs, up to workers=12)                                             |
| Lock acquisition failure (55P03/40P01/other)        | **0** across all runs                                                         |
| Allocator failure at any worker count               | **0 failed** students in every run (pre-fix: 23/120 at workers=6)             |

No `BLOCKED.md` was created — no STOP condition triggered.
