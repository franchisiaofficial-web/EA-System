# Section Assignment Fix Proposal

**Status**: **PROPOSED — NOT IMPLEMENTED — REQUIRES BALAJI APPROVAL**

---

## Current Behavior

The promotion engine maps every student from a source class into the target class's **first active section** (always section A). The logic is in `processOne` in `promotion-service.ts`:

```typescript
const targetSectionId = toSectionId ?? targetInfo.firstSectionId ?? null;
```

With 3 source sections per grade (A, B, C) and all 3 feeding into 1 target section (A), this creates **~1,050 roll-number collisions** per full-school promotion run — consuming 50-60% of total runtime in collision recovery.

### OBSERVED — VERIFIED: 72.4% of students (1,055/1,457) hit a roll-number collision on their first `enrollment.create`. 95.8% of collisions are SECTION_MERGE (3 source sections → 1 target section).

---

## Proposed Behavior

When resolving the target section, **match the source section letter** where possible:

```
Source Grade 5, Section A → Target Grade 6, Section A
Source Grade 5, Section B → Target Grade 6, Section B
Source Grade 5, Section C → Target Grade 6, Section C
```

The target class already has sections A, B, C created (seed data creates 3 active sections per class). The change is purely in the section-selection logic — no schema changes, no new sections needed.

### Implementation sketch

In `processOne`, replace `targetInfo.firstSectionId` with a function that maps source section name → target section:

```typescript
function resolveTargetSection(targetInfo, sourceSectionName) {
  // Try matching source section letter
  const match = targetInfo.sectionIdsByName?.get(sourceSectionName);
  if (match) return match;
  // Fall back to first section
  return targetInfo.firstSectionId;
}
```

The snapshot already loads section data (`targetClassById` contains `sectionIds`). Extend it to also index by section name for O(1) lookup.

---

## Observable User-Visible Changes

| Aspect                    | Current                                 | Proposed                               |
| ------------------------- | --------------------------------------- | -------------------------------------- |
| **Section assignment**    | All students → Section A                | Students → their source letter section |
| **Section A enrollments** | 120 students (all from A/B/C)           | 40 students (only from source A)       |
| **Section B enrollments** | 0                                       | 40 students (from source B)            |
| **Section C enrollments** | 0                                       | 40 students (from source C)            |
| **Roll numbers**          | A: 1-40, B: 41-79, C: 42-80 (scattered) | A: 1-40, B: 1-40, C: 1-40 (preserved)  |
| **Roll collisions**       | 1,050+                                  | Near zero                              |
| **Promotion duration**    | ~300-420s                               | Estimated ~40-60s                      |

### What DOESN'T change

- Student remains in the same grade level (just promoted to next grade)
- The target class is unchanged (determined by grade-level progression)
- Roll numbers are preserved (student keeps their source roll number)
- Grade 12 students still auto-graduate to PASSED_OUT

---

## Performance Impact

| Metric                     | Current (6 workers)    | Proposed (6 workers) | Reduction |
| -------------------------- | ---------------------- | -------------------- | --------- |
| Collisions                 | 1,050+ first-create    | ~0-10                | ~99%      |
| Retry students             | ~1,000                 | ~0                   | ~100%     |
| Total runtime              | ~300-420s              | ~40-60s (est)        | ~85%      |
| DB round trips             | ~9,000-14,000          | ~4,400               | ~60%      |
| Connection pool contention | High (retries compete) | None                 | 100%      |

---

## Benefits

1. **Eliminates 95.8% of collisions.** The retry path becomes cold code (kept as safety net).
2. **Preserves student section continuity.** Students stay with their section letter across years.
3. **Preserves roll-number continuity.** Each student keeps their assigned roll number.
4. **Natural section balancing.** Each target section receives exactly one source section's students (equal distribution).
5. **Zero schema changes.** Target sections already exist; this is purely an algorithm change.
6. **Removes the need for bulk-write optimization.** With 0 collisions, per-student transactions are fast enough (~40s total).

---

## Risks

1. **Section capacity limits.** If a target section has a lower capacity than source section enrollment (e.g., 35 capacity but 40 students), the engine must handle the overflow. Currently the seed has uniform capacity (40 per section), so this is a theoretical risk.

2. **Section letter name format.** Source section names must be parseable to extract a letter (e.g., "A", "B", "C"). The current seed uses standard letters. Custom section names could break the match.

3. **Backward compatibility.** Existing promoted students (from before this fix) are all in section A with scattered rolls 41-80. Re-running promotion would not redistribute them (they're already PROMOTED). This only affects new promotions.

4. **Side effect on roll-number unique index.** The existing `enrollments_target_roll_active_key` index would have zero violations after this fix (no collisions), making the index mostly dormant.

---

## Open Business Questions

These must be answered before implementation:

1. **Section balancing**: Should each target section receive exactly one source section? Or should students be distributed evenly (e.g., round-robin assignment)? The letter-match approach preserves continuity but may create uneven section sizes if source sections have different student counts (e.g., Pre-KG A=14, B=13, C=13).

2. **Sibling placement**: Does the school have a policy of placing siblings in the same section? If yes, the simple letter-match would break that policy.

3. **Teacher allocation**: Are teachers assigned to specific sections? If a teacher follows their class from one year to the next, moving students across sections affects their roster.

4. **Administrator overrides**: Should administrators be able to manually assign a student to a different section during promotion? Currently, the UI has a "Transfer" action that allows explicit class selection but not section selection.

5. **Capacity constraints**: What happens when a target section is full? Should the engine fall back to the next available section, or reject the promotion?

6. **Edge case — single-section classes**: If a target class has only 1 section (e.g., a small school), the current behavior (all → section A) is the only option. The fallback handles this.

7. **Historical data**: Should already-promoted students (all in section A with rolls 41-80) be migrated to their correct sections? This would require a one-time data migration.

---

## Decision Required

| Question                                       | Options                                           |
| ---------------------------------------------- | ------------------------------------------------- |
| Approve section-letter matching?               | Yes / No / With modifications                     |
| Overflow handling strategy?                    | Fallback to next section / Reject / Manual review |
| Data migration for existing promoted students? | Yes / No (only new promotions)                    |
| Administrator override UI needed?              | Yes / No (MVP: automatic only)                    |
