# Workers = 1 — Scoped Run (g04 → g05)

- **RUN_ID**: `workers-1` — started `2026-08-05T05:48:54.482Z`
- **Scope**: `seed_cls_2526_g04` (120 eligible — the exact class that produced **23/120
  failures** pre-fix at workers=6; here single-threaded)
- **Baseline (PRE)**: ay2526_active=1457, ay2627_active=103, passed_out_records=0,
  students_passed_out=0
- **Post**: ay2526_active=1337, ay2627_active=223, passed_out_records=0, students_passed_out=0

## Result

```
eligible=120 processed=120 promoted=120 passedOut=0 skipped=0 failed=0 retryable=0
durationMs=164584 wallMs=164586 studentsPerSec=0.73
failureReasons=[]
```

## Lock stats

```
acquisitions=210 waitMinMs=78 waitAvgMs=104 waitMaxMs=409 waitP95Ms=108
lockTimeouts=0 deadlocks=0 mutexFailures=0 retryAttempts=90
```

At workers=1 the lock is uncontended: acquisition wait (78–409 ms) is the
`set_config` + advisory-lock round trip on the local connection; avg 104 ms. All 90
structural carry-over collisions recovered on the first retry attempt.

## Verification

- DUPLICATE-ROLL PASS=true (assigned_rolls == unique_rolls for every section)
- NULL ROLL COUNT=0 @ 2026-08-05T05:51:41.145Z
- Target section `seed_sec_2627_g05_a`: assigned=120, unique=120

Raw output (SQL + full section dump): `terminal-output.txt` (lines 1–83).
