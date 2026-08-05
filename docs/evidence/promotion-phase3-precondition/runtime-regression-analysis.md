# Phase 3 Precondition — Task 3: Runtime Regression Analysis (A / B / C)

> Question: if the promotion engine / scheduler must be re-run (e.g. for PRESERVE_SECTION), will
> the 241-failure pathology recur? Partitioned into:
> **A** — engine logic, **B** — job architecture (scheduler/progress/batching), **C** — environment (pooler/DB).

## 1. Evidence base

- Persisted FULL + RETRY job/batch timings (see failure-breakdown.md §2).
- Audit-per-minute throughput over the FULL run (persisted `audit_logs`).
- DB session config via pooler: `statement_timeout = 2 min`, `idle_in_transaction_session_timeout = 0`, `max_connections = 60`.
- **One controlled comparison** (the sole permitted run): same class `seed_cls_2526_g04` (120 students), identical restored baseline (1,457/103/0), `PROMOTION_WORKERS=6`, healthy environment — direct `runPromotionBatch` vs the PromotionJob scheduler. Baseline restored to 1,457/103/0 after both.

## 2. The controlled comparison (2026-08-05 ~03:00Z)

| Metric                      | Direct `runPromotionBatch`         | PromotionJob scheduler          |
| --------------------------- | ---------------------------------- | ------------------------------- |
| promoted / failed           | 97 / 23 (19.2%)                    | 99 / 21 (17.5%)                 |
| engine `durationMs`         | 46,387 ms                          | 49,050 ms                       |
| wall (caller)               | 46,389 ms                          | ~52 s (incl. 1.23 s job create) |
| per-student                 | 387 ms                             | ~409 ms                         |
| failure reasons             | all roll-collision retry-exhausted | counter-only (same engine)      |
| connectivity/timeout errors | **0**                              | **0**                           |

Deliberate note: the scheduler run's `durationMs` (49,050) already includes the run; the extra
~3–5 s over direct is queue startup + progress-write contiguity. Both paths fail at ~17–19% with
**zero environmental errors** on a healthy pooler.

## 3. A vs B vs C verdict

### A — Engine logic (roll-number allocation): **DEFECTIVE — dominant failure source**

- `withRlsForRetry` (promotion-service.ts:731-739) allocates rolls by read-then-write race on the
  same section. At workers=6 this reproduces **19.2% failures on a healthy environment**, identical
  seed, both directly and via scheduler. At workers=1 (Gap A trial: 1,200 students) there were **0**
  roll collisions. This is engine-level, not pooler, not scheduler.
- Per-batch persisted signatures agree: flat, size-correlated failure counts, no time ramp.

### B — Job architecture (scheduler/progress/batches): **minor overhead, not a failure source**

- Scheduler vs direct: 49.1 s vs 46.4 s (+5.7%), failure rate 17.5% vs 19.2% (statistically
  equivalent). Progress persistence adds no failure mode; the debounced 800 ms flush introduces
  negligible pool pressure (both already saturate the 6-connection pool).
- The retry-job **batch crash** (`Connection terminated unexpectedly`) is a _batch-layer_ failure —
  environment (C), expressed through the scheduler's batch boundary, not an architecture bug.

### C — Environment (pooler/DB): **secondary, transient contributor**

- Healthy today (387 ms/student, 0 timeouts) yet the engine still fails 17–19% — environment is
  **not** required to produce failures.
- Degraded during FULL (0.5–2.5 s/student; `statement_timeout=2 min`; retry crash) — this explains
  the ~15–30 (≈6–12%) environmental failures and the 84 students left behind.

## 4. Throughput vs workers (persisted, FULL run)

- 6 workers, per-student 0.53–2.5 s, aggregate only ~40 promoted/min (07:41–08:07Z histogram).
  Worker throughput is bounded by the shared 6-connection pool + pooler RTT, not compute: more
  workers would not remove failures (they are races) and would not meaningfully raise throughput.

## 5. Will a re-run recur?

Yes, for C1: **any re-run at workers=6 on the current engine reproduces 17–19% roll-collision
failures** on identical data, regardless of environment health. The retry path recovers ~65%
(157/241) and leaves ~half of the remainder as clean single-ACTIVE students (84). A re-run after a
roll-allocation fix (e.g. serialized/atomic per-section counter) is estimated to reduce failures to
C2-only ~1% (the workers=1 Gap A baseline).

## 6. Regression comparison summary

| Axis          | Healthy env today | FULL run (07:40Z, degraded) | Gap A (workers=1)  |
| ------------- | ----------------- | --------------------------- | ------------------ |
| per-student   | 0.39 s            | 0.5–2.5 s                   | 1.4–6.8 s          |
| failure rate  | 17–19%            | 16.6%                       | 1.0%               |
| failure cause | roll-race         | roll-race + env             | env (connectivity) |
