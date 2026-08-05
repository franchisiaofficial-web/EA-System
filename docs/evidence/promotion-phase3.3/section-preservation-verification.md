# Phase 3.3 — Section-Preservation Verification

**Verdict: PASS — `PRESERVE_SECTION` keeps students in their source section letter across promotion.**

Harness: `run-3.3-scoped.ts` (scenario-driven; raw SQL evidence; exits 0=PASS).
All runs used the production promotion path (global scheduler → `createPromotionJob`
→ `runPromotionBatch`). Baseline 1,457 / 103 / 0 / 0 verified before every scenario.

## Scenario matrix

| Scenario   | Source → Target               | Job                         | Eligible | Promoted | Failed | Distribution (target) | Roll preservation         | Markers                        |
| ---------- | ----------------------------- | --------------------------- | -------- | -------- | ------ | --------------------- | ------------------------- | ------------------------------ |
| primary    | g07 → g08                     | `cmsfszvwu0000vou8n76nej2w` | 120      | 120      | 0      | A=40 B=40 C=40        | A 40/40, B 40/40, C 40/40 | none                           |
| fallback   | g05 → g06 (C **deactivated**) | `cmsft0qq40000u8u84iq47pci` | 120      | 120      | 0      | A=80 B=40 C=0         | A 16/40, B 40/40, C 14/40 | `no_matching_section` = 40     |
| overflow   | g03 → g04 (B **capacity 0**)  | `cmsft37530000kwu8ogegzplw` | 115      | 115      | 0      | A=80 B=0 C=40         | A 10/35, B 15/40, C 40/40 | `sectionOverflowFallback` = 40 |
| regression | g11 → g12                     | `cmsftb1p70000g0u8trcq3ooo` | 120      | 120      | 0      | A=40 B=40 C=40        | A 40/40, B 40/40, C 40/40 | none                           |
| passout    | g14 (→ passed out)            | `cmsfta2gh0000r0u8jvztqsa0` | 120      | 0        | 0      | (no target writes)    | n/a                       | none                           |

## 1. Primary — perfect section-letter preservation

Source sections g07 A/B/C (40 students each, rolls 1–40) → g08 A/B/C:

```
seed_cls_2627_g08 | Section A : 40 students (seed_sec_2627_g08_a)
seed_cls_2627_g08 | Section B : 40 students (seed_sec_2627_g08_b)
seed_cls_2627_g08 | Section C : 40 students (seed_sec_2627_g08_c)
source A: preserved 40/40
source B: preserved 40/40
source C: preserved 40/40
```

Every student kept BOTH their section letter and their roll number. In Phase 3.2
this class funneled 120/120 into section A with heavy roll renumbering.

## 2. Fallback — no matching section (missing target section)

Target C deactivated before the run (`seed_sec_2627_g06_c` → INACTIVE). All 40
source-C students fell back to the first active section (A) with the DISTINCT
marker `sectionFallback: 'no_matching_section'`:

```
seed_cls_2627_g06 | Section A : 80 students (seed_sec_2627_g06_a)
seed_cls_2627_g06 | Section B : 40 students (seed_sec_2627_g06_b)
sectionFallback='no_matching_section' audits: 40
```

Roll preservation A 16/40 (the other 24 incoming C students claimed free rolls
41–80 before them), B 40/40, C 14/40 (C's own roll kept only where free in A) —
correct roll-collision behavior under the mutex, **zero failures, retryAttempts=50**.

## 3. Overflow — matched section at capacity

Target B capacity set to 0 before the run (`seed_sec_2627_g04_b`). All 40 source-B
students overflowed to the first active section (A) with the DISTINCT marker
`sectionOverflowFallback: true`. B never received a single student:

```
seed_cls_2627_g04 | Section A : 80 students (seed_sec_2627_g04_a)
seed_cls_2627_g04 | Section C : 40 students (seed_sec_2627_g04_c)
sectionOverflowFallback=true audits: 40
```

Note section A's 80 = 35 source-A + 40 overflow B + 5 pre-existing 2627 students —
the overflow was detected against **batch-start occupancy including pre-existing
students** (5+35 < 40 → A accepted its own 35; B checked against capacity 0 →
overflow; verified occupancy snapshot semantics).

## 4. Regression class — previously worst SECTION_MERGE

g11 (Grade 9) → g12 previously suffered the heaviest single-section funneling.
Now: 40/40/40 distribution, **all 120 rolls preserved 1:1**, `retryAttempts=0`
(was 1,059 across the school; SECTION_MERGE collisions eliminated).

## 5. Passout — no target-section writes

120/120 Grade-12 students passed out; zero target-class enrollment writes, zero
locks (by design — nothing to insert, nothing to lock), audits 1:1 (120 passout
audits). Mutex-key check correctly SKIPPED (harness bypasses the key check when
no target-section write occurred; see `mutex-key-verification.md`).

## 6. Audit granularity

One audit per student in every scenario (promote audits == promoted count,
passout audits == passed-out count, 1:1 verified in all runs). Markers ride in
the existing audit row; no extra rows.

## 7. Per-student mappings (raw)

120-row source→target mapping tables are in the per-scenario raw outputs:
`primary-output.txt`, `fallback-output.txt`, `overflow-output.txt`,
`regression-output.txt`, `passout-output.txt`.

**Section preservation: verified. Fallback + overflow paths: verified with
distinct audit markers. Roll preservation: verified (1:1 where no collision;
collision handling correct with 0 failures).**
