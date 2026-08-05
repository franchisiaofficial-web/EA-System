# Phase 3.3 — Overflow Scenario: Eligibility & Section-Count Explanation

**Why `eligible = 115` (not 120) in the overflow scenario**

The overflow scenario promotes `seed_cls_2526_g03` (Grade 1, 2025–26) into
`seed_cls_2627_g04` (Grade 2, 2026–27) with `seed_sec_2627_g04_b` capacity
forced to 0.

`eligibleStudents = 115` because the **source class has only 115 ACTIVE
students**, not because of the capacity tweak:

```
seed_sec_2526_g03_a | 35 students
seed_sec_2526_g03_b | 40 students
seed_sec_2526_g03_c | 40 students
                    ----------
                   115 total
```

This is seed-data distribution (Grade 1 section A holds 35, not 40 — the only
class with a non-full A section). Verified in the raw duplicate-roll output of
every scenario: `seed_sec_2526_g03_a | assigned_rolls=35 | unique_rolls=35`.
The job/batch rows confirm it: `eligible=115 processed=115 promoted=115`.

**Why target Section A ended at 80 students**

```
seed_cls_2627_g04 | Section A : 80 students (seed_sec_2627_g04_a)
seed_cls_2627_g04 | Section C : 40 students (seed_sec_2627_g04_c)
```

80 = 35 (source A, name-matched → A) + 40 (source B, matched B but B capacity
0 → OVERFLOW fallback to firstSectionId = A) + 5 (pre-existing ACTIVE 2026–27
enrollments in g04_a, part of the certified 103 baseline).

Two verifications this composition implies:

1. **Occupancy snapshot correctness** — source-A students entered A without
   overflow even though the 5 pre-existing students were already counted
   (5 + 35 = 40 = capacity; entry was allowed because each student was checked
   against batch-start occupancy before its own insert).
2. **Capacity-0 B never touched** — B received 0 students, was never locked
   (mutex-key evidence: `seed_sec_2627_g04_b ... observed=false`) and was
   never written (written sections: `g04_a, g04_c` only).

**Why the overflow marker counts match exactly 40**

Every source-B student produced exactly one audit row containing
`sectionOverflowFallback: true`; source-A and source-C students produced none:

```
sectionOverflowFallback=true audits: 40
```

40 = the 40 source-B students. Audit granularity stays 1 audit per student
(115 promote audits == 115 promoted, reconciliation 1:1).
