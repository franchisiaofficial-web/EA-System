# PASSED_OUT Path — Negative Control (g14 → Passed Out) & Regression

- **RUN_ID**: `passout-g14-w6` — started `2026-08-05T06:06:48.032Z`
- **Scope**: `seed_cls_2526_g14` (120 eligible; the **top grade** → auto-graduate to
  PASSED_OUT) at workers=6 — baseline 1457 / 103 / 0 / 0

```
eligible=120 processed=120 promoted=0 passedOut=120 skipped=0 failed=0 retryable=0
durationMs=17612 wallMs=17614 studentsPerSec=6.81
failureReasons=[]
```

Lock stats:

```
acquisitions=0 waitMinMs=0 waitAvgMs=0 waitMaxMs=0 waitP95Ms=0
lockTimeouts=0 deadlocks=0 mutexFailures=0 retryAttempts=0
```

## Why this matters

`passOutStudent` copies `finalRollNumber` into `passed_out_records` and updates student
status — it **allocates no roll**, so it must never touch the section mutex. This run is
the negative control:

- **acquisitions = 0** with 120 students processed — the pass-out path provably never
  enters the critical section (no lock, no retry, fastest observed rate 6.81 students/s);
- 120 passed-out records created, 120 students → PASSED_OUT;
- no target-year enrollments created (they graduate, not promote);
- DUPLICATE-ROLL PASS=true; NULL ROLL COUNT=0 @ 06:07:07.680Z.

Post: ay2526_active=1337, ay2627_active=103 (unchanged — no target rows for g14),
passed_out_records=120, students_passed_out=120. Raw: `terminal-output.txt`
(lines 418–500).
