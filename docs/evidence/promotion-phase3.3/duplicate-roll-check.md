# Phase 3.3 — Duplicate-Roll Check (raw SQL evidence)

**Verdict: PASS — every active section has `assigned_rolls == unique_rolls` (no roll_number duplicates) after every Phase 3.3 scenario.**

## SQL executed (identical across all scenarios)

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

## Raw database output — regression scenario (g11 → g12), post-run

```text
fixture_sec_b_g01_a | assigned_rolls=1     | unique_rolls=1     | OK
seed_sec_2526_g00_a | assigned_rolls=3     | unique_rolls=3     | OK
seed_sec_2526_g01_a | assigned_rolls=8     | unique_rolls=8     | OK
seed_sec_2526_g01_b | assigned_rolls=2     | unique_rolls=2     | OK
seed_sec_2526_g02_a | assigned_rolls=8     | unique_rolls=8     | OK
seed_sec_2526_g02_b | assigned_rolls=2     | unique_rolls=2     | OK
seed_sec_2526_g03_a | assigned_rolls=35    | unique_rolls=35    | OK
seed_sec_2526_g03_b | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g03_c | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g04_a | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g04_b | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g04_c | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g05_a | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g05_b | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g05_c | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g06_a | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g06_b | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g06_c | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g07_a | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g07_b | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g07_c | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g08_a | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g08_b | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g08_c | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g09_a | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g09_b | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g09_c | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g10_a | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g10_b | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g10_c | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g12_a | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g12_b | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g12_c | assigned_rolls=39    | unique_rolls=39    | OK
seed_sec_2526_g13_a | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g13_b | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g13_c | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g14_a | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g14_b | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2526_g14_c | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2627_g01_a | assigned_rolls=37    | unique_rolls=37    | OK
seed_sec_2627_g02_a | assigned_rolls=30    | unique_rolls=30    | OK
seed_sec_2627_g03_a | assigned_rolls=30    | unique_rolls=30    | OK
seed_sec_2627_g04_a | assigned_rolls=5     | unique_rolls=5     | OK
seed_sec_2627_g12_a | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2627_g12_b | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2627_g12_c | assigned_rolls=40    | unique_rolls=40    | OK
seed_sec_2627_g13_a | assigned_rolls=1     | unique_rolls=1     | OK
DUPLICATE-ROLL PASS=true
```

## Stress cases confirmed by this check

- **Overflow scenario**: section g04_a reached 80 students (35 source-A + 40
  overflow from B + 5 pre-existing) yet reported `assigned_rolls=80 |
unique_rolls=80` — all 80 rolls distinct.
- **Fallback scenario**: g06_a = 80 (40 source-A + 40 fallback from C),
  reported `80 | 80` distinct.
- **Regression (roll-collision) class**: g12 A/B/C each `40 | 40` with rolls
  preserved 1:1.

Raw output per scenario archived in `primary-output.txt`, `fallback-output.txt`,
`overflow-output.txt`, `regression-output.txt`, `passout-output.txt`.
