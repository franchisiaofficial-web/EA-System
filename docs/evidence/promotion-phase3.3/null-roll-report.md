# Phase 3.3 — NULL-Roll Report (raw SQL evidence)

**Verdict: PASS — zero ACTIVE enrollments with a NULL `roll_number` after every Phase 3.3 scenario.**

## SQL executed (identical across all scenarios)

```sql
SELECT
COUNT(*)
FROM enrollments
WHERE
status='ACTIVE'
AND roll_number IS NULL;
```

## Raw database output — per scenario (post-run)

```text
NULL ROLL COUNT (raw): 0 @ ... | scenario=primary
NULL ROLL COUNT (raw): 0 @ ... | scenario=fallback
NULL ROLL COUNT (raw): 0 @ ... | scenario=overflow
NULL ROLL COUNT (raw): 0 @ ... | scenario=regression
NULL ROLL COUNT (raw): 0 @ ... | scenario=passout
```

## Notes

- `roll_number` is required for every ACTIVE enrollment; all 1,45x ACTIVE
  source enrollments carried rolls pre-run, and all promoted/passed-out students
  produced non-NULL rolls post-run across every scenario (5 runs).
- The fallback and overflow scenarios exercised heavy roll renumbering under the
  mutex (up to 80 students in one section) — no student ended up without a roll.
- Full raw output retained in `primary-output.txt`, `fallback-output.txt`,
  `overflow-output.txt`, `regression-output.txt`, `passout-output.txt`.
