import { withRls, type RequestContext, type PrismaTransactionClient } from '@/lib/prisma/rls-middleware';
import type { AuthContext } from '@/lib/auth/context';
import type { Prisma } from '@/generated/prisma/client';

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
  eligible: number;
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
  firstSectionId: string | null;
  sectionIds: Set<string>;
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

const PARALLEL_WORKERS = 6; // matches the rlsPrisma pool size

export async function runPromotionBatch(
  input: PromotionBatchInput,
  authCtx: AuthContext,
  ctx: RequestContext
): Promise<PromotionSummary> {
  const started = Date.now();

  // ── 1. Snapshot: batch-invariant planning data (single transaction) ────────
  const snapshot = await withRls(ctx, async (tx) => {
    const settings = await tx.schoolSettings.findUnique({ where: { schoolId: input.schoolId } });
    const grades = Array.isArray(settings?.grades) ? (settings!.grades as string[]) : [];

    const toYear = await tx.academicYear.findUnique({ where: { id: input.toAcademicYearId } });
    const batch = toYear?.name || input.toAcademicYearId;

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
      items = enrollments.map((e) => ({ studentId: e.studentId, action: 'PROMOTE' as const }));
    }

    // Pre-check: the target academic year must have active classes, otherwise
    // every student would wrongly resolve to "highest grade" and be passed out.
    const targetHasClasses =
      (await tx.class.findFirst({
        where: { schoolId: input.schoolId, academicYearId: input.toAcademicYearId, isDeleted: false, status: 'ACTIVE' },
        select: { id: true },
      })) !== null;

    const itemIds = items.map((i) => i.studentId);

    // Source enrollments (one snapshot read for the whole batch).
    const enrollments: EnrollmentSnapshot[] = [];
    const enrollmentsByStudent = new Map<string, EnrollmentSnapshot>();
    if (targetHasClasses && itemIds.length > 0) {
      const rows = await tx.enrollment.findMany({
        where: { schoolId: input.schoolId, academicYearId: input.fromAcademicYearId, status: 'ACTIVE', studentId: { in: itemIds } },
        include: {
          class: { select: { name: true, gradeLevel: true } },
          section: { select: { name: true } },
          student: { select: { firstName: true, lastName: true, admissionNumber: true } },
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
      where: { schoolId: input.schoolId, academicYearId: input.toAcademicYearId, isDeleted: false },
      include: { sections: { where: { status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true } } },
    });
    const targetClassById = new Map<string, TargetClassInfo>();
    const activeClasses: { id: string; gradeLevel: string | null; sortOrder: number }[] = [];
    for (const c of allTargetClasses) {
      const ids = c.sections.map((s) => s.id);
      targetClassById.set(c.id, { firstSectionId: ids[0] ?? null, sectionIds: new Set(ids) });
      if (c.status === 'ACTIVE') activeClasses.push({ id: c.id, gradeLevel: c.gradeLevel, sortOrder: c.sortOrder });
    }
    const nextClassByGrade = new Map<string, { classId: string; sectionId: string | null }>();
    for (const c of activeClasses) {
      if (c.gradeLevel) nextClassByGrade.set(c.gradeLevel, { classId: c.id, sectionId: targetClassById.get(c.id)!.firstSectionId });
    }
    const fallbackTarget = (() => {
      const first = [...activeClasses].sort((a, b) => a.sortOrder - b.sortOrder)[0];
      if (!first) return null;
      return { classId: first.id, sectionId: targetClassById.get(first.id)!.firstSectionId };
    })();

    // Students already ACTIVE in the target year (duplicate-enrollment guard).
    const existingTargets = new Set<string>();
    if (itemIds.length > 0) {
      const rows = await tx.enrollment.findMany({
        where: { schoolId: input.schoolId, academicYearId: input.toAcademicYearId, status: 'ACTIVE', studentId: { in: itemIds } },
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
        select: { id: true, firstName: true, lastName: true, admissionNumber: true },
      });
      for (const s of rows) missingDetails.set(s.id, { name: `${s.firstName} ${s.lastName}`, admissionNumber: s.admissionNumber });
    }

    return { grades, batch, items, targetHasClasses, enrollmentsByStudent, missingDetails, nextClassByGrade, fallbackTarget, targetClassById, existingTargets };
  });

  const summary: PromotionSummary = {
    eligible: snapshot.items.length,
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
        admissionNumber: snap ? snap.admissionNumber : (missing?.admissionNumber ?? '—'),
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
  };

  const outcomes: Outcome[] = new Array(snapshot.items.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: PARALLEL_WORKERS }, async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= snapshot.items.length) return;
        const item = snapshot.items[i];
        try {
          outcomes[i] = await withRls(ctx, (tx) => processOne(tx, { ...args, item }));
        } catch (err) {
          // The per-student transaction rolled back — record as a reviewable failure.
          const message = err instanceof Error ? err.message : String(err);
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
  }

  summary.durationMs = Date.now() - started;
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
  nextClassByGrade: Map<string, { classId: string; sectionId: string | null }>;
  fallbackTarget: { classId: string; sectionId: string | null } | null;
  targetClassById: Map<string, TargetClassInfo>;
  existingTargets: Set<string>;
  userId: string;
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
    await passOutStudent(tx, input.schoolId, snapshot, batch, 'Graduated — completed schooling', userId);
    return { kind: 'passedOut' };
  }

  let toClassId: string | undefined;
  let toSectionId: string | undefined;
  let rollNumber: string | null = item.rollNumber || null;

  if (item.action === 'TRANSFER') {
    if (!item.toClassId) {
      return {
        kind: 'failed',
        reason: 'Transfer requires an explicit target class',
        action: 'RETRY',
        detail: { name: snapshot.studentName, admissionNumber: snapshot.admissionNumber },
        currentClass: snapshot.className,
        currentSection: snapshot.sectionName,
        attemptedAction: item.action,
      };
    }
    toClassId = item.toClassId;
    toSectionId = item.toSectionId;
    rollNumber = item.rollNumber || null;
  } else if (item.toClassId) {
    toClassId = item.toClassId;
    toSectionId = item.toSectionId;
  } else {
    // Grades-based next-class resolution (batch snapshot, no per-student query).
    // NOTE: the empty-grades guard matters — with no grade list, `indexOf`
    // returns -1 which must NOT be treated as "highest grade reached".
    let target: { classId: string; sectionId: string | null } | null = null;
    if (grades.length > 0 && snapshot.gradeLevel) {
      const idx = grades.indexOf(snapshot.gradeLevel);
      if (idx >= 0) {
        if (idx === grades.length - 1) {
          // Highest grade reached — auto-graduate to PASSED_OUT instead of failing.
          await passOutStudent(tx, input.schoolId, snapshot, batch, 'Completed final grade', userId);
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
      await passOutStudent(tx, input.schoolId, snapshot, batch, 'Completed final grade', userId);
      return { kind: 'passedOut' };
    }
    toClassId = target.classId;
    toSectionId = target.sectionId ?? undefined;
  }

  const targetInfo = toClassId ? args.targetClassById.get(toClassId) : undefined;
  if (!targetInfo) {
    return {
      kind: 'failed',
      reason: 'Target class does not belong to the target academic year',
      action: 'RETRY',
      detail: { name: snapshot.studentName, admissionNumber: snapshot.admissionNumber },
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
      detail: { name: snapshot.studentName, admissionNumber: snapshot.admissionNumber },
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
      detail: { name: snapshot.studentName, admissionNumber: snapshot.admissionNumber },
      currentClass: snapshot.className,
      currentSection: snapshot.sectionName,
      attemptedAction: item.action,
      toClassId,
      toSectionId,
    };
  }

  const targetSectionId = toSectionId ?? targetInfo.firstSectionId ?? null;
  if (!targetSectionId) {
    return {
      kind: 'failed',
      reason: 'Target class has no active sections',
      action: 'RETRY',
      detail: { name: snapshot.studentName, admissionNumber: snapshot.admissionNumber },
      currentClass: snapshot.className,
      currentSection: snapshot.sectionName,
      attemptedAction: item.action,
      toClassId,
      toSectionId,
    };
  }

  // Close the current enrollment FIRST so the "one ACTIVE enrollment per student"
  // partial unique constraint is satisfied before the new enrollment is created.
  await tx.enrollment.update({ where: { id: snapshot.id }, data: { status: 'PROMOTED', leftAt: new Date() } });
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
      } as Prisma.InputJsonValue,
    },
  });

  return { kind: 'promoted' };
}

