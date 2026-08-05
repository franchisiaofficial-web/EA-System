import {
  withRls,
  type RequestContext,
  type PrismaTransactionClient,
} from '@/lib/prisma/rls-middleware';
import type { AuthContext } from '@/lib/auth/context';
import type { Prisma } from '@/generated/prisma/client';
import { profile, profilingEnabled } from './promotion-profile';
import {
  withSectionRollLock,
  countRollRetryAttempt,
} from './promotion-roll-lock';
import {
  getSectionAssignmentStrategy,
  type SectionAssignmentSource,
  type SectionAssignmentStrategy,
} from './section-assignment-strategy';

// ============================================
// Promotion batch orchestration
//
// Transaction model (architectural requirement):
//   - Each student's promotion runs inside its OWN database transaction
//     (withRls = one $transaction with SET LOCAL context). Every WRITE for
//     that student (close source enrollment, create target enrollment,
//     student status, PassedOutRecord, audit log) is atomic: either all
//     succeed or all roll back.
//   - A batch is the aggregation of independent per-student transactions,
//     executed in safe parallel batches (bounded by the connection pool).
//     There is intentionally no single transaction spanning the whole batch
//     (avoids long locks, transaction timeouts, and complicated retries).
//   - Batch-invariant planning data (target classes, sections, existing
//     target enrollments, source enrollments) is read ONCE per batch in a
//     snapshot transaction; per-student transactions are write-only, which
//     keeps the remote-DB round-trip cost proportional to writes.
//   - Promotion history = the enrollment record chain (source record closed
//     as PROMOTED with leftAt; new ACTIVE record in the target year).
//     Passed-out students additionally get a PassedOutRecord + student status.
//   - Attendance eligibility follows the ACTIVE enrollment automatically.
// ============================================

export type PromotionAction = 'PROMOTE' | 'SKIP' | 'GRADUATE' | 'TRANSFER';

export interface PromotionItem {
  studentId: string;
  action: PromotionAction;
  toClassId?: string;
  toSectionId?: string;
  rollNumber?: string;
}

export interface PromotionFailure {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  currentClass: string;
  currentSection: string;
  reason: string;
  action: 'RETRY' | 'REVIEW';
  attemptedAction: PromotionAction;
  toClassId?: string;
  toSectionId?: string;
}

export interface PromotionSummary {
  /** Independently computed server-side count of students actually matching the
   *  promotion criteria (source year + ACTIVE status + optional class filter).
   *  Does NOT derive from items sent by the client — a client-side shortfall is
   *  visible as eligible !== submitted. */
  eligible: number;
  /** How many promotion items were actually submitted to this batch (client
   *  items, or the full eligible set when no items were provided). */
  submitted: number;
  promoted: number;
  passedOut: number;
  skipped: number;
  failed: PromotionFailure[];
  total: number;
  retryable: number;
  durationMs: number;
  note?: string;
}

export interface PromotionBatchInput {
  schoolId: string;
  fromAcademicYearId: string;
  toAcademicYearId: string;
  classId?: string;
  items?: PromotionItem[];
  /** Optional live progress callback — invoked once per completed student with
   *  cumulative batch counters. Used by the PromotionJob runner to persist
   *  job/batch progress; the blocking API does not pass it. */
  onProgress?: (p: {
    processed: number;
    promoted: number;
    passedOut: number;
    skipped: number;
    failed: number;
  }) => void;
}

interface StudentDetail {
  name: string;
  admissionNumber: string;
}

interface EnrollmentSnapshot {
  id: string;
  studentId: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  rollNumber: string | null;
  gradeLevel: string | null;
  className: string;
  sectionName: string;
  studentName: string;
  admissionNumber: string;
}

interface TargetClassInfo {
  classId: string;
  firstSectionId: string | null;
  sectionIds: Set<string>;
  /** sectionId -> section name (ACTIVE sections only, Phase 3.3). */
  sectionsById: Map<string, string>;
  /** section name -> sectionId (ACTIVE sections only, Phase 3.3). */
  sectionsByName: Map<string, string>;
  /** sectionId -> capacity (Phase 3.3 overflow handling). */
  capacityById: Map<string, number>;
  /** sectionId -> ACTIVE target-year enrollment count at batch start
   *  (Phase 3.3 overflow handling). */
  occupancyById: Map<string, number>;
}

type Outcome =
  | { kind: 'promoted' }
  | { kind: 'passedOut' }
  | { kind: 'skipped' }
  | {
      kind: 'failed';
      reason: string;
      action: 'RETRY' | 'REVIEW';
      detail?: StudentDetail;
      currentClass?: string;
      currentSection?: string;
      attemptedAction: PromotionAction;
      toClassId?: string;
      toSectionId?: string;
    };

type Tx = PrismaTransactionClient;

// One GLOBAL worker pool size — shared by every job/batch run. The promotion
// job scheduler serializes jobs, so at any time exactly one pool is active.
// Configurable via PROMOTION_WORKERS (default 6, matching the rlsPrisma pool).
export const PARALLEL_WORKERS = Number(process.env.PROMOTION_WORKERS) || 6;

