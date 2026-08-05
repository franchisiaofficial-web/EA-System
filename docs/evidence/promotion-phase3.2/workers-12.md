# Workers = 12 — Scoped Run (g04 → g05)

- **RUN_ID**: `workers-12` — started `2026-08-05T05:55:41.943Z`
- **Scope**: `seed_cls_2526_g04` (120 eligible) — logical-concurrency verification only;
  the DB pool was **not** increased (12 workers share the pool; pool tuning belongs to
  Phase 5)

```
eligible=120 processed=120 promoted=120 passedOut=0 skipped=0 failed=0 retryable=0
durationMs=66868 wallMs=66868 studentsPerSec=1.79
failureReasons=[]
```

Lock stats:

```
acquisitions=208 waitMinMs=99 waitAvgMs=1160 waitMaxMs=2156 waitP95Ms=1740
lockTimeouts=0 deadlocks=0 mutexFailures=0 retryAttempts=88
```

- `retryAttempts=88` (two fewer than 90): commit-order luck means two fewer students hit
  a carry-over collision; all 88 recovered first-try. **0 failed.**
- Wall is unchanged from workers=6 (~67 s) — the single target section
  (`seed_sec_2627_g05_a`) is the serialization point; adding workers beyond ~6 on a
  one-section funnel buys nothing (see `runtime-comparison.md`).
- **No lock timeouts** even at 12 contested workers (worst wait 2.2 s ≪ 20 s `lock_timeout`).

Verification: DUPLICATE-ROLL PASS=true; NULL ROLL COUNT=0 @ 05:56:50.706Z;
`seed_sec_2627_g05_a` assigned=120 unique=120.
Raw: `terminal-output.txt` (lines 249–330).
