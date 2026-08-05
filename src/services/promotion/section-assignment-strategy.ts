// ============================================
// Phase 3.3 — SectionAssignmentStrategy
//
// The promotion engine used to map EVERY promoted student into the target
// class's first active section (section A), merging all source sections into
// one target section (SECTION_MERGE root cause — failure-breakdown.md). This
// module defines the section-resolution strategy seam: promotion-service.ts
// depends ONLY on the SectionAssignmentStrategy interface, never on a concrete
// strategy. Future strategies (BALANCE_CAPACITY, ROUND_ROBIN, MANUAL) plug in
// through the per-school registry without touching the call site.
// ============================================

export type SectionAssignmentStrategyId =
  'PRESERVE_SECTION' | 'BALANCE_CAPACITY' | 'ROUND_ROBIN' | 'MANUAL';

/** Minimal per-student view of the source enrollment the strategy may use. */
export interface SectionAssignmentSource {
  studentId: string;
  sectionId: string | null;
  /** Raw section name (e.g. "A", "B", "C"); null when the source enrollment
   *  has no section. */
  sectionName: string | null;
  rollNumber: string | null;
}

/** Batch-snapshot view of the target class the strategy may consult. Built
 *  once per batch from ACTIVE target sections; occupancy is the batch-start
 *  count of ACTIVE target enrollments per section. */
export interface SectionAssignmentTarget {
  classId: string;
  firstSectionId: string | null;
  /** sectionId -> section name (ACTIVE sections only). */
  sectionsById: ReadonlyMap<string, string>;
  /** section name -> sectionId (ACTIVE sections only). */
  sectionsByName: ReadonlyMap<string, string>;
  /** sectionId -> capacity (schema default 40). */
  capacityById: ReadonlyMap<string, number>;
  /** sectionId -> ACTIVE enrollment count at batch start. */
  occupancyById: ReadonlyMap<string, number>;
}

/** Audit markers describing HOW a section was resolved. Written into the
 *  promote audit's `after` payload so fallback cases are visible in the
 *  audit trail (e.g. { sectionOverflowFallback: true }). */
export type SectionAssignmentAuditMarkers = Record<string, boolean | string>;

export interface SectionAssignmentStrategy {
  readonly id: SectionAssignmentStrategyId;
  /**
   * Resolves the target section for one student. MUST be deterministic for
   * identical inputs (the audit-marker derivation re-runs it).
   * Returns null when the target class has no usable section.
   */
  resolveTargetSection(
    source: SectionAssignmentSource,
    target: SectionAssignmentTarget
  ): string | null;
  /** Audit markers describing how the section was resolved (fallback reasons). */
  auditMarkers(
    source: SectionAssignmentSource,
    target: SectionAssignmentTarget
  ): SectionAssignmentAuditMarkers | undefined;
}

// ============================================
// PRESERVE_SECTION — the only implementation built in Phase 3.3
//
//   - Match the source section's name/letter to a target section with the
//     same name/letter (e.g. source "B" -> target "B").
//   - No matching-named target section (target class has fewer sections, or a
//     custom name) -> fall back to firstSectionId.
//   - Matched target section at capacity (occupancy >= capacity at batch
//     start) -> overflow fall back to firstSectionId, with a DISTINCT audit
//     marker (sectionOverflowFallback) per overflowing student.
//   - No capacity-balancing logic (out of scope this phase).
// ============================================

type PreserveFallbackReason = 'overflow' | 'no_matching_section' | null;

function resolvePreserve(
  source: SectionAssignmentSource,
  target: SectionAssignmentTarget
): { sectionId: string | null; reason: PreserveFallbackReason } {
  if (source.sectionName) {
    const matched = target.sectionsByName.get(source.sectionName);
    if (matched) {
      const occupancy = target.occupancyById.get(matched) ?? 0;
      const capacity = target.capacityById.get(matched) ?? 0;
      if (occupancy >= capacity) {
        return {
          sectionId: target.firstSectionId ?? matched,
          reason: 'overflow',
        };
      }
      return { sectionId: matched, reason: null };
    }
  }
  // No source section (un-sectioned enrollment) or no matching name in the
  // target class -> first active section (pre-3.3 behavior as the fallback).
  return {
    sectionId: target.firstSectionId,
    reason: source.sectionName ? 'no_matching_section' : null,
  };
}

export const PRESERVE_SECTION: SectionAssignmentStrategy = {
  id: 'PRESERVE_SECTION',
  resolveTargetSection(source, target) {
    return resolvePreserve(source, target).sectionId;
  },
  auditMarkers(source, target): SectionAssignmentAuditMarkers | undefined {
    const { reason } = resolvePreserve(source, target);
    if (reason === 'overflow') return { sectionOverflowFallback: true };
    if (reason === 'no_matching_section')
      return { sectionFallback: 'no_matching_section' };
    return undefined;
  },
};

// ============================================
// Stubs for future strategies (interface shape only — NOT implemented).
// Registered through the per-school registry once implemented in a later
// phase; nothing here is reachable in Phase 3.3.
// ============================================

const notImplemented = (id: SectionAssignmentStrategyId) => () => {
  throw new Error(
    `SectionAssignmentStrategy ${id} is not implemented (stub only)`
  );
};

export const BALANCE_CAPACITY: SectionAssignmentStrategy = {
  id: 'BALANCE_CAPACITY',
  resolveTargetSection: notImplemented('BALANCE_CAPACITY'),
  auditMarkers: () => undefined,
};

export const ROUND_ROBIN: SectionAssignmentStrategy = {
  id: 'ROUND_ROBIN',
  resolveTargetSection: notImplemented('ROUND_ROBIN'),
  auditMarkers: () => undefined,
};

export const MANUAL: SectionAssignmentStrategy = {
  id: 'MANUAL',
  resolveTargetSection: notImplemented('MANUAL'),
  auditMarkers: () => undefined,
};

// ============================================
// Per-school resolution registry
//
// The strategy is resolvable per school (schoolId-scoped), not hardcoded
// globally. Default: PRESERVE_SECTION for every school. Future per-school
// overrides land here via registerSectionAssignmentStrategy without any
// change to promotion-service.ts.
// ============================================

const registry = new Map<string, SectionAssignmentStrategy>();

export function getSectionAssignmentStrategy(
  schoolId: string
): SectionAssignmentStrategy {
  return registry.get(schoolId) ?? PRESERVE_SECTION;
}

export function registerSectionAssignmentStrategy(
  schoolId: string,
  strategy: SectionAssignmentStrategy
): void {
  registry.set(schoolId, strategy);
}