export async function runPromotionBatch(
  input: PromotionBatchInput,
  authCtx: AuthContext,
  ctx: RequestContext
): Promise<PromotionSummary> {
  const started = Date.now();
  const profStarted = new Date().toISOString();
  profile.startPhase('total');

  // ── 1. Snapshot: batch-invariant planning data (single transaction) ────────
  profile.startPhase('snapshot');
  const snapshot = await withRls(ctx, async (tx) => {
    const settings = await tx.schoolSettings.findUnique({
      where: { schoolId: input.schoolId },
    });
    const grades = Array.isArray(settings?.grades)
      ? (settings!.grades as string[])
      : [];

    const toYear = await tx.academicYear.findUnique({
      where: { id: input.toAcademicYearId },
    });
    const batch = toYear?.name || input.toAcademicYearId;

    // Independently computed eligible count — the number of students who actually
    // match the promotion criteria (source year + ACTIVE + optional class filter).
    // This is the single source of truth for "eligible" in the API response and
    // the dashboard; it does NOT depend on what the client submitted.
    const eligibleCount = await tx.enrollment.count({
      where: {
        schoolId: input.schoolId,
        academicYearId: input.fromAcademicYearId,
        status: 'ACTIVE',
        ...(input.classId ? { classId: input.classId } : {}),
      },
    });

    let items = input.items ?? [];
    if (items.length === 0) {
      const enrollments = await tx.enrollment.findMany({
        where: {
          schoolId: input.schoolId,
          academicYearId: input.fromAcademicYearId,
          status: 'ACTIVE',
          ...(input.classId ? { classId: input.classId } : {}),
        },
        select: { studentId: true },
      });
      items = enrollments.map((e) => ({
        studentId: e.studentId,
        action: 'PROMOTE' as const,
      }));
    }

    // Pre-check: the target academic year must have active classes, otherwise
    // every student would wrongly resolve to "highest grade" and be passed out.
    const targetHasClasses =
      (await tx.class.findFirst({
        where: {
          schoolId: input.schoolId,
          academicYearId: input.toAcademicYearId,
          isDeleted: false,
          status: 'ACTIVE',
        },
        select: { id: true },
      })) !== null;

    const itemIds = items.map((i) => i.studentId);

    // Source enrollments (one snapshot read for the whole batch).
    const enrollments: EnrollmentSnapshot[] = [];
    const enrollmentsByStudent = new Map<string, EnrollmentSnapshot>();
    if (targetHasClasses && itemIds.length > 0) {
      const rows = await tx.enrollment.findMany({
        where: {
          schoolId: input.schoolId,
          academicYearId: input.fromAcademicYearId,
          status: 'ACTIVE',
          studentId: { in: itemIds },
        },
        include: {
          class: { select: { name: true, gradeLevel: true } },
          section: { select: { name: true } },
          student: {
            select: { firstName: true, lastName: true, admissionNumber: true },
          },
        },
      });
      for (const r of rows) {
        const snap: EnrollmentSnapshot = {
          id: r.id,
          studentId: r.studentId,
          academicYearId: r.academicYearId,
          classId: r.classId,
          sectionId: r.sectionId,
          rollNumber: r.rollNumber,
          gradeLevel: r.class.gradeLevel,
          className: r.class.name,
          sectionName: r.section?.name ?? '—',
          studentName: `${r.student.firstName} ${r.student.lastName}`,
          admissionNumber: r.student.admissionNumber,
        };
        enrollments.push(snap);
        enrollmentsByStudent.set(r.studentId, snap);
      }
    }

    // Target-year classes: full map (any status) + active map (for grade resolution).
    const allTargetClasses = await tx.class.findMany({
      where: {
        schoolId: input.schoolId,
        academicYearId: input.toAcademicYearId,
        isDeleted: false,
      },
      include: {
        sections: {
          where: { status: 'ACTIVE' },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, capacity: true },
        },
      },
    });
    // Phase 3.3: occupancy per target section at batch start (overflow check data).
    const occupancyRows = await tx.enrollment.findMany({
      where: {
        schoolId: input.schoolId,
        academicYearId: input.toAcademicYearId,
        status: 'ACTIVE',
      },
      select: { sectionId: true },
    });
    const occupancyById = new Map<string, number>();
    for (const r of occupancyRows) {
      const sid = r.sectionId!;
      occupancyById.set(sid, (occupancyById.get(sid) ?? 0) + 1);
    }
    const targetClassById = new Map<string, TargetClassInfo>();
    const activeClasses: {
      id: string;
      gradeLevel: string | null;
      sortOrder: number;
    }[] = [];
    for (const c of allTargetClasses) {
      const ids = c.sections.map((s) => s.id);
      const sectionsById = new Map<string, string>();
      const sectionsByName = new Map<string, string>();
      const capacityById = new Map<string, number>();
      for (const s of c.sections) {
        sectionsById.set(s.id, s.name);
        sectionsByName.set(s.name, s.id);
        capacityById.set(s.id, s.capacity);
      }
      targetClassById.set(c.id, {
        classId: c.id,
        firstSectionId: ids[0] ?? null,
        sectionIds: new Set(ids),
        sectionsById,
        sectionsByName,
        capacityById,
        occupancyById,
      });
      if (c.status === 'ACTIVE')
        activeClasses.push({
          id: c.id,
          gradeLevel: c.gradeLevel,
          sortOrder: c.sortOrder,
        });
    }
    // Grade resolution provides the target CLASS only — the target SECTION is
    // resolved per student by the SectionAssignmentStrategy (Phase 3.3).
    const nextClassByGrade = new Map<string, { classId: string }>();
    for (const c of activeClasses) {
      if (c.gradeLevel) nextClassByGrade.set(c.gradeLevel, { classId: c.id });
    }
    const fallbackTarget = (() => {
      const first = [...activeClasses].sort(
        (a, b) => a.sortOrder - b.sortOrder
      )[0];
      if (!first) return null;
      return { classId: first.id };
    })();

    // Students already ACTIVE in the target year (duplicate-enrollment guard).
    const existingTargets = new Set<string>();
    if (itemIds.length > 0) {
      const rows = await tx.enrollment.findMany({
        where: {
          schoolId: input.schoolId,
          academicYearId: input.toAcademicYearId,
          status: 'ACTIVE',
          studentId: { in: itemIds },
        },
        select: { studentId: true },
      });
      for (const r of rows) existingTargets.add(r.studentId);
    }

    // Details for students with NO source enrollment (for enriched failures).
    const missingIds = itemIds.filter((id) => !enrollmentsByStudent.has(id));
    const missingDetails = new Map<string, StudentDetail>();
    if (missingIds.length > 0) {
      const rows = await tx.student.findMany({
        where: { id: { in: missingIds }, schoolId: input.schoolId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
        },
      });
      for (const s of rows)
        missingDetails.set(s.id, {
          name: `${s.firstName} ${s.lastName}`,
          admissionNumber: s.admissionNumber,
        });
    }

    return {
      grades,
      batch,
      items,
      targetHasClasses,
      enrollmentsByStudent,
      missingDetails,
      nextClassByGrade,
      fallbackTarget,
      targetClassById,
      existingTargets,
      eligibleCount,
    };
  });
  profile.endPhase('snapshot', {
    rows: snapshot.items.length,
    queries: 8,
    meta: {
      eligibleCount: snapshot.eligibleCount,
      targetHasClasses: snapshot.targetHasClasses,
      itemCount: snapshot.items.length,
    },
  });

  const summary: PromotionSummary = {
    eligible: snapshot.eligibleCount,
    submitted: snapshot.items.length,
    promoted: 0,
    passedOut: 0,
    skipped: 0,
    failed: [],
    total: snapshot.items.length,
    retryable: 0,
    durationMs: 0,
  };

  if (snapshot.items.length === 0) {
    summary.note = 'No active enrollments found in the selected academic year';
    summary.durationMs = Date.now() - started;
    return summary;
  }

  // ── Short-circuit: target year has no active classes ──────────────────────
  if (!snapshot.targetHasClasses) {
    summary.failed = snapshot.items.map((item) => {
      const snap = snapshot.enrollmentsByStudent.get(item.studentId);
      const missing = snapshot.missingDetails.get(item.studentId);
      return {
        studentId: item.studentId,
        studentName: snap ? snap.studentName : (missing?.name ?? '—'),
        admissionNumber: snap
          ? snap.admissionNumber
          : (missing?.admissionNumber ?? '—'),
        currentClass: snap?.className ?? '—',
        currentSection: snap?.sectionName ?? '—',
        reason: 'No active classes configured for the target academic year',
        action: 'RETRY',
        attemptedAction: 'PROMOTE',
      };
    });
    summary.retryable = summary.failed.length;
    summary.durationMs = Date.now() - started;
    return summary;
  }

  // ── 2. Process: each student in its own transaction, bounded parallelism ───
  const strategy = getSectionAssignmentStrategy(input.schoolId);
  const args = {
    input,
    grades: snapshot.grades,
    batch: snapshot.batch,
    enrollmentsByStudent: snapshot.enrollmentsByStudent,
    missingDetails: snapshot.missingDetails,
    nextClassByGrade: snapshot.nextClassByGrade,
    fallbackTarget: snapshot.fallbackTarget,
    targetClassById: snapshot.targetClassById,
    existingTargets: snapshot.existingTargets,
    userId: authCtx.userId,
    strategy,
  };

  const outcomes: Outcome[] = new Array(snapshot.items.length);
  let nextIndex = 0;
  profile.startPhase('process');
  await Promise.all(
    Array.from({ length: PARALLEL_WORKERS }, async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= snapshot.items.length) return;
        const item = snapshot.items[i];
        try {
          outcomes[i] = await withRls(ctx, (tx) =>
            processOne(tx, { ...args, item })
          );
        } catch (err) {
          // 1.3 Collision policy (A): on P2002 roll-number collision, retry
          // the promotion in a FRESH transaction with the next free roll
          // (PostgreSQL auto-aborts the current transaction after any error,
          // so we cannot retry inside the same txn). If the retry also
          // collides (bounded attempts), leave the roll null and report
          // the student with action RETRY for manual assignment.
          const message = err instanceof Error ? err.message : String(err);
          const isRollCollisionErr =
            message.includes('roll_number') &&
            (message.includes('P2002') ||
              message.includes('23505') ||
              message.includes('Unique constraint'));

          if (
            isRollCollisionErr &&
            (item.action === 'PROMOTE' || item.action === 'TRANSFER')
          ) {
            if (profilingEnabled()) {
              const snap = args.enrollmentsByStudent.get(item.studentId);
              profile.addCollision({
                studentId: item.studentId,
                sourceSectionId: snap?.sectionId ?? null,
                targetSectionId: null,
                sourceRollNumber: snap?.rollNumber ?? null,
                requestedTargetRoll:
                  item.rollNumber ?? snap?.rollNumber ?? null,
                retryAttempt: 0,
                phase: 'first_create',
                timestamp: performance.now(),
                errorCode: 'P2002',
              });
            }
            outcomes[i] = await retryWithFreeRoll(args, item, message);
          } else {
            outcomes[i] = {
              kind: 'failed',
              reason: `Unexpected error (all changes rolled back): ${message}`,
              action: 'REVIEW',
              attemptedAction: item.action,
              toClassId: item.toClassId,
              toSectionId: item.toSectionId,
            };
          }
        }
      }
    })
  );

  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    const item = snapshot.items[i];
    switch (outcome.kind) {
      case 'promoted':
        summary.promoted++;
        break;
      case 'passedOut':
        summary.passedOut++;
        break;
      case 'skipped':
        summary.skipped++;
        break;
      case 'failed':
        summary.failed.push({
          studentId: item.studentId,
          studentName: outcome.detail?.name ?? '—',
          admissionNumber: outcome.detail?.admissionNumber ?? '—',
          currentClass: outcome.currentClass ?? '—',
          currentSection: outcome.currentSection ?? '—',
          reason: outcome.reason,
          action: outcome.action,
          attemptedAction: outcome.attemptedAction,
          ...(outcome.toClassId ? { toClassId: outcome.toClassId } : {}),
          ...(outcome.toSectionId ? { toSectionId: outcome.toSectionId } : {}),
        });
        if (outcome.action === 'RETRY') summary.retryable++;
        break;
    }
    if (input.onProgress) {
      input.onProgress({
        processed:
          summary.promoted +
          summary.passedOut +
          summary.skipped +
          summary.failed.length,
        promoted: summary.promoted,
        passedOut: summary.passedOut,
        skipped: summary.skipped,
        failed: summary.failed.length,
      });
    }
  }

  summary.durationMs = Date.now() - started;
  profile.endPhase('process', {
    rows: snapshot.items.length,
    meta: { workers: PARALLEL_WORKERS },
  });
  profile.endPhase('total');
  profile.setTotal(summary.durationMs, profStarted);
  profile.flush({
    total: summary.total,
    promoted: summary.promoted,
    passedOut: summary.passedOut,
    skipped: summary.skipped,
    failed: summary.failed.length,
    retryable: summary.retryable,
  });
  profile.flushRetryPath();

  // Compute section mappings for collision root-cause analysis (TASK 1.7)
  const mappings: {
    sourceGrade: string;
    sourceClass: string;
    targetGrade: string;
    targetClass: string;
    targetSection: string;
    studentCount: number;
  }[] = [];
  if (profilingEnabled()) {
    for (const [srcGrade, tgt] of snapshot.nextClassByGrade) {
      const info = snapshot.targetClassById.get(tgt.classId);
      const targetSection = info?.firstSectionId ?? '?';
      mappings.push({
        sourceGrade: srcGrade,
        sourceClass: srcGrade,
        targetGrade: 'next',
        targetClass: tgt.classId,
        targetSection,
        studentCount: 0,
      });
    }
  }
  profile.flushCollisions(mappings);
  return summary;
}

