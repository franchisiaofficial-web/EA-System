# Phase 3 Precondition — Task 4: PRESERVE_SECTION Readiness Verdict

> Gate decision before implementing PRESERVE_SECTION (preserve the source section across promotion).
> Basis: tasks 1–3 evidence (this directory) + Phase 2 implementation summary. Date: 2026-08-05.

## Summary evidence

1. **FULL run** (workers=6): 241/1,454 failed (16.6%). **Retry**: 157/241 recovered; 84 clean
   single-ACTIVE students remain unresolved (verified 84/84 — remaining-students-verification.md).
2. **Root cause (dominant):** concurrent roll-number allocation races at workers=6
   (`promotion-service.ts:731-739`, read-then-write, smallest-free-roll). Reproduced 21–23/120
   (17–19%) on the **identical seed with a healthy environment**, direct and via scheduler, **zero**
   connectivity errors (runtime-regression-analysis.md).
3. **Environment** (`statement_timeout=2 min`, pooler connection drops) contributed a minority
   (≈6–12%) via batch-crash + timeouts, and stranded 41 students in a failed batch.

## Verdict: **NOT READY** — implement with the roll-allocation fix

### Why not ready as-is

- The collision unique key is `(school_id, academic_year_id, class_id, **section_id**, roll_number)`.
  PRESERVE_SECTION makes section assignment _more_ explicit but operates on the **same racy roll
  allocator**. Any 6-worker PRESERVE_SECTION run on the current engine will still throw 17–19% of
  students into "Roll collision retry exhausted" before section preservation is even evaluated.
- Verifying section-preservation correctness requires a clean baseline; a 17–19% noise failure floor
  makes correctness testing impossible (a preserved-section student failing on a race would be
  indistinguishable from a logic error).
- The 84 unresolved students must be cleared via the _fixed_ engine, or a PRESERVE_SECTION run would
  inherit them and conflate two defects.

### Required before PRESERVE_SECTION implementation

1. **Make roll allocation concurrency-safe** (a, b, or c — decision needed):
   - (a) Serialize the roll-number allocation per batch per section (single-writer table or
     `SELECT … FOR UPDATE` on a per-section counter row; compact and compatible with the partial
     unique index), or
   - (b) Atomic allocation via `INSERT … SELECT next value` / advisory lock per section, or
   - (c) Assign roll numbers post-promotion in a deterministic single pass (roll preserved later).
2. Re-verify on the full 1,454 cohort at workers=6: expected failure rate drops to the ~1%
   environment floor (Gap A workers=1 baseline).
3. Retire the 84 unresolved students through the fixed engine (remaining-students-verification.md §5).
4. Only then implement PRESERVE_SECTION on top (it still needs its own per-student audit of source
   vs preserved section for verification).

### What PRESERVE_SECTION should NOT be blamed for

- Do not attribute the 241 (or the 84) to section-preservation logic — it is not implemented yet;
  100% of today's C1 failures are roll allocation, provable from the identical-seed reproduction.

### Forward state

- Restored environment baseline: 1,457 ACTIVE `seed_ay_2526`, 103 ACTIVE `seed_ay_2627`,
  0 passed-out, 0 students PASSED_OUT. Persisted job/batch/audit records remain as evidence.
- The modernized entry point (`POST /api/promotions` 202 + background PromotionJob + idempotent
  retry + progress) is unaffected by this verdict and remains in place; it simply runs an engine
  whose roll allocator must be fixed before section-preservation bring-up.
