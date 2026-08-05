# BLOCKED — Phase 3.2B (Full-School Production-Scale Validation)

> **Status: RESOLVED — closed by the connection-light discrimination re-run (PASS).**
> The STOP below was induced by the harness's observer/polling load, not by the shipping
> configuration. Re-run evidence: `full-school-terminal-output.txt` (job
> `cmsfr3ka50000wku8wsipk8dn`, COMPLETED 546.1 s, **0 lock timeouts, 0 failures,**
> 1,337 promoted + 120 passed out on 1,457/1,457). See §"Resolution".
> 3.2A (mutex correctness, single-class) stays PASSED/frozen.
> Original STOP-condition run evidence: `full-school-validation-raw.txt`.

## Issue

The required full-school `PromotionJob` (1,457 eligible, 15 batches, workers=6 — the
shipping default) ran to `COMPLETED` uninterrupted (959.9 s) but with **1 failed student**,
caused by exactly **1 lock timeout** (`waitMaxMs=20480` ≈ the 20 s `lock_timeout`,
`lockTimeouts=1`). Per the 3.2B STOP conditions, **any lock timeout is a STOP condition**
— independent of cause.

## Evidence (raw)

- Job: `promotion_jobs` status `COMPLETED`, eligible=1457, processed=1457,
  promoted=1336, passedOut=120, **failed=1**, durationMs=956734 (error=null).
- Batch: `Grade 7 → Grade 8` status `FAILED`, eligible=120, processed=120, promoted=119,
  **failed=1** (started 06:45:26.714Z, completed 06:47:37.077Z — 130.4 s, the longest
  promotion batch).
- Lock stats (whole run): acquisitions=2398, waitMin=60ms, waitAvg=1366ms,
  **waitMax=20480ms**, waitP95=2659ms, **lockTimeouts=1**, deadlocks=0, mutexFailures=0,
  retryAttempts=1062.
- Failed student (forensic, post-run DB): `seed_stu_000883` Nithin Moorthy,
  ADM000883, Grade 7 section B (`seed_sec_2526_g09_b`, 2526 roll 3). Still `ACTIVE` in
  2526 (the only 1 remaining), **no** 2627 enrollment, **no** audit_logs row in the run
  window. The sole ACTIVE holdout pre-restore (`ay2526_active=1`).
- Concurrent environment anomaly: the observer logged pooler **`EMAXCONNSESSION` —
  "max clients reached in session mode - max clients are limited to pool_size: 15"** at
  06:43:07.704Z and 06:46:25Z — inside the slow-batch window. Timing inflation after that
  point: Grade 5→6 = 109.5 s, Grade 6→7 = 104.1 s, Grade 7→8 = 130.4 s, Grade 8→9 =
  101.0 s (baseline per-batch pace for a 120-student class ≈ 66–74 s; the last three
  batches recovered to 71 s / 67 s / 44 s).
- Full raw output (job row, all 15 batch rows with timestamps, dup/NULL SQL, tenant
  probe, lock stats): `full-school-validation-raw.txt`.

## Root cause (categorized — environmental infrastructure, not the mutex)

The failure is a **lock-timeout under connection-pool saturation at the session-mode
pooler** (`pool_size: 15`), not a roll-allocation race:

1. Mid-run (from ~06:41, 3 batches in), concurrent connection demand — 6 promotion
   workers' interactive transactions + job-service progress persistence + the harness
   poll/observer — pressed the pooler's 15-client session cap. The pooler began rejecting
   new sessions (`EMAXCONNSESSION`, observed).
2. When scheduling stalls, transactions that hold `pg_advisory_xact_lock`
   (transaction-scoped, held to COMMIT) stayed open longer than the ~1.4 s average.
3. One waiter's lock acquisition measured **20,480 ms** and tripped the 20 s
   `lock_timeout` → **55P03** → that per-student transaction aborted atomically → the
   collision-retry path re-attempted and could not complete before its own budget →
   `seed_stu_000883` failed.

The mutex behaved **exactly as designed** in this scenario: it failed fast (55P03) rather
than hanging forever, left no leaked lock, no duplicate roll, no NULL roll, and the
transaction aborted cleanly (no partial row). The failure mode is the environment's
connection ceiling, which Phase 3.2B's shipping configuration (pool untouched) does not
govern.

## Affected path

`processOne` / `withRlsForRetry` happy+retry allocators (both mutex-wrapped) under
`createPromotionJob`'s scheduler at full-school scale. Single class of failure:
`Grade 7 → Grade 8` batch (target key `2627_g10_a`).

## STOP conditions triggered (checklist)

