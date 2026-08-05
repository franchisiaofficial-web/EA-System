# Duplicate-Roll Check — Raw SQL Evidence (all runs)

## SQL executed (identical in every run)

```sql
SELECT
    section_id,
    COUNT(roll_number) AS assigned_rolls,
    COUNT(DISTINCT roll_number) AS unique_rolls
FROM enrollments
WHERE
status='ACTIVE'
AND roll_number IS NOT NULL
GROUP BY section_id;
```

## Per-run verdicts (raw counts for the promoted target sections)

| Run             | RUN_ID / timestamp of check               | Target section               | assigned | unique | PASS |
| --------------- | ----------------------------------------- | ---------------------------- | -------- | ------ | ---- |
| workers=1       | workers-1 @ 2026-08-05T05:51:41.145Z      | seed_sec_2627_g05_a          | 120      | 120    | ✓    |
| workers=3       | workers-3 @ 2026-08-05T05:53:37.882Z      | seed_sec_2627_g05_a          | 120      | 120    | ✓    |
| workers=6       | workers-6 @ 2026-08-05T05:55:15.372Z      | seed_sec_2627_g05_a          | 120      | 120    | ✓    |
| workers=12      | workers-12 @ 2026-08-05T05:56:50.706Z     | seed_sec_2627_g05_a          | 120      | 120    | ✓    |
| g12→g13         | passout-g12-w6 @ 2026-08-05T06:05:56.918Z | seed_sec_2627_g13_a          | 120      | 120    | ✓    |
| PASSED_OUT      | passout-g14-w6 @ 2026-08-05T06:07:07.680Z | (no target rows)             | —        | —      | ✓    |
| job (workers=6) | JOB REGRESSION @ 2026-08-05T06:15:51Z     | (via harness, dup PASS=true) | —        | —      | ✓    |

`DUPLICATE-ROLL PASS=true (assigned_rolls == unique_rolls for EVERY section: yes)` in
every run — including every pre-existing 2526/2627 section (39 sections checked per run,
e.g. `seed_sec_2526_g03_b` 40/40, `seed_sec_2627_g01_a` 37/37, etc.).

## Full raw output

The complete section-by-section dump (39 rows per run, raw DB output with run id and
timestamp) is in `terminal-output.txt`:

- workers-1: lines 1–83
- workers-3: lines 84–165
- workers-6: lines 166–248
- workers-12: lines 249–330
- passout-g12-w6: lines 336–417
- passout-g14-w6: lines 418–500

## Pre-fix contrast

Pre-fix, the same SQL at workers=6 exposed roll collisions via the P2002 path
(23/120 direct failures, `failure-breakdown.md` §4). Post-fix: 0 failures, 0 duplicates,
all six runs.
