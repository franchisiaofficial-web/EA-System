# Phase 3.2B — Full-School Production-Scale Validation Run

> **Verdict: PASS** (connection-light discrimination re-run — 0 failures, 0 lock timeouts).
> The prior STOP-condition run (1 lock timeout → 1 failed student) is documented in
> `BLOCKED-3.2B.md` and was caused by the harness's observer/polling load, not the
> shipping config. This file is the complete run record — all nine evidence items as
> actually measured. Raw terminal output (PASS run):
> `full-school-terminal-output.txt`; STOP run: `full-school-validation-raw.txt`.
> Baseline restored `1457 / 103 / 0 / 0` before and after each run.

## Run definition (PASS run)

- Job: `createPromotionJob(schoolId, seed_ay_2526 → seed_ay_2627, no classId)` through the
  global scheduler + `PromotionJobBatch` — production path (not direct `runPromotionBatch`).
- Workers: **6** (`PROMOTION_WORKERS` unset → default); pool untouched
  (`PRISMA_POOL_MAX` unset).
- Job ID: `cmsfr3ka50000wku8wsipk8dn` · started 2026-08-05T07:13:44.547Z ·
  completed 07:22:25.523Z · **wall 546.1 s (~9.1 min)**; `job.durationMs=521180`.
- Harness: connection-light — single batch-boundary state read every 60 s (9 reads total),
  no `pg_locks` observer, no continuous polling.
- Baseline at start: `ay2526_active=1457 ay2627_active=103 passed_out_records=0 students_passed_out=0` ✓

## 1. Job lifecycle + per-batch breakdown (source: `promotion_jobs` / `promotion_job_batches` raw rows)

`PENDING → RUNNING → COMPLETED`, all 15 batches COMPLETED. Batch timings from
`full-school-terminal-output.txt` (started→completed):

| #     | Batch (transition)    | eligible | processed | promoted | passedOut | failed | status    | batch duration (started→completed) |
| ----- | --------------------- | -------- | --------- | -------- | --------- | ------ | --------- | ---------------------------------- |
| 1     | Pre-KG → LKG          | 3        | 3         | 3        | 0         | 0      | COMPLETED | 3.5 s                              |
| 2     | LKG → UKG             | 10       | 10        | 10       | 0         | 0      | COMPLETED | 5.4 s                              |
| 3     | UKG → Grade 1         | 10       | 10        | 10       | 0         | 0      | COMPLETED | 6.8 s                              |
| 4     | Grade 1 → Grade 2     | 115      | 115       | 115      | 0         | 0      | COMPLETED | 42.4 s                             |
| 5     | Grade 2 → Grade 3     | 120      | 120       | 120      | 0         | 0      | COMPLETED | 45.4 s                             |
| 6     | Grade 3 → Grade 4     | 120      | 120       | 120      | 0         | 0      | COMPLETED | 44.3 s                             |
| 7     | Grade 4 → Grade 5     | 120      | 120       | 120      | 0         | 0      | COMPLETED | 43.4 s                             |
| 8     | Grade 5 → Grade 6     | 120      | 120       | 120      | 0         | 0      | COMPLETED | 43.1 s                             |
| 9     | Grade 6 → Grade 7     | 120      | 120       | 120      | 0         | 0      | COMPLETED | 43.3 s                             |
| 10    | Grade 7 → Grade 8     | 120      | 120       | 120      | 0         | 0      | COMPLETED | 42.6 s                             |
| 11    | Grade 8 → Grade 9     | 120      | 120       | 120      | 0         | 0      | COMPLETED | 45.1 s                             |
| 12    | Grade 9 → Grade 10    | 120      | 120       | 120      | 0         | 0      | COMPLETED | 43.3 s                             |
| 13    | Grade 10 → Grade 11   | 119      | 119       | 119      | 0         | 0      | COMPLETED | 44.3 s                             |
| 14    | Grade 11 → Grade 12   | 120      | 120       | 120      | 0         | 0      | COMPLETED | 43.7 s                             |
| 15    | Grade 12 → Passed Out | 120      | 120       | 0        | 120       | 0      | COMPLETED | 11.4 s                             |
| **Σ** |                       | **1457** | **1457**  | **1337** | **120**   | **0**  |           | 521,180 ms (`job.durationMs`)      |

Raw `promotion_jobs` / `promotion_job_batches` rows (all columns incl. createdAt/
startedAt/completedAt) are in `full-school-terminal-output.txt` §"PROMOTION_JOBS ROW" and
§"PROMOTION_JOB_BATCHES ROWS".

Per-batch timing is flat across all 120-student batches (42.6–45.4 s) — no inflation
window, no `EMAXCONNSESSION`, unlike the STOP run's 101–130 s batches 8–11.

## 2. Lock stats (aggregated across all mutex keys, whole run)

```
acquisitions=2396 waitMinMs=56 waitAvgMs=748 waitMaxMs=1940 waitP95Ms=1267
lockTimeouts=0 deadlocks=0 mutexFailures=0 retryAttempts=1059
```

