# Workers = 3 — Scoped Run (g04 → g05)

- **RUN_ID**: `workers-3` — started `2026-08-05T05:52:18.960Z`
- **Scope**: `seed_cls_2526_g04` (120 eligible)
- **Baseline (PRE)**: 1457 / 103 / 0 / 0 (restored before run)

## Result

```
eligible=120 processed=120 promoted=120 passedOut=0 skipped=0 failed=0 retryable=0
durationMs=77006 wallMs=77007 studentsPerSec=1.56
failureReasons=[]
```

## Lock stats

```
acquisitions=210 waitMinMs=94 waitAvgMs=387 waitMaxMs=1023 waitP95Ms=719
lockTimeouts=0 deadlocks=0 mutexFailures=0 retryAttempts=90
```

Contention becomes visible: all 120 students funnel into **one** target section
(`seed_sec_2627_g05_a`), so all 3 workers serialize on a single mutex key. Average wait
grows to ~0.39 s; p95 ~0.72 s; **no timeouts, no deadlocks**. Wall drops from 164.6 s to
77.0 s (2.1× at 3× workers — the single-section funnel limits scaling, see
`runtime-comparison.md`).

## Verification

- DUPLICATE-ROLL PASS=true
- NULL ROLL COUNT=0 @ 2026-08-05T05:53:37.882Z
- Target section `seed_sec_2627_g05_a`: assigned=120, unique=120

Raw output: `terminal-output.txt` (lines 84–165).
