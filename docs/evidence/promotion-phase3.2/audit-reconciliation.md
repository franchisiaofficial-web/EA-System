# Audit Reconciliation — Phase 3.2B Connection-Light Full-School Run

## Raw reconciliation output (harness)

```
eligible==processed: true (1457 == 1457)
processed==promoted+passedOut+failed: true (1457 == 1337+120+0)
promote audits=1337 | pass_out audits=120 | students with >1 promote audit=0
audit 1:1 with job counters: true
missing promote audits (promoted - audits) = 0
missing pass_out audits (passedOut - audits) = 0
```

## Reading

- **1,337** promote audits = **1,337** promoted students (1:1, no missing).
- **120** pass_out audits = **120** passed out students (1:1, no missing).
- **0** students with more than one promote audit in the run window → no double-promotion
  (no duplicate roll) despite 1,059 collision retries.
- Job reconciliation exact: `eligible == processed == promoted + passedOut + failed`,
  with **failed = 0**.

## Controls

- Duplicate-roll invariant: raw SQL PASS, all sections (see `duplicate-roll-check.sql.out`).
- Null-roll probe: 0 (see `null-roll-report.sql.out`).