1,059 retry attempts (structural carry-over collisions) — **every one recovered** under
the mutex, retryFailures=0 in every batch. **Lock timeouts: 0** (no STOP condition fired).
Full analysis: `lock-statistics.md`.

## 3. Duplicate-roll invariant (raw SQL, full section-by-section output)

```sql
SELECT section_id, COUNT(roll_number) AS assigned_rolls, COUNT(DISTINCT roll_number) AS unique_rolls
FROM enrollments WHERE status='ACTIVE' AND roll_number IS NOT NULL GROUP BY section_id;
```

`DUPLICATE-ROLL PASS=true` — every section OK, incl. all 14 target sections (raw dump @
07:22:49.736Z in `duplicate-roll-check.sql.out`):

| Target section      | assigned | unique |     | Target section      | assigned | unique |
| ------------------- | -------- | ------ | --- | ------------------- | -------- | ------ |
| seed_sec_2627_g01_a | 40       | 40     |     | seed_sec_2627_g08_a | 120      | 120    |
| seed_sec_2627_g02_a | 40       | 40     |     | seed_sec_2627_g09_a | 120      | 120    |
| seed_sec_2627_g03_a | 40       | 40     |     | seed_sec_2627_g10_a | 120      | 120    |
| seed_sec_2627_g04_a | 120      | 120    |     | seed_sec_2627_g11_a | 120      | 120    |
| seed_sec_2627_g05_a | 120      | 120    |     | seed_sec_2627_g12_a | 120      | 120    |
| seed_sec_2627_g06_a | 120      | 120    |     | seed_sec_2627_g13_a | 120      | 120    |
| seed_sec_2627_g07_a | 120      | 120    |     | seed_sec_2627_g14_a | 120      | 120    |

(Note: in the STOP run the g10 target held 119/119 because one student failed; in this
PASS run all sections are full 120/120.)

## 4. NULL-roll report (raw SQL)

```sql
SELECT COUNT(*) FROM enrollments WHERE status='ACTIVE' AND roll_number IS NULL;
```

**`NULL ROLL COUNT (raw): 0`** @ 07:22:49.838Z (`null-roll-report.sql.out`). No students
to list.

## 5. Final reconciliation (job counters + audit_logs, raw)

```
eligible==processed:                    true   (1457 == 1457)
processed==promoted+passedOut+failed:   true   (1457 == 1337+120+0)
promote audits (run window):            1337   (== promoted ✓)
pass_out audits (run window):           120    (== passedOut ✓)
students with >1 promote audit:         0
audit 1:1 with job counters:            true
missing promote audits = 0 | missing pass_out audits = 0
```

Full item: `audit-reconciliation.md`.

## 6. Runtime + per-batch timing

See §1 table (per-batch started→completed). Total wall = **546.1 s** (`job.durationMs` =
521,180 ms). Every 120-student batch ran a flat 42.6–45.4 s; pass-out batch 11.4 s — no
inflation window, no pooler saturation. For the STOP run's inflated window (101–130 s,
batches 8–11) see `full-school-validation-raw.txt` and §"Verdict" below.

## 7. Failure breakdown

**None — failed=0** across all 15 batches and the whole job. (The STOP run's single
failure, `seed_stu_000883`, was categorized as connection-pool saturation induced by the
harness — see `BLOCKED-3.2B.md` §"Resolution".)

## 8. Tenant isolation spot-check (fixture_school_b)

`enrollments=1 attendance=0 guardians=0` **before and after** — unchanged ✓.
Full item: `tenant-verification.md`.

## 9. Baseline restored

Pre: 1457/103/0/0 · Post-run pre-restore: 0/1440/120/120 · After restore: **1457/103/0/0** ✓
(Note: ay2526_active=0 post-run — every ACTIVE 2526 student was processed, holdout
included; restore re-ACTIVEd all.)

## Cross-key verification (corrected analysis of the pg_locks trace)

**Direct lock-key tracing limitation**: advisory locks are not logged per acquisition in
app code (no source changes allowed in 3.2B), so key tracing used a read-only
`pg_locks` observer (1 s sampling, `locktype='advisory'`). Sub-second _granted_ holds can
be missed, but lock _waits_ (0.4–2.2 s) are well within the sampling window.

Result (3,831 observations, 14 distinct keys):

