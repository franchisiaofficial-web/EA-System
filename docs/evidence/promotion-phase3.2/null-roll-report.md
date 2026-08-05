# NULL-Roll Report

## SQL executed (identical in every run)

```sql
SELECT
COUNT(*)
FROM enrollments
WHERE
status='ACTIVE'
AND roll_number IS NULL;
```

## Result: **0 in every run**

| Run             | RUN_ID / timestamp of check               | NULL-roll count |
| --------------- | ----------------------------------------- | --------------- |
| workers=1       | workers-1 @ 2026-08-05T05:51:41.145Z      | 0               |
| workers=3       | workers-3 @ 2026-08-05T05:53:37.882Z      | 0               |
| workers=6       | workers-6 @ 2026-08-05T05:55:15.372Z      | 0               |
| workers=12      | workers-12 @ 2026-08-05T05:56:50.706Z     | 0               |
| g12→g13         | passout-g12-w6 @ 2026-08-05T06:05:56.918Z | 0               |
| PASSED_OUT      | passout-g14-w6 @ 2026-08-05T06:07:07.680Z | 0               |
| job (workers=6) | JOB REGRESSION @ 2026-08-05T06:15:51Z     | 0               |

Every ACTIVE enrollment carried a non-null roll_number after every run. The harness
includes a fallback branch that lists all null-roll students if the count is non-zero —
it never fired (no null-roll students to report).

The null-roll failure mode (last-resort fallback to a null roll when the retry budget
exhausts) did not occur in any run — the section mutex makes it unreachable under the
tested concurrency (1/3/6/12 workers).
