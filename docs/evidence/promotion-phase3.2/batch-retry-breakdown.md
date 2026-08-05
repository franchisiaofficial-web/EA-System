# Batch Retry Breakdown — Phase 3.2B Connection-Light Full-School Run

Source: `audit_logs.where(entity='enrollment', action='promote', after->>'rollCollisionRecovery'='true')` grouped by `after->>'classId'`, in the run window.

## Raw query

```sql
SELECT after->>'classId' AS target_class_id, COUNT(*)::int AS retry_successes FROM audit_logs
WHERE school_id='seed_school_ea' AND entity='enrollment' AND action='promote'
AND after->>'fromAcademicYearId'='seed_ay_2526' AND after->>'toAcademicYearId'='seed_ay_2627'
AND after->>'rollCollisionRecovery'='true' AND created_at >= $1::timestamptz GROUP BY 1 ORDER BY 1;
```

## Per-batch retry successes

| Target class      | promoted | retrySuccesses | retryFailures |
| ----------------- | -------- | -------------- | ------------- |
| seed_cls_2627_g01 | 3        | 3              | 0             |
| seed_cls_2627_g02 | 10       | 10             | 0             |
| seed_cls_2627_g03 | 10       | 10             | 0             |
| seed_cls_2627_g04 | 115      | 91             | 0             |
| seed_cls_2627_g05 | 120      | 97             | 0             |
| seed_cls_2627_g06 | 120      | 93             | 0             |
| seed_cls_2627_g07 | 120      | 94             | 0             |
| seed_cls_2627_g08 | 120      | 93             | 0             |
| seed_cls_2627_g09 | 120      | 93             | 0             |
| seed_cls_2627_g10 | 120      | 95             | 0             |
| seed_cls_2627_g11 | 120      | 95             | 0             |
| seed_cls_2627_g12 | 120      | 94             | 0             |
| seed_cls_2627_g13 | 119      | 98             | 0             |
| seed_cls_2627_g14 | 120      | 93             | 0             |
| Passed Out        | 0        | 0              | 0             |
| **Σ**             | **1337** | **1059**       | **0**         |

Cross-check: `sum(retrySuccesses) per batch = 1059` and `global retryAttempts counter = 1059` — **exact match**.

Every structural carry-over roll collision recovered successfully under the mutex; zero retry failures in any target section.