| Observed key (key1:key2, unsigned oid) | Unsigned → signed        | Expected section               |
| -------------------------------------- | ------------------------ | ------------------------------ |
| 3321621423:3956462782                  | -973345873 : -338504514  | seed_sec_2627_g01_a (LKG)      |
| 3321621423:3677525853                  | -973345873 : -617441443  | seed_sec_2627_g02_a (UKG)      |
| 3321621423:1774402512                  | -973345873 : 1774402512  | seed_sec_2627_g03_a (Grade 1)  |
| 3321621423:3638495005                  | -973345873 : -656472291  | seed_sec_2627_g04_a (Grade 2)  |
| 3321621423:3700843923                  | -973345873 : -594123373  | seed_sec_2627_g05_a (Grade 3)  |
| 3321621423:4242619840                  | -973345873 : -52347456   | seed_sec_2627_g06_a (Grade 4)  |
| 3321621423:464023446                   | -973345873 : 464023446   | seed_sec_2627_g07_a (Grade 5)  |
| 3321621423:1599965570                  | -973345873 : 1599965570  | seed_sec_2627_g08_a (Grade 6)  |
| 3321621423:1437455930                  | -973345873 : 1437455930  | seed_sec_2627_g09_a (Grade 7)  |
| 3321621423:4046569124                  | -973345873 : -248398172  | seed_sec_2627_g10_a (Grade 8)  |
| 3321621423:2772271846                  | -973345873 : -1522695450 | seed_sec_2627_g11_a (Grade 9)  |
| 3321621423:2063970902                  | -973345873 : 2063970902  | seed_sec_2627_g12_a (Grade 10) |
| 3321621423:806856574                   | -973345873 : 806856574   | seed_sec_2627_g13_a (Grade 11) |
| 3321621423:526860965                   | -973345873 : 526860965   | seed_sec_2627_g14_a (Grade 12) |

- **All 14 observed keys are exactly the 14 expected target-section keys** (key1 =
  `hashtext('seed_school_ea')`; key2 = `hashtext('seed_ay_2627'+classId+sectionId)`), one
  per grade transition (first/only active section per target class). **No foreign keys.**
  ⚠️ The harness's inline "FOREIGN" labels in `full-school-validation-raw.txt` are a
  **reporting bug** — it compared signed `hashtext` output against pg_locks' unsigned
  `oid` display; the mapping above is the corrected arithmetic (`unsigned − 2^32` when
  `≥ 2^31`). No real contamination.
- **max distinct keys granted simultaneously = 1** (batches run sequentially; one key per
  batch) — **0** samples with >1 key at once.
- **0 cross-key waits**: no observation where a waiter's key differed from the granted
  key; waiters always queued behind the same section's holder.
- **0 deadlocks** across all 2,398 acquisitions.

Cross-key independence: **VERIFIED** — no evidence of any lock for one section's key
blocking or interacting with a different section's key.

## Runtime comparison vs the original run (failure-breakdown.md:21)

| Metric                 | Original full run (pre-fix) | 3.2B attempt 1 (harness-heavy) | 3.2B attempt 2 (connection-light, PASS) |
| ---------------------- | --------------------------- | ------------------------------ | --------------------------------------- |
| Workers                | 6                           | 6 (shipping default)           | 6 (shipping default)                    |
| eligible / processed   | 1,454 / 1,454*              | 1,457 / 1,457                  | 1,457 / 1,457                           |
| promoted               | 1,093                       | 1,336                          | **1,337**                               |
| passed out             | 120                         | 120                            | **120**                                 |
| **failed**             | **241 (16.6%)**             | **1 (0.07%)**                  | **0 (0%)**                              |
| total runtime          | 1,632,090 ms (~27.2 min)    | 956,734 ms (~15.9 min)         | **521,180 ms (~8.7 min)**               |
| duplicate rolls        | 0 (index backstop held)     | 0 (raw SQL, all sections)      | 0 (raw SQL, all sections)               |
| NULL rolls             | 0                           | 0                              | 0                                       |
| roll-collision retries | 157/241 recovered           | 1,062 recovered under mutex    | **1,059 recovered (100%)**              |
| lock timeouts          | n/a (no mutex)              | **1**                          | **0**                                   |
| deadlocks              | n/a                         | 0                              | 0                                       |

*Original eligible=1454 was computed on that day's cohort; today's baseline is 1457
(e.g. missing the holdout + year flags) — the comparison is on failure RATE and runtime,
both strictly better. Full-school comparison matrix also in `runtime-comparison.md`.

## Verdict

**PASS.** With the harness's observer/polling load removed (single-variable change), the
shipping configuration (workers=6, pool untouched) ran the full-school job to COMPLETED
in 546.1 s with **1,457/1,457 processed — 1,337 promoted + 120 passed out, 0 failed**,
**0 lock timeouts**, 0 deadlocks, 0 mutex failures, 0 duplicate rolls, 0 NULL rolls,
audit 1:1 (1,337/120, 0 double-promotes), retry breakdown sum == global counter
(1,059 == 1,059), tenant isolation intact, baseline restored (1457/103/0/0).

The mutex eliminated the roll-allocation race at full-school scale (241 → 0 failures,
16.6% → 0%, runtime 27.2 → 8.7 min). The earlier STOP-condition run is fully explained
as harness-induced connection-pool saturation at the session-mode pooler (`pool_size:
15`), documented and closed in `BLOCKED-3.2B.md`. **No code change and no Phase 5 pool
tuning were required. Phase 3.2B closes as PASS.**
