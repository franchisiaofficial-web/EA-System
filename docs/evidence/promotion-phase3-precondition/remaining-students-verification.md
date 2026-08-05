# Phase 3 Precondition — Task 2: Remaining-Students Verification

> Source of truth: persisted evidence — `audit_logs` (promote/pass_out windows), enrollment state.
> All counts are DB-derived, independent of the job counter columns. Date: 2026-08-05.

## 1. Definitions and windows

- **Unresolved** = students with no `promote` audit anywhere in `[FULL job start .. RETRY job end]`
  = `[2026-08-04T07:40:44.370Z .. 2026-08-04T08:19:05Z]` — the students the promotion system never
  moved, in either run.
- Window lower bound **must** be the FULL run start: the same cohort carries _trial-era_ promote
  audits (06:39–07:34Z, pre-FULL sandbox runs); a lower bound inside that range would wrongly
  exclude students from the unresolved set.

## 2. Reconstructed failed set (cross-check of the 241)

Failed set reconstructed from persisted state alone (ACTIVE `seed_ay_2526` enrollment in the 13
`retryClassIds` classes with no promote audit in the FULL window):

- **Reconstructed = 241** — exactly matches the FULL job's persisted `failed_students` counter. ✓

## 3. Unresolved count — independent derivation

No promote audit in `[fullStart .. retryEnd]` (derivation independent of job counters):

- **Unresolved = 84**

Arithmetic cross-check: 241 failed − 157 retried-and-promoted = **84** ✓ (persisted counters agree
with the audit-derived number; both are 84).

## 4. Per-student verification — 84/84 clean

For each of the 84 students (individually queried):

| Check                                                                            | Result |
| -------------------------------------------------------------------------------- | ------ |
| Source enrollment ACTIVE in `seed_ay_2526` (exactly 1)                           | 84/84  |
| ACTIVE enrollment count across years (exactly 1, no strays)                      | 84/84  |
| No enrollment in target year `seed_ay_2627`                                      | 84/84  |
| No `PassedOutRecord` row                                                         | 84/84  |
| No promote audit in `[fullStart .. retryEnd]`                                    | 84/84  |
| Has only historical (pre-FULL-run) promote audits — expected trial-era artifacts | 84/84  |
| Non-clean students                                                               | **0**  |

**Conclusion:** all 84 unresolved students are consistent, single-ACTIVE, never-promoted, never
passed-out. They were left behind by the promotion system (41 never processed due to the RETRY
job's Grade 10→11 batch crash; 43 failed during the RETRY run — see failure-breakdown.md §3).

## 5. How to resolve them operationally

1. Fix the roll-allocation race (phase3-readiness.md) — otherwise a retry re-enters the same failure mode.
2. Create a fresh job for the 84 (single class filter is insufficient — they span all 13 classes);
   use `createPromotionJob` with no `classId`, which re-plans all ACTIVE 2526 students (the 84 are
   the only ACTIVE 2526 students with no 2627 target, so the job will process exactly them plus any
   already-moved students are idempotently skipped via the source-status guard).
3. Verify afterwards: 0 ACTIVE in `seed_ay_2526`, 84 new `promote` audits within the new window.
