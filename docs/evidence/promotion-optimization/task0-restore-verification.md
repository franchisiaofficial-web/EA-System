# TASK 0.4 + 0.6 — Baseline Verification & Restore Verification

**Status**: OBSERVED — VERIFIED

## Full restore cycle demonstrated

### 1. Pre-restore state (dirty — post-test artifact)

Captured at 2026-08-03T15:16:39 UTC.

| Metric                    | Value                                     |
| ------------------------- | ----------------------------------------- |
| 2025-2026 ACTIVE          | 28                                        |
| 2025-2026 PROMOTED        | 1,309                                     |
| 2025-2026 PASSED_OUT      | 120                                       |
| 2026-2027 ACTIVE          | 1,412                                     |
| PassedOutRecords          | 120                                       |
| Students PASSED_OUT       | 120                                       |
| Academic year 2526 status | ACTIVE / is_active=true / is_current=true |
| Academic year 2627 status | INACTIVE / is_active=false                |

### 2. Restore executed

```bash
npx tsx docs/evidence/tmp-1.1-restore.ts
```

Restore log:

```
deleted source-year rows for kept 103: 0 (already deleted in prior restore)
deleted target-year (full-run) rows: 1309
restored source-year rows to ACTIVE: 1429
deleted passed_out_records: 120
restored student statuses: 120
year flags restored: 2526=1 2627=1
AFTER: {"ay2627_total":103,"ay2526_active":1457,"ay2526_promoted":0,"ay2526_passed_out":0,"passed_out_records":0,"students_passed_out":0}
```

### 3. Post-restore verification

Captured at 2026-08-03T16:10:52 UTC.

| Metric               | Post-restore                                  |
| -------------------- | --------------------------------------------- |
| 2025-2026 ACTIVE     | 1,457                                         |
| 2025-2026 PROMOTED   | 0                                             |
| 2025-2026 PASSED_OUT | 0                                             |
| 2026-2027 ACTIVE     | 103                                           |
| 2024-2025 PROMOTED   | 520                                           |
| PassedOutRecords     | 0                                             |
| Students ACTIVE      | 1,567                                         |
| Students PASSED_OUT  | 0                                             |
| Students ARCHIVED    | 2                                             |
| Academic year 2526   | ACTIVE / is_active=true / is_current=true     |
| Academic year 2627   | INACTIVE / is_active=false / is_current=false |

## Reconciliation check

| Check                                            | Result          |
| ------------------------------------------------ | --------------- |
| 2025-2026 total = ACTIVE + PROMOTED + PASSED_OUT | 1,457 = 1,457 ✓ |
| 2026-2027 ACTIVE                                 | 103 ✓           |
| Total ACTIVE enrollments = 1457 + 103            | 1,560 ✓         |
| PassedOutRecords = 0                             | ✓               |
| Students PASSED_OUT = 0                          | ✓               |
| Academic year flags match expected               | ✓               |
| 2025-2026 is_active = true                       | ✓               |
| 2026-2027 is_active = false                      | ✓               |

## Baseline vs. Restored comparison

| Metric               | Baseline expectation | Restored value | Match |
| -------------------- | -------------------- | -------------- | ----- |
| 2025-2026 ACTIVE     | 1,457                | 1,457          | ✓     |
| 2025-2026 PROMOTED   | 0                    | 0              | ✓     |
| 2025-2026 PASSED_OUT | 0                    | 0              | ✓     |
| 2026-2027 ACTIVE     | 103                  | 103            | ✓     |
| PassedOutRecords     | 0                    | 0              | ✓     |
| Students PASSED_OUT  | 0                    | 0              | ✓     |

**Result**: All counts IDENTICAL. Restore procedure produces consistent, repeatable baseline state.