// ============================================
// Per-student atomic promotion (write-only transaction)
// ============================================

interface ProcessOneArgs {
  item: PromotionItem;
  input: PromotionBatchInput;
  grades: string[];
  batch: string;
  enrollmentsByStudent: Map<string, EnrollmentSnapshot>;
  missingDetails: Map<string, StudentDetail>;
  nextClassByGrade: Map<string, { classId: string }>;
  fallbackTarget: { classId: string } | null;
  targetClassById: Map<string, TargetClassInfo>;
  existingTargets: Set<string>;
  userId: string;
  strategy: SectionAssignmentStrategy;
}

async function processOne(tx: Tx, args: ProcessOneArgs): Promise<Outcome> {
  const { item, input, grades, batch, userId } = args;

  const snapshot = args.enrollmentsByStudent.get(item.studentId);
  if (!snapshot) {
    const d = args.missingDetails.get(item.studentId);
    return {
      kind: 'failed',
      reason: 'No active enrollment in the selected academic year',
      action: 'RETRY',
      detail: d,
      attemptedAction: item.action,
    };
  }

  if (item.action === 'SKIP') return { kind: 'skipped' };

  if (item.action === 'GRADUATE') {
    await passOutStudent(
      tx,
      input.schoolId,
      snapshot,
      batch,
      'Graduated — completed schooling',
      userId
    );
    return { kind: 'passedOut' };
  }

  let toClassId: string | undefined;
  let toSectionId: string | undefined;
  // Carry the source enrollment's roll number forward when the batch item does
  // not specify one (the UI never sends one) — without this every promoted
  // student silently loses their roll number in the new year.
  let rollNumber: string | null = item.rollNumber || snapshot.rollNumber;

  if (item.action === 'TRANSFER') {
    if (!item.toClassId) {
      return {
        kind: 'failed',
        reason: 'Transfer requires an explicit target class',
        action: 'RETRY',
        detail: {
          name: snapshot.studentName,
          admissionNumber: snapshot.admissionNumber,
        },
        currentClass: snapshot.className,
        currentSection: snapshot.sectionName,
        attemptedAction: item.action,
      };
    }
    toClassId = item.toClassId;
    toSectionId = item.toSectionId;
    rollNumber = item.rollNumber || snapshot.rollNumber;
  } else if (item.toClassId) {
    toClassId = item.toClassId;
    toSectionId = item.toSectionId;
  } else {
    // Grades-based next-class resolution (batch snapshot, no per-student query).
    // NOTE: the empty-grades guard matters — with no grade list, `indexOf`
    // returns -1 which must NOT be treated as "highest grade reached".
    let target: { classId: string } | null = null;
    if (grades.length > 0 && snapshot.gradeLevel) {
      const idx = grades.indexOf(snapshot.gradeLevel);
      if (idx >= 0) {
        if (idx === grades.length - 1) {
          // Highest grade reached — auto-graduate to PASSED_OUT instead of failing.
          await passOutStudent(
            tx,
            input.schoolId,
            snapshot,
            batch,
            'Completed final grade',
            userId
          );
          return { kind: 'passedOut' };
        }
        target = args.nextClassByGrade.get(grades[idx + 1]) ?? null;
      } else {
        target = args.fallbackTarget;
      }
    } else {
      target = args.fallbackTarget;
    }
    if (!target) {
      await passOutStudent(
        tx,
        input.schoolId,
        snapshot,
        batch,
        'Completed final grade',
        userId
      );
      return { kind: 'passedOut' };
    }
    toClassId = target.classId;
  }

  const targetInfo = toClassId
    ? args.targetClassById.get(toClassId)
    : undefined;
  if (!targetInfo) {
    return {
      kind: 'failed',
      reason: 'Target class does not belong to the target academic year',
      action: 'RETRY',
      detail: {
        name: snapshot.studentName,
        admissionNumber: snapshot.admissionNumber,
      },
      currentClass: snapshot.className,
      currentSection: snapshot.sectionName,
      attemptedAction: item.action,
      toClassId,
      toSectionId,
    };
  }

  if (toSectionId && !targetInfo.sectionIds.has(toSectionId)) {
    return {
      kind: 'failed',
      reason: 'Target section does not belong to the target class',
      action: 'RETRY',
      detail: {
        name: snapshot.studentName,
        admissionNumber: snapshot.admissionNumber,
      },
      currentClass: snapshot.className,
      currentSection: snapshot.sectionName,
      attemptedAction: item.action,
      toClassId,
      toSectionId,
    };
  }

  if (args.existingTargets.has(item.studentId)) {
    return {
      kind: 'failed',
      reason: 'Already enrolled in the target academic year',
      action: 'RETRY',
      detail: {
        name: snapshot.studentName,
        admissionNumber: snapshot.admissionNumber,
      },
      currentClass: snapshot.className,
      currentSection: snapshot.sectionName,
      attemptedAction: item.action,
      toClassId,
      toSectionId,
    };
  }

  // Phase 3.3: section resolution goes through the SectionAssignmentStrategy
  // (default PRESERVE_SECTION — source section letter -> matching target
  // section letter, fall back to firstSectionId). Explicit toSectionId
  // (TRANSFER / UI-provided) is honored as-is. The RESOLVED section below is
  // the ONLY value used both as the mutex key AND as the written sectionId —
  // the lock is never taken on a stale/unresolved key.
  const src: SectionAssignmentSource = {
    studentId: item.studentId,
    sectionId: snapshot.sectionId,
    sectionName: snapshot.sectionName === '—' ? null : snapshot.sectionName,
    rollNumber: snapshot.rollNumber,
  };
  const targetSectionId =
    toSectionId ?? args.strategy.resolveTargetSection(src, targetInfo) ?? null;
  const assignmentMarkers = toSectionId
    ? undefined
    : args.strategy.auditMarkers(src, targetInfo);
  if (!targetSectionId) {
    return {
      kind: 'failed',
      reason: 'Target class has no active sections',
      action: 'RETRY',
      detail: {
        name: snapshot.studentName,
        admissionNumber: snapshot.admissionNumber,
      },
      currentClass: snapshot.className,
      currentSection: snapshot.sectionName,
      attemptedAction: item.action,
      toClassId,
      toSectionId,
    };
  }

  // Close the current enrollment FIRST so the "one ACTIVE enrollment per student"
  // partial unique constraint is satisfied before the new enrollment is created.
  const tCloseSrc = profilingEnabled() ? performance.now() : 0;
  await tx.enrollment.update({
    where: { id: snapshot.id },
    data: { status: 'PROMOTED', leftAt: new Date() },
  });
  const tCreateTgt = profilingEnabled() ? performance.now() : 0;
  // Phase 3.2 (approved ADR — Option A): acquire the section mutex BEFORE any
  // roll allocation. pg_advisory_xact_lock is released at transaction
  // commit/abort — the earliest point at which the allocated roll is durable
  // and visible to concurrent allocators. The source-close above is outside
  // the critical section (it does not touch the target section's roll space).
  let tAudit = 0;
  let tDone = 0;
  await withSectionRollLock(
    tx,
    input.schoolId,
    input.toAcademicYearId,
    toClassId!,
    targetSectionId,
    async () => {
      const created = await tx.enrollment.create({
        data: {
          schoolId: input.schoolId,
          studentId: item.studentId,
          academicYearId: input.toAcademicYearId,
          classId: toClassId!,
          sectionId: targetSectionId,
          rollNumber,
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });
      tAudit = profilingEnabled() ? performance.now() : 0;
      await tx.auditLog.create({
        data: {
          userId,
          schoolId: input.schoolId,
          action: 'promote',
          entity: 'enrollment',
          recordId: created.id,
          after: {
            studentId: item.studentId,
            fromAcademicYearId: input.fromAcademicYearId,
            toAcademicYearId: input.toAcademicYearId,
            classId: toClassId,
            sectionId: targetSectionId,
            action: item.action,
            ...(assignmentMarkers ?? {}),
          } as Prisma.InputJsonValue,
        },
      });
      tDone = profilingEnabled() ? performance.now() : 0;
    }
  );

  if (profilingEnabled()) {
    profile.addStudentTiming({
      studentId: item.studentId,
      totalMs: tDone - tCloseSrc,
      closeSourceMs: tCreateTgt - tCloseSrc,
      createTargetMs: tAudit - tCreateTgt,
      auditLogMs: tDone - tAudit,
      rollRetries: 0,
      outcome: 'promoted',
      rollNumber,
      sectionId: targetSectionId,
    });
  }

  return { kind: 'promoted' };
}

// ============================================
// 1.3 Collision policy: (A) AUTO-ASSIGN next free roll and continue
//
// When a P2002 roll-number collision occurs (the partial unique index
// enrollments_target_roll_active_key), the per-student transaction is
// auto-aborted by PostgreSQL (code 25P02) — we cannot retry inside the
// same transaction. Policy A: open a fresh transaction, compute the next
// free roll in the target section, re-apply the promotion (close source +
// create target), and return a "promoted" outcome. If the retry itself
// collides, bound to 3 attempts; the last attempt falls back to null roll.
// ============================================

async function retryWithFreeRoll(
  args: {
    input: PromotionBatchInput;
    enrollmentsByStudent: Map<string, EnrollmentSnapshot>;
    grades: string[];
    batch: string;
    nextClassByGrade: Map<string, { classId: string }>;
    fallbackTarget: { classId: string } | null;
    targetClassById: Map<string, TargetClassInfo>;
    existingTargets: Set<string>;
    userId: string;
    strategy: SectionAssignmentStrategy;
  },
  item: PromotionItem,
  originalMessage: string
): Promise<Outcome> {
  const snapshot = args.enrollmentsByStudent.get(item.studentId);
  if (!snapshot)
    return {
      kind: 'failed',
      reason:
        'No active enrollment in the selected academic year (roll-collision retry)',
      action: 'RETRY',
      attemptedAction: item.action,
    };

  const toClassId =
    item.toClassId ??
    resolveTargetClassId(
      snapshot,
      args.grades,
      args.nextClassByGrade,
      args.fallbackTarget
    );
  if (!toClassId)
    return {
      kind: 'failed',
      reason: `Roll collision on ${item.studentId}: could not resolve target class (retry failed). ${originalMessage}`,
      action: 'RETRY',
      detail: {
        name: snapshot.studentName,
        admissionNumber: snapshot.admissionNumber,
      },
      currentClass: snapshot.className,
      currentSection: snapshot.sectionName,
      attemptedAction: item.action,
    };
  const info = args.targetClassById.get(toClassId);
  if (!info)
    return {
      kind: 'failed',
      reason: `Roll collision on ${item.studentId}: target class not found (retry failed). ${originalMessage}`,
      action: 'RETRY',
      detail: {
        name: snapshot.studentName,
        admissionNumber: snapshot.admissionNumber,
      },
      currentClass: snapshot.className,
      currentSection: snapshot.sectionName,
      attemptedAction: item.action,
      toClassId,
    };
  // Phase 3.3: the retry resolves the SAME section the original attempt used
  // (strategy, not firstSectionId) — otherwise the retry would lock one key
  // and write to another, defeating both the mutex and PRESERVE_SECTION.
  const src: SectionAssignmentSource = {
    studentId: item.studentId,
    sectionId: snapshot.sectionId,
    sectionName: snapshot.sectionName === '—' ? null : snapshot.sectionName,
    rollNumber: snapshot.rollNumber,
  };
  const sectionId =
    item.toSectionId ?? args.strategy.resolveTargetSection(src, info);
  const assignmentMarkers = item.toSectionId
    ? undefined
    : args.strategy.auditMarkers(src, info);
  if (!sectionId)
    return {
      kind: 'failed',
      reason: `Roll collision on ${item.studentId}: no active section in target class (retry failed). ${originalMessage}`,
      action: 'RETRY',
      detail: {
        name: snapshot.studentName,
        admissionNumber: snapshot.admissionNumber,
      },
      currentClass: snapshot.className,
      currentSection: snapshot.sectionName,
      attemptedAction: item.action,
      toClassId,
    };

  let retryCount = 0;
  for (let attempt = 0; attempt <= 3; attempt++) {
    retryCount = attempt + 1;
    countRollRetryAttempt();
    try {
      // Hook attempt number into the retry attempt (withRlsForRetry sets it to 0 by default)
      await withRlsForRetry(
        snapshot,
        toClassId,
        sectionId,
        args.input,
        args.userId,
        assignmentMarkers
      );
      profile.patchLastRetryAttempt(retryCount, -1);
      return { kind: 'promoted' } as Outcome;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isCollision =
        msg.includes('roll_number') &&
        (msg.includes('P2002') ||
          msg.includes('23505') ||
          msg.includes('Unique constraint'));
      if (profilingEnabled() && isCollision) {
        profile.addCollision({
          studentId: item.studentId,
          sourceSectionId: snapshot.sectionId,
          targetSectionId: sectionId,
          sourceRollNumber: snapshot.rollNumber,
          requestedTargetRoll: null,
          retryAttempt: retryCount,
          phase: 'retry_create',
          timestamp: performance.now(),
          errorCode: 'P2002',
        });
      }
      // Patch exhausted entry
      profile.patchLastRetryAttempt(retryCount, -1);
      if (!isCollision || attempt === 3) {
        return {
          kind: 'failed',
          reason: `Roll collision retry exhausted (${attempt + 1} attempts): ${msg}`,
          action: 'RETRY',
          detail: {
            name: snapshot.studentName,
            admissionNumber: snapshot.admissionNumber,
          },
          currentClass: snapshot.className,
          currentSection: snapshot.sectionName,
          attemptedAction: item.action,
          toClassId,
          toSectionId: sectionId,
        };
      }
    }
  }
  return {
    kind: 'failed',
    reason: 'Roll collision retry exhausted',
    action: 'RETRY',
    attemptedAction: item.action,
  } as Outcome;
}

async function withRlsForRetry(
  snapshot: EnrollmentSnapshot,
  toClassId: string,
  sectionId: string,
  input: PromotionBatchInput,
  userId: string,
  assignmentMarkers?: Record<string, boolean | string>
): Promise<void> {
  const retryStarted = profilingEnabled() ? performance.now() : 0;
  let rollAssigned: string | null = null;

  try {
    return await withRls(
      { userId, schoolId: input.schoolId } as RequestContext,
      async (tx) => {
        const t0 = profilingEnabled() ? performance.now() : 0;
        const src = await tx.enrollment.findUnique({
          where: { id: snapshot.id },
        });
        if (!src || src.status !== 'ACTIVE')
          throw new Error(
            `Source enrollment ${snapshot.id} not found or not ACTIVE (was already processed)`
          );
        const t1 = profilingEnabled() ? performance.now() : 0;

        // Phase 3.2 (approved ADR — Option A): the used-rolls read and the roll
        // insert MUST hold the section mutex — this is the read-then-write race
        // that produced the verified 17–19% roll-collision failures
        // (failure-breakdown.md §4). The source-verify above is outside the
        // critical section. Lock released at transaction commit/abort.
        return withSectionRollLock(
          tx,
          input.schoolId,
          input.toAcademicYearId,
          toClassId,
          sectionId,
          async () => {
            const used = new Set<string>();
            const rows = await tx.enrollment.findMany({
              where: {
                schoolId: input.schoolId,
                sectionId,
                status: 'ACTIVE',
                rollNumber: { not: null },
              },
              select: { rollNumber: true },
            });
            for (const r of rows) if (r.rollNumber) used.add(r.rollNumber);
            let free = String(1);
            while (used.has(free)) free = String(Number(free) + 1);
            rollAssigned = free;
            const t2 = profilingEnabled() ? performance.now() : 0;

            await tx.enrollment.update({
              where: { id: snapshot.id },
              data: { status: 'PROMOTED', leftAt: new Date() },
            });
            const t3 = profilingEnabled() ? performance.now() : 0;
            await tx.enrollment.create({
              data: {
                schoolId: input.schoolId,
                studentId: snapshot.studentId,
                academicYearId: input.toAcademicYearId,
                classId: toClassId,
                sectionId,
                rollNumber: free,
                status: 'ACTIVE',
                joinedAt: new Date(),
              },
            });
            const t4 = profilingEnabled() ? performance.now() : 0;
            await tx.auditLog.create({
              data: {
                userId,
                schoolId: input.schoolId,
                action: 'promote',
                entity: 'enrollment',
                recordId: snapshot.studentId,
                after: {
                  studentId: snapshot.studentId,
                  fromAcademicYearId: input.fromAcademicYearId,
                  toAcademicYearId: input.toAcademicYearId,
                  classId: toClassId,
                  sectionId,
                  action: 'PROMOTE',
                  rollCollisionRecovery: true,
                  ...(assignmentMarkers ?? {}),
                } as Prisma.InputJsonValue,
              },
            });
            const t5 = profilingEnabled() ? performance.now() : 0;

            if (profilingEnabled()) {
              const elapsed = t5 - retryStarted;
              const subPhases = [
                {
                  name: 'verify_source',
                  durationMs: t1 - t0,
                  rowsAffected: src ? 1 : 0,
                },
                {
                  name: 'load_used_rolls',
                  durationMs: t2 - t1,
                  rowsAffected: rows.length,
                },
                { name: 'close_source', durationMs: t3 - t2 },
                { name: 'create_target', durationMs: t4 - t3 },
                { name: 'create_audit', durationMs: t5 - t4 },
                { name: 'txn_total', durationMs: t5 - t0 },
              ];
              profile.addRetryAttempt({
                studentId: snapshot.studentId,
                attemptNumber: 0, // filled by caller
                workerId: 0, // filled by caller
                startTime: retryStarted,
                endTime: t5,
                durationMs: elapsed,
                outcome: 'success',
                rollAssigned,
                subPhases,
              });
            }
          }
        );
      }
    );
  } catch (err) {
    if (profilingEnabled()) {
      profile.addRetryAttempt({
        studentId: snapshot.studentId,
        attemptNumber: 0,
        workerId: 0,
        startTime: retryStarted,
        endTime: performance.now(),
        durationMs: performance.now() - retryStarted,
        outcome: 'exhausted',
        rollAssigned: null,
        subPhases: [],
      });
    }
    throw err;
  }
}

function resolveTargetClassId(
  snapshot: EnrollmentSnapshot,
  grades: string[],
  nextClassByGrade: Map<string, { classId: string }>,
  fallbackTarget: { classId: string } | null
): string | null {
  if (grades.length > 0 && snapshot.gradeLevel) {
    const idx = grades.indexOf(snapshot.gradeLevel);
    if (idx >= 0 && idx < grades.length - 1) {
      return (
        nextClassByGrade.get(grades[idx + 1])?.classId ??
        fallbackTarget?.classId ??
        null
      );
    }
  }
  return fallbackTarget?.classId ?? null;
}

async function passOutStudent(
  tx: Tx,
  schoolId: string,
  snapshot: EnrollmentSnapshot,
  batch: string,
  reason: string,
  userId: string
) {
  const tEnroll = profilingEnabled() ? performance.now() : 0;
  await tx.enrollment.update({
    where: { id: snapshot.id },
    data: { status: 'PASSED_OUT', leftAt: new Date() },
  });
  const tStu = profilingEnabled() ? performance.now() : 0;
  await tx.student.update({
    where: { id: snapshot.studentId },
    data: { status: 'PASSED_OUT' },
  });
  const tPor = profilingEnabled() ? performance.now() : 0;
  await tx.passedOutRecord.create({
    data: {
      schoolId,
      studentId: snapshot.studentId,
      batch,
      passedOutDate: new Date(),
      graduationReason: reason,
      finalAcademicYearId: snapshot.academicYearId,
      finalClassId: snapshot.classId,
      finalSectionId: snapshot.sectionId,
      finalRollNumber: snapshot.rollNumber,
    },
  });
  const tAudit = profilingEnabled() ? performance.now() : 0;
  await tx.auditLog.create({
    data: {
      userId,
      schoolId,
      action: 'pass_out',
      entity: 'student',
      recordId: snapshot.studentId,
      after: { batch, reason } as Prisma.InputJsonValue,
    },
  });
  const tDone = profilingEnabled() ? performance.now() : 0;

  if (profilingEnabled()) {
    profile.addStudentTiming({
      studentId: snapshot.studentId,
      totalMs: tDone - tEnroll,
      closeSourceMs: tStu - tEnroll,
      createTargetMs: tPor - tStu + (tAudit - tPor),
      auditLogMs: tDone - tAudit,
      rollRetries: -1,
      outcome: 'passedOut',
      rollNumber: snapshot.rollNumber,
      sectionId: snapshot.sectionId,
    });
  }
}

// ============================================
// Close Year & Activate Next (orchestrated flow)
//
// Transition order (architectural requirement):
//   1. Validate   – source year must exist + be ACTIVE; target must exist,
//                   differ from source, and have active classes.
//   2. Process    – run the full promotion batch (per-student transactions).
//   3. Verify     – if ANY failure remains, the transition is BLOCKED and the
//                   source year is left untouched (never COMPLETED with
//                   unresolved promotion errors). The failure review list is
//                   returned for correction + retry.
//   4. Statistics – statistics are live aggregates (dashboard recomputes from
//                   enrollment data); the batch summary is the run report.
//   5. Transition – in ONE transaction: source -> COMPLETED (isActive=false,
//                   isCurrent=false), target -> ACTIVE (isActive=true,
//                   isCurrent=true) + audit log. Exactly one ACTIVE year.
// ============================================

export interface CloseYearInput {
  schoolId: string;
  fromAcademicYearId: string;
  toAcademicYearId: string;
  classId?: string;
}

export type CloseYearResult =
  | {
      success: true;
      summary: PromotionSummary;
      completedYear: { id: string; name: string };
      activatedYear: { id: string; name: string };
    }
  | {
      success: false;
      code: 'TRANSITION_BLOCKED' | 'VALIDATION';
      message: string;
      summary?: PromotionSummary;
    };

export async function completeAcademicYearFlow(
  input: CloseYearInput,
  authCtx: AuthContext,
  ctx: RequestContext
): Promise<CloseYearResult> {
  // ── 1. Validate (single short transaction) ─────────────────────────────────
  const validation = await withRls(ctx, async (tx) => {
    const from = await tx.academicYear.findUnique({
      where: { id: input.fromAcademicYearId },
    });
    const to = await tx.academicYear.findUnique({
      where: { id: input.toAcademicYearId },
    });
    const activeElsewhere =
      (await tx.academicYear.count({
        where: {
          schoolId: input.schoolId,
          isActive: true,
          id: { not: input.fromAcademicYearId },
        },
      })) > 0;
    return { from, to, activeElsewhere };
  });

  if (!validation.from || validation.from.schoolId !== input.schoolId) {
    return {
      success: false,
      code: 'VALIDATION',
      message: 'Source academic year not found in this school',
    };
  }
  if (!validation.to || validation.to.schoolId !== input.schoolId) {
    return {
      success: false,
      code: 'VALIDATION',
      message: 'Target academic year not found in this school',
    };
  }
  if (input.fromAcademicYearId === input.toAcademicYearId) {
    return {
      success: false,
      code: 'VALIDATION',
      message: 'Source and target academic years must differ',
    };
  }
  if (validation.from.status !== 'ACTIVE' || !validation.from.isActive) {
    return {
      success: false,
      code: 'VALIDATION',
      message:
        'Only the ACTIVE academic year can be completed (source year is not the active one)',
    };
  }
  if (validation.to.status === 'COMPLETED') {
    return {
      success: false,
      code: 'VALIDATION',
      message: 'Target academic year is already COMPLETED',
    };
  }
  if (validation.activeElsewhere) {
    return {
      success: false,
      code: 'VALIDATION',
      message:
        'Another academic year is already ACTIVE — exactly one ACTIVE year is allowed',
    };
  }

  // ── 2. Process all eligible students (per-student transactions) ────────────
  const summary = await runPromotionBatch(
    { ...input, items: [] },
    authCtx,
    ctx
  );

  // ── 3. Verify – never transition while unresolved failures remain ──────────
  if (summary.failed.length > 0) {
    return {
      success: false,
      code: 'TRANSITION_BLOCKED',
      message: `Promotion completed with ${summary.failed.length} unresolved failure(s) — academic year status was NOT changed. Resolve and retry the failed students.`,
      summary,
    };
  }

  // ── 5. Transition (single transaction) ─────────────────────────────────────
  const transition = await withRls(ctx, async (tx) => {
    // Clear any other ACTIVE flag first (defensive; exactly-one invariant).
    await tx.academicYear.updateMany({
      where: {
        schoolId: input.schoolId,
        isActive: true,
        id: { not: input.fromAcademicYearId },
      },
      data: { isActive: false, isCurrent: false },
    });
    const completed = await tx.academicYear.update({
      where: { id: input.fromAcademicYearId },
      data: {
        status: 'COMPLETED',
        isActive: false,
        isCurrent: false,
        updatedBy: authCtx.userId,
      },
    });
    const activated = await tx.academicYear.update({
      where: { id: input.toAcademicYearId },
      data: {
        status: 'ACTIVE',
        isActive: true,
        isCurrent: true,
        updatedBy: authCtx.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: input.schoolId,
        action: 'complete_year',
        entity: 'academic_year',
        recordId: input.fromAcademicYearId,
        after: {
          fromAcademicYearId: input.fromAcademicYearId,
          fromName: completed.name,
          toAcademicYearId: input.toAcademicYearId,
          toName: activated.name,
          promoted: summary.promoted,
          passedOut: summary.passedOut,
          skipped: summary.skipped,
        } as Prisma.InputJsonValue,
      },
    });
    return { completed, activated };
  });

  return {
    success: true,
    summary,
    completedYear: {
      id: transition.completed.id,
      name: transition.completed.name,
    },
    activatedYear: {
      id: transition.activated.id,
      name: transition.activated.name,
    },
  };
}
