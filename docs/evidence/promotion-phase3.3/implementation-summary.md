# Phase 3.3 — SectionAssignmentStrategy: Implementation Summary

**Status: COMPLETE (PRESERVE_SECTION default; correctness verified — see the other deliverables in this directory)**

## Objective

Previously the promotion engine mapped **every** promoted student into the target
class's first active section (section A), merging all source sections into one
target section — the SECTION_MERGE root cause (see `promotion-phase3-precondition/failure-breakdown.md`:
SECTION_MERGE was 95.8% of roll collisions and affected 72.4% of students).
Phase 3.3 introduces a per-school section-resolution strategy seam; the default
strategy `PRESERVE_SECTION` keeps a student's section letter across promotion
(e.g. source "B" → target "B").

## 1. New module: `src/services/promotion/section-assignment-strategy.ts`

### Interface (lines 13–66)

- `SectionAssignmentStrategyId` — `'PRESERVE_SECTION' | 'BALANCE_CAPACITY' | 'ROUND_ROBIN' | 'MANUAL'`.
- `SectionAssignmentSource` — minimal per-student view: `studentId`, `sectionId`,
  `sectionName` (raw letter/name), `rollNumber`.
- `SectionAssignmentTarget` — batch snapshot of the target class: `classId`,
  `firstSectionId`, `sectionsById`, `sectionsByName` (ACTIVE sections only),
  `capacityById`, `occupancyById` (ACTIVE target-enrollment count at batch start).
- `SectionAssignmentStrategy` — two methods:
  - `resolveTargetSection(source, target): string | null` — must be
    deterministic for identical inputs.
  - `auditMarkers(source, target): SectionAssignmentAuditMarkers | undefined` —
    fallback reasons recorded into the promote audit `after` payload.

### PRESERVE_SECTION (lines 103–114)

Resolution order (`resolvePreserve`, lines 83–101):

1. Source has a section name that **matches** an ACTIVE target section name
   (case-sensitive letter match, e.g. "B" → "B"):
   - target occupancy `<` capacity → **matched section** (no marker).
   - target occupancy `>=` capacity → **overflow fallback** to
     `firstSectionId`, marker `{ sectionOverflowFallback: true }`.
2. Source has a section name with **no matching** target section (target class
   has fewer sections, or renamed sections) → `firstSectionId`, marker
   `{ sectionFallback: 'no_matching_section' }`.
3. Source has **no section** (un-sectioned enrollment) → `firstSectionId`, no
   marker (pre-3.3 behavior).

No capacity-balancing logic (explicitly out of scope this phase).

### Stubs (lines 122–142)

`BALANCE_CAPACITY`, `ROUND_ROBIN`, `MANUAL` are interface-shaped stubs whose
`resolveTargetSection` throws `notImplemented`. Nothing in this phase can reach them.

### Per-school registry (lines 153–164)

`getSectionAssignmentStrategy(schoolId)` returns the registered strategy or
`PRESERVE_SECTION` by default; `registerSectionAssignmentStrategy(schoolId, strategy)`
allows future per-school overrides **without touching `promotion-service.ts`**.

## 2. Wiring in `src/services/promotion/promotion-service.ts`

- **Import** (line 10) — `getSectionAssignmentStrategy`, `SectionAssignmentStrategy`,
  `SectionAssignmentTarget`.
- **Batch snapshot** (lines 248–265) — the snapshot query now also loads ACTIVE
  target sections (ordered by name; `ids[0]` becomes `firstSectionId`) and counts
  ACTIVE target enrollments per section into `occupancyById`. Built **once per batch**.
- **Strategy resolution** (line 345) — `const strategy = getSectionAssignmentStrategy(input.schoolId)`.
- **`nextClassByGrade` / `fallbackTarget`** — now map grade → `{ classId }` only.
  The section is no longer baked into the grade-resolution branch (line 388 no
  longer writes `toSectionId`). **Section selection is the strategy's job.**
- **`processOne` single resolution point** (lines 614–625):
  `const targetSectionId = toSectionId ?? args.strategy.resolveTargetSection(src, targetInfo) ?? null;`
  — **the exact same value is used as the mutex key and as the written section**
  (`withRlsForRetry(...)` and the audit payload both receive `targetSectionId`).
  `assignmentMarkers` are derived only when no explicit `toSectionId` was given
  (line 625) and merged into the promote audit via `...(assignmentMarkers ?? {})`
  (line 682).
- **Retry path** (lines 732–760, 848) — `retryWithFreeRoll` re-resolves the
  section **through the strategy** (`item.toSectionId ?? args.strategy.resolveTargetSection(...)`,
  line 740), so a retried write locks the same section key as the original attempt;
  markers are forwarded into `withRlsForRetry` (line 750) and the retry audit
  records `rollCollisionRecovery: true` plus the markers (line 848).
- **No conditional branching on the strategy anywhere in the call site** —
  `processOne` and `retryWithFreeRoll` depend only on the interface. Verified by
  inspection: the only `firstSectionId` occurrences left are in the profiling
  mappings block (line 465, TASK-1.7 analysis output) and inside the strategy module.

## 3. Audit-trail markers

- `sectionOverflowFallback: true` — overflow fallback per student.
- `sectionFallback: 'no_matching_section'` — no same-named target section.
- Both are merged into the promote audit `after` payload; audit **granularity is
  unchanged (one audit per student)** — no extra audit rows, verified 1:1 in all
  scenarios.

## 4. Explicitly out of scope

- Sibling placement, teacher-follows-class, manual-override UI, historical
  migration, capacity balancing — all deferred; stubs provide the seam.

## 5. Static verification

- `npx tsc --noEmit` — clean for `src/**` (only pre-existing errors in legacy
  `docs/evidence/tmp-*.ts` scripts, untouched).
- ESLint clean on the changed files.

## 6. Scenario verification (summary)

| Scenario                         | Outcome | Mutex keys    | Distribution | Markers                        |
| -------------------------------- | ------- | ------------- | ------------ | ------------------------------ |
| primary (g07→g08)                | PASS    | 3 (A/B/C)     | 40/40/40     | none                           |
| fallback (g05→g06, C inactive)   | PASS    | 2 (A/B)       | 80/40/0      | `no_matching_section` = 40     |
| overflow (g03→g04, B capacity 0) | PASS    | 2 (A/C)       | 80/0/40      | `sectionOverflowFallback` = 40 |
| regression (g11→g12)             | PASS    | 3 (A/B/C)     | 40/40/40     | none                           |
| passout (g14, no target writes)  | PASS    | 0 (by design) | —            | none                           |

Full evidence: `section-preservation-verification.md`, `mutex-key-verification.md`,
`duplicate-roll-check.md`, `null-roll-report.md`, `regression-results.txt`.
