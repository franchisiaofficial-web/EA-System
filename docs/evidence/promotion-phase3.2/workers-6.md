# Workers = 6 — Scoped Runs (g04 → g05 **and** g12 → g13)

## Run A — `workers-6`, g04 → g05 (the pre-fix failing class)

- Started `2026-08-05T05:54:05.987Z` — baseline 1457 / 103 / 0 / 0
- Pre-fix reproduction on this class at workers=6: **23/120 failed**
  (`failure-breakdown.md` §4, direct path).

```
eligible=120 processed=120 promoted=120 passedOut=0 skipped=0 failed=0 retryable=0
durationMs=67173 wallMs=67174 studentsPerSec=1.79
failureReasons=[]
```

Lock stats:

```
acquisitions=210 waitMinMs=101 waitAvgMs=1149 waitMaxMs=1866 waitP95Ms=1842
lockTimeouts=0 deadlocks=0 mutexFailures=0 retryAttempts=90
```

**Headline result: 120/120 promoted, 0 failed — the exact scenario that failed 23/120
pre-fix.** All 90 collisions recovered first-try under the mutex.

Verification: DUPLICATE-ROLL PASS=true; NULL ROLL COUNT=0 @ 05:55:15.372Z;
`seed_sec_2627_g05_a` assigned=120 unique=120.
Raw: `terminal-output.txt` (lines 166–248).

## Run B — `passout-g12-w6` label, actual g12 → g13 (second promoted class at workers=6)

- Started `2026-08-05T06:04:47.955Z` — baseline restored 1457 / 103 / 0 / 0
- (The RUN_ID label says "passout" but this class is **not** the top grade — it promoted
  g12 → g13. The genuine PASSED_OUT control is the g14 run, see `passout-g14-w6.md`.)

```
eligible=119 processed=119 promoted=119 passedOut=0 skipped=0 failed=0 retryable=0
durationMs=67071 wallMs=67071 studentsPerSec=1.77
failureReasons=[]
```

Lock stats:

```
acquisitions=209 waitMinMs=101 waitAvgMs=1155 waitMaxMs=1945 waitP95Ms=1844
lockTimeouts=0 deadlocks=0 mutexFailures=0 retryAttempts=90
```

Verification: DUPLICATE-ROLL PASS=true; NULL ROLL COUNT=0 @ 06:05:56.918Z;
`seed_sec_2627_g13_a` assigned=120 unique=120 (119 promoted + 1 pre-existing).
Raw: `terminal-output.txt` (lines 336–417).

**Observation:** a second distinct promote transition (g12 → g13) at workers=6 shows an
identical contention profile (avg ~1.2 s wait, single target section funnel, 0 failures) —
the mutex is class-agnostic.
