import { withRls, type RequestContext } from '@/lib/prisma/rls-middleware';
import type { AttendanceStatus } from '@/generated/prisma/client';
import type { AuthContext } from '@/lib/auth/context';
import { Prisma } from '@/generated/prisma/client';
import { createId } from '@paralleldrive/cuid2';

export class AttendanceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttendanceConflictError';
  }
}

export const ATTENDANCE_BACKDATE_LIMIT_DAYS = 3;

export function calculateAttendancePercentage(stats: {
  present: number;
  late: number;
  absent: number;
  excused: number;
}): number {
  const numerator = stats.present + stats.late;
  const denominator = stats.present + stats.late + stats.absent;
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function getSchoolDate(now: Date, timezone: string): Date {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(dateStr);
}

function isValidAttendanceDate(
  attendanceDate: Date,
  schoolDate: Date
): boolean {
  const diffMs = schoolDate.getTime() - attendanceDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= ATTENDANCE_BACKDATE_LIMIT_DAYS;
}

async function resolveStudentIdFromMembership(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: Record<string, any>,
  studentMembershipId: string,
  schoolId: string
): Promise<string | null> {
  const membership = await tx.membership.findFirst({
    where: { id: studentMembershipId, schoolId },
    select: { userId: true },
  });
  if (!membership?.userId) return null;
  const student = await tx.student.findFirst({
    where: { userId: membership.userId, schoolId },
    select: { id: true },
  });
  return student?.id ?? null;
}

async function validateEnrollmentEligibility(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: Record<string, any>,
  studentMembershipId: string,
  attendanceDate: Date,
  classId: string,
  schoolId: string
) {
  const studentId = await resolveStudentIdFromMembership(tx, studentMembershipId, schoolId);
  if (!studentId) {
    throw new Error(
      'Student is not eligible for attendance on this date. No student account is linked to this membership.'
    );
  }

  const dayStart = new Date(attendanceDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(attendanceDate);
  dayEnd.setHours(23, 59, 59, 999);

  const enrollment = await tx.enrollment.findFirst({
    where: {
      schoolId,
      studentId,
      classId,
      status: 'ACTIVE',
      joinedAt: { lte: dayEnd },
      OR: [{ leftAt: null }, { leftAt: { gte: dayStart } }],
    },
  });

  if (!enrollment) {
    throw new Error(
      'Student is not eligible for attendance on this date. The student was not enrolled in this class on the attendance date.'
    );
  }
}

// ============================================
// Mark Attendance
// ============================================

export async function markAttendance(
  input: {
    schoolId: string;
    classId: string;
    studentMembershipId: string;
    date: Date;
    status: AttendanceStatus;
    notes?: string;
  },
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const school = await tx.school.findUnique({
      where: { id: input.schoolId },
      select: { timezone: true },
    });
    if (!school) throw new Error('School not found');

    const schoolDate = getSchoolDate(new Date(), school.timezone);

    if (!isValidAttendanceDate(new Date(input.date), schoolDate)) {
      throw new Error(
        `Attendance may only be marked for today or up to ${ATTENDANCE_BACKDATE_LIMIT_DAYS} days ago.`
      );
    }

    await validateEnrollmentEligibility(
      tx,
      input.studentMembershipId,
      new Date(input.date),
      input.classId,
      input.schoolId
    );

    const existing = await tx.attendanceRecord.findFirst({
      where: {
        schoolId: input.schoolId,
        studentMembershipId: input.studentMembershipId,
        date: new Date(input.date),
        isDeleted: false,
      },
    });

    if (existing) {
      throw new AttendanceConflictError(
        'Attendance already recorded for this student on this date.'
      );
    }

    const record = await tx.attendanceRecord.create({
      data: {
        schoolId: input.schoolId,
        classId: input.classId,
        studentMembershipId: input.studentMembershipId,
        date: new Date(input.date),
        status: input.status,
        markedByMembershipId: ctx.membershipId || authCtx.membershipId,
        notes: input.notes,
        createdBy: authCtx.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: input.schoolId,
        action: 'create',
        entity: 'attendance_record',
        recordId: record.id,
        after: {
          studentMembershipId: input.studentMembershipId,
          date: input.date.toISOString(),
          status: input.status,
        } as Prisma.InputJsonValue,
      },
    });

    return record;
  });
}

// ============================================
// Bulk Mark Attendance
// ============================================

