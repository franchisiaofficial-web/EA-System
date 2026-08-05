# Lock Statistics — Phase 3.2B Connection-Light Full-School Run

## Raw (application timing: before acquire → after acquire)

```
acquisitions=2396 waitMinMs=56 waitAvgMs=748 waitP95Ms=1267 waitMaxMs=1940 lockTimeouts=0 mutexFailures=0 deadlocks=0 retryAttempts=1059
```

## Correlation with the STOP-condition run

| Metric        | 3.2B attempt 1 (harness-heavy)   | 3.2B attempt 2 (connection-light) |
| ------------- | -------------------------------- | --------------------------------- |
| acquisitions  | 2398                             | 2396                              |
| wait avg (ms) | 1366                             | **748**                           |
| wait max (ms) | **20480** (~20 s `lock_timeout`) | **1940**                          |
| wait p95 (ms) | 2659                             | **1267**                          |
| lockTimeouts  | **1**                            | **0**                             |
| mutexFailures | 0                                | 0                                 |
| deadlocks     | 0                                | 0                                 |
| retryAttempts | 1062                             | 1059                              |

## Reading

- With the harness's 1 s `pg_locks` observer and continuous 5 s poller removed, the worst
  observed lock wait dropped from the 20 s timeout ceiling to **1.94 s** — ~10× lower.
- **0 lock timeouts**, **0 mutex failures**, **0 deadlocks** in the entire run (2,396
  acquisitions) → no STOP condition fired.
- Retry attempts (1,059) correspond 1:1 with the per-batch `rollCollisionRecovery` audit
  count (see `batch-retry-breakdown.md`).
- Confirms `BLOCKED-3.2B.md` root cause: the pooler `pool_size: 15` saturation was
  **induced by concurrent harness load**, not by the shipping pool + workers=6 config.