async function passOutStudent(
  tx: Tx,
  schoolId: string,
  snapshot: EnrollmentSnapshot,
  batch: string,
  reason: string,
  userId: string
) {
  await tx.enrollment.update({ where: { id: snapshot.id }, data: { status: 'PASSED_OUT', leftAt: new Date() } });
  await tx.student.update({ where: { id: snapshot.studentId }, data: { status: 'PASSED_OUT' } });
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
  | { success: true; summary: PromotionSummary; completedYear: { id: string; name: string }; activatedYear: { id: string; name: string } }
  | { success: false; code: 'TRANSITION_BLOCKED' | 'VALIDATION'; message: string; summary?: PromotionSummary };

export async function completeAcademicYearFlow(
  input: CloseYearInput,
  authCtx: AuthContext,
  ctx: RequestContext
): Promise<CloseYearResult> {
  // ── 1. Validate (single short transaction) ─────────────────────────────────
  const validation = await withRls(ctx, async (tx) => {
    const from = await tx.academicYear.findUnique({ where: { id: input.fromAcademicYearId } });
    const to = await tx.academicYear.findUnique({ where: { id: input.toAcademicYearId } });
    const activeElsewhere =
      (await tx.academicYear.count({
        where: { schoolId: input.schoolId, isActive: true, id: { not: input.fromAcademicYearId } },
      })) > 0;
    return { from, to, activeElsewhere };
  });

  if (!validation.from || validation.from.schoolId !== input.schoolId) {
    return { success: false, code: 'VALIDATION', message: 'Source academic year not found in this school' };
  }
  if (!validation.to || validation.to.schoolId !== input.schoolId) {
    return { success: false, code: 'VALIDATION', message: 'Target academic year not found in this school' };
  }
  if (input.fromAcademicYearId === input.toAcademicYearId) {
    return { success: false, code: 'VALIDATION', message: 'Source and target academic years must differ' };
  }
  if (validation.from.status !== 'ACTIVE' || !validation.from.isActive) {
    return {
      success: false,
      code: 'VALIDATION',
      message: 'Only the ACTIVE academic year can be completed (source year is not the active one)',
    };
  }
  if (validation.to.status === 'COMPLETED') {
    return { success: false, code: 'VALIDATION', message: 'Target academic year is already COMPLETED' };
  }
  if (validation.activeElsewhere) {
    return {
      success: false,
      code: 'VALIDATION',
      message: 'Another academic year is already ACTIVE — exactly one ACTIVE year is allowed',
    };
  }

  // ── 2. Process all eligible students (per-student transactions) ────────────
  const summary = await runPromotionBatch({ ...input, items: [] }, authCtx, ctx);

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
      where: { schoolId: input.schoolId, isActive: true, id: { not: input.fromAcademicYearId } },
      data: { isActive: false, isCurrent: false },
    });
    const completed = await tx.academicYear.update({
      where: { id: input.fromAcademicYearId },
      data: { status: 'COMPLETED', isActive: false, isCurrent: false, updatedBy: authCtx.userId },
    });
    const activated = await tx.academicYear.update({
      where: { id: input.toAcademicYearId },
      data: { status: 'ACTIVE', isActive: true, isCurrent: true, updatedBy: authCtx.userId },
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
    completedYear: { id: transition.completed.id, name: transition.completed.name },
    activatedYear: { id: transition.activated.id, name: transition.activated.name },
  };
}