export async function bulkMarkAttendance(
  input: {
    schoolId: string;
    classId: string;
    date: Date;
    records: Array<{
      studentMembershipId: string;
      status: AttendanceStatus;
      notes?: string;
    }>;
  },
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    // Phase 1.5 tenant isolation (defense in depth): the operation's school
    // must match the authenticated session's school. The action/route layers
    // already derive schoolId from the session; this asserts it at the
    // service boundary so a misrouted call can never target another tenant.
    if (input.schoolId !== authCtx.schoolId) {
      throw new Error('School mismatch: operation scoped to authenticated school only');
    }
    const school = await tx.school.findUnique({
      where: { id: input.schoolId },
      select: { timezone: true },
    });
    if (!school) throw new Error('School not found');

    const schoolDate = getSchoolDate(new Date(), school.timezone);

    if (!isValidAttendanceDate(new Date(input.date), schoolDate)) {
      throw new Error(
        `Attendance may only be marked for today or up to ${ATTENDANCE_BACKDATE_LIMIT_DAYS} days ago.`
      );
    }

    const uniqueIds = new Set(input.records.map((r) => r.studentMembershipId));
    if (uniqueIds.size !== input.records.length) {
      throw new Error('Duplicate student IDs in request.');
    }

    const attendanceDate = new Date(input.date);

    // Expand the "*" wildcard into the roster of students actively enrolled in
    // this class on the attendance date (Enrollment is the single source of truth).
    const dayStart = new Date(attendanceDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(attendanceDate);
    dayEnd.setHours(23, 59, 59, 999);
    const expandedRecords: Array<{
      studentMembershipId: string;
      status: AttendanceStatus;
      notes?: string;
    }> = [];
    for (const rec of input.records) {
      if (rec.studentMembershipId === '*') {
        const roster = await tx.enrollment.findMany({
          where: {
            schoolId: input.schoolId,
            classId: input.classId,
            status: 'ACTIVE',
            joinedAt: { lte: dayEnd },
            OR: [{ leftAt: null }, { leftAt: { gte: dayStart } }],
          },
          select: {
            student: {
              select: {
                user: {
                  select: {
                    memberships: {
                      where: { schoolId: input.schoolId, role: 'STUDENT', status: 'ACTIVE' },
                      select: { id: true },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        });
        for (const e of roster) {
          const mid = e.student.user?.memberships?.[0]?.id;
          if (mid) expandedRecords.push({ studentMembershipId: mid, status: rec.status, notes: rec.notes });
        }
      } else {
        expandedRecords.push(rec);
      }
    }

    // Batch validation + insert in a constant, minimal number of round trips
    // (the DB is remote — one query per student is the dominant cost). One
    // validation query resolves membership→student→eligibility→existing for
    // every record, then a single INSERT ... RETURNING creates them.
    const mids = expandedRecords.map((r) => r.studentMembershipId);
    const statuses = expandedRecords.map((r) => r.status);
    const notes = expandedRecords.map((r) => r.notes ?? null);
    const ids = expandedRecords.map(() => createId());
    const dateStr = attendanceDate.toISOString().slice(0, 10);

    // School-scoped validation: membership, student, enrollment and existing
    // records are all resolved under the authenticated school (schoolId is
    // passed as $6). Rows belonging to any other school are invisible to this
    // statement, so a cross-tenant studentMembershipId or classId resolves to
    // a NULL/not-eligible row and is rejected before the INSERT executes.
    const validation = await tx.$queryRawUnsafe<
      Array<{ mid: string; student_id: string | null; eligible: boolean; existing: boolean }>
    >(
      `SELECT m.id AS mid, s.id AS student_id,
              (e.id IS NOT NULL) AS eligible,
              (ar.id IS NOT NULL) AS existing
       FROM unnest($1::text[]) AS t(mid)
       LEFT JOIN memberships m ON m.id = t.mid AND m.school_id = $6
       LEFT JOIN students s ON s.user_id = m.user_id AND s.school_id = $6
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.class_id = $2
            AND e.school_id = $6
            AND e.status = 'ACTIVE'
            AND e.joined_at <= $3::timestamptz
            AND (e.left_at IS NULL OR e.left_at >= $4::timestamptz)
       LEFT JOIN attendance_records ar ON ar.student_membership_id = m.id
            AND ar.school_id = $6
            AND ar.date = $5::date AND ar.is_deleted = false`,
      mids,
      input.classId,
      dayEnd.toISOString(),
      dayStart.toISOString(),
      dateStr,
      input.schoolId
    );
    const validByMid = new Map(validation.map((v) => [v.mid, v]));
    for (const rec of expandedRecords) {
      const v = validByMid.get(rec.studentMembershipId);
      if (!v?.student_id) {
        throw new Error(
          'Student is not eligible for attendance on this date. No student account is linked to this membership.'
        );
      }
      if (!v.eligible) {
        throw new Error(
          'Student is not eligible for attendance on this date. The student was not enrolled in this class on the attendance date.'
        );
      }
      if (v.existing) {
        throw new AttendanceConflictError(
          `Attendance already recorded for student ${rec.studentMembershipId} on this date.`
        );
      }
    }

    const inserted = await tx.$queryRawUnsafe<
      Array<{
        id: string;
        student_membership_id: string;
        status: AttendanceStatus;
        marked_at: Date;
        created_at: Date;
      }>
    >(
      `INSERT INTO attendance_records
         (id, school_id, class_id, student_membership_id, date, status,
          marked_by_membership_id, notes, created_by, updated_at)
       SELECT t.id, $1::text, $2::text, t.mid, $3::date, t.status::"AttendanceStatus",
              $4::text, t.notes, $5::text, CURRENT_TIMESTAMP
       FROM unnest($6::text[], $7::text[], $8::text[], $9::text[]) AS t(mid, status, notes, id)
       WHERE NOT EXISTS (
         SELECT 1 FROM attendance_records ar
         WHERE ar.student_membership_id = t.mid AND ar.date = $3::date
           AND ar.school_id = $1::text
           AND ar.is_deleted = false
       )
       RETURNING id, student_membership_id, status, marked_at, created_at`,
      input.schoolId,
      input.classId,
      dateStr,
      ctx.membershipId || authCtx.membershipId,
      authCtx.userId,
      mids,
      statuses,
      notes,
      ids
    );

    const order = new Map(mids.map((m, i) => [m, i]));
    const ordered = [...inserted].sort(
      (a, b) =>
        (order.get(a.student_membership_id) ?? 0) -
        (order.get(b.student_membership_id) ?? 0)
    );
    const records = ordered.map((r) => ({
      id: r.id,
      schoolId: input.schoolId,
      classId: input.classId,
      studentMembershipId: r.student_membership_id,
      date: attendanceDate,
      status: r.status,
      markedByMembershipId: ctx.membershipId || authCtx.membershipId,
      markedAt: r.marked_at,
      notes: null,
      isDeleted: false,
      createdAt: r.created_at,
      updatedAt: r.created_at,
      createdBy: authCtx.userId,
      updatedBy: null,
    }));

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: input.schoolId,
        action: 'bulk_create',
        entity: 'attendance_record',
        recordId: records[0]?.id,
        after: {
          count: records.length,
          date: input.date.toISOString(),
          classId: input.classId,
        } as Prisma.InputJsonValue,
      },
    });

    return records;
  });
}

// ============================================
// Update Attendance
// ============================================

export async function updateAttendanceRecord(
  id: string,
  input: { status: AttendanceStatus; notes?: string },
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const existing = await tx.attendanceRecord.findFirst({
      where: { id, ...(ctx.schoolId ? { schoolId: ctx.schoolId } : {}) },
    });
    if (!existing) throw new Error('Attendance record not found');
    if (existing.isDeleted) throw new Error('Cannot update deleted record');

    const school = await tx.school.findUnique({
      where: { id: existing.schoolId },
      select: { timezone: true },
    });
    if (!school) throw new Error('School not found');

    const schoolDate = getSchoolDate(new Date(), school.timezone);
    if (!isValidAttendanceDate(new Date(existing.date), schoolDate)) {
      throw new Error(
        `Attendance older than ${ATTENDANCE_BACKDATE_LIMIT_DAYS} days cannot be edited.`
      );
    }

    const updated = await tx.attendanceRecord.update({
      where: { id },
      data: {
        status: input.status,
        notes: input.notes ?? existing.notes,
        updatedBy: authCtx.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: existing.schoolId,
        action: 'update',
        entity: 'attendance_record',
        recordId: id,
        before: { status: existing.status } as Prisma.InputJsonValue,
        after: { status: input.status } as Prisma.InputJsonValue,
      },
    });

    return updated;
  });
}