| Condition                                                                 | Result                                                                                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roll-allocation failure not attributable to categorized environment cause | **Implicated**: 1 failure IS attributable to pool saturation + 55P03 lock timeout (categories: connection-pool saturation / lock-timeout). Not a race.  |
| Duplicate-roll violation in any target section                            | **Not observed** — raw SQL PASS, all 14 target sections + pre-existing (e.g. 2627_g04_a 120/120, 2627_g14_a 120/120)                                    |
| Non-zero NULL-roll count without listed reason                            | **Not observed** — 0                                                                                                                                    |
| Deadlock                                                                  | **Not observed** — 0 (one lock key per transaction, no ordering)                                                                                        |
| Lock timeout                                                              | **OBSERVED — 1** (`lockTimeouts=1`, `waitMaxMs=20480`)                                                                                                  |
| Cross-key contamination                                                   | **Not observed** — 14 distinct keys, max 1 granted concurrently, 0 cross-key waits (see corrected analysis in `full-school-validation.md` §"Cross-key") |

## Why verification failed

3.2B's success criterion is a full-school run with **zero** failures and **zero** lock
timeouts. The run produced 1 lock timeout and 1 failed student. Even though every
correctness invariant held (no duplicates, no NULL rolls, no deadlock, no cross-key
interaction, audit 1:1, escalation 1:1, reconciliation exact), the explicit STOP
condition "any lock timeout" fired. 1,336/1,337 promotions + 120/120 pass-outs succeeded;
exactly one student was lost to the pool-saturation window.

## Recommended next action

Do not modify code (per 3.2B constraints). Discriminate whether the timeout recurs under
**shipping configuration alone** vs the harness's added load, then re-run:

1. **Re-run 3.2B with a connection-light harness**: disable the 1 s `pg_locks` observer
   and the 5 s DB poller (poll from a single dedicated connection only at batch
   boundaries); everything else identical (workers=6 unset, pool untouched, baseline
   restored, full-school job). If 0 lock timeouts / 0 failures → 3.2B PASS, with the
   current run documented as harness-induced pool pressure. If ≥1 timeout recurs →
   the shipping config itself exceeds the pooler's 15-client cap at workers=6 → this is a
   **Phase 5 pool-sizing blocker** surfaced early, and 3.2B remains open pending that
   decision.
2. Cheapest discrimination also available: the run already shows the saturation was
   _transient_ (later batches recovered to nominal timing), so a re-run is low-biased
   toward PASS.
3. Note: `pool_size: 15` is the session-mode pooler's cap for `DIRECT_URL`; pool sizing /
   `PRISMA_POOL_MAX` / worker-count tuning are explicitly **out of scope** for Phase 3.2B
   and belong to Phase 5 (do not tune them to unblock this run).

On a clean PASS, complete the remaining 3.2B bookkeeping (final
`full-school-validation.md` verdict + audit reconciliation) and close Phase 3.2.

## Resolution (2026-08-05 — connection-light re-run, PASS)

Single-variable experiment: identical shipping configuration (workers=6 default, pool
untouched, same scheduler/job/batch path, baseline restored), only the harness changed —
1 s `pg_locks` observer + continuous 5 s polling **removed**, replaced by a single
batch-boundary state read every 60 s (`run-full-school-3.2b-lite.ts`).

| Metric                            | Attempt 1 (harness-heavy)   | Attempt 2 (connection-light) |
| --------------------------------- | --------------------------- | ---------------------------- |
| job                               | `cmsfprvmc00004su8vier586j` | `cmsfr3ka50000wku8wsipk8dn`  |
| status                            | COMPLETED                   | COMPLETED                    |
| wall                              | 959.9 s                     | **546.1 s**                  |
| promoted / passedOut / **failed** | 1,336 / 120 / **1**         | **1,337 / 120 / 0**          |
| lockTimeouts                      | **1**                       | **0**                        |
| lock waitAvg / max (ms)           | 1,366 / 20,480              | **748 / 1,940**              |
| mutexFailures / deadlocks         | 0 / 0                       | 0 / 0                        |
| retryAttempts                     | 1,062                       | 1,059                        |
| dup-roll / NULL-roll              | PASS / 0                    | PASS / 0                     |
| audit 1:1 / reconciliation        | PASS                        | PASS                         |
| tenant isolation                  | PASS                        | PASS                         |

**Conclusion:** the 20 s lock-timeout STOP was pool-saturation induced by harness load
(its observer/polling pressed the session-mode pooler's `pool_size: 15` cap, observed as
`EMAXCONNSESSION`). With the harness quiet, the shipping config at workers=6 sustained
the full-school run with **zero** timeouts and **zero** failures and ran ~1.75× faster.
**No code change was made and none is needed; no Phase 5 pool tuning was required to
unblock.** STOP condition resolved → **Phase 3.2B PASS** (see `full-school-validation.md`
verdict).