// ============================================
// Get Attendance
// ============================================

export async function getClassAttendance(
  classId: string,
  date: Date,
  ctx: RequestContext
) {
  return withRls(ctx, (tx) =>
    tx.attendanceRecord.findMany({
      where: {
        classId,
        date: new Date(date),
        isDeleted: false,
        ...(ctx.schoolId ? { schoolId: ctx.schoolId } : {}),
      },
      include: {
        studentMembership: {
          include: { user: { select: { name: true, email: true } } },
        },
        class: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
  );
}

export async function getStudentAttendance(
  studentMembershipId: string,
  ctx: RequestContext,
  fromDate?: Date,
  toDate?: Date
) {
  return withRls(ctx, async (tx) => {
    return tx.attendanceRecord.findMany({
      where: {
        studentMembershipId,
        isDeleted: false,
        ...(ctx.schoolId ? { schoolId: ctx.schoolId } : {}),
        ...(fromDate ? { date: { gte: new Date(fromDate) } } : {}),
        ...(toDate ? { date: { lte: new Date(toDate) } } : {}),
      },
      orderBy: { date: 'desc' },
      include: { class: { select: { name: true } } },
    });
  });
}

export async function getAttendanceSummary(
  studentMembershipId: string,
  fromDate: Date,
  toDate: Date,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const records = await tx.attendanceRecord.findMany({
      where: {
        studentMembershipId,
        isDeleted: false,
        ...(ctx.schoolId ? { schoolId: ctx.schoolId } : {}),
        date: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
      select: { status: true },
    });

    const stats = { present: 0, late: 0, absent: 0, excused: 0 };
    for (const r of records) {
      if (r.status === 'PRESENT') stats.present++;
      else if (r.status === 'LATE') stats.late++;
      else if (r.status === 'ABSENT') stats.absent++;
      else if (r.status === 'EXCUSED') stats.excused++;
    }

    return {
      ...stats,
      total: records.length,
      percentage: calculateAttendancePercentage(stats),
    };
  });
}
