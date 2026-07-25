import { withRls, type RequestContext } from '@/lib/prisma/rls-middleware';
import type { AttendanceStatus } from '@/generated/prisma/client';
import type { AuthContext } from '@/lib/auth/context';
import { Prisma } from '@/generated/prisma/client';

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

async function validateEnrollmentEligibility(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: Record<string, any>,
  studentMembershipId: string,
  attendanceDate: Date,
  classId: string
) {
  const enrollment = await tx.classEnrollment.findFirst({
    where: {
      studentMembershipId: studentMembershipId,
      classId,
      joinedAt: { lte: attendanceDate },
      OR: [{ leftAt: null }, { leftAt: { gte: attendanceDate } }],
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
      input.classId
    );

    const existing = await tx.attendanceRecord.findFirst({
      where: {
        studentMembershipId: input.studentMembershipId,
        date: new Date(input.date),
        isDeleted: false,
      },
    });

    if (existing) {
      throw new Error(
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

    for (const rec of input.records) {
      await validateEnrollmentEligibility(
        tx,
        rec.studentMembershipId,
        attendanceDate,
        input.classId
      );

      const existing = await tx.attendanceRecord.findFirst({
        where: {
          studentMembershipId: rec.studentMembershipId,
          date: attendanceDate,
          isDeleted: false,
        },
      });
      if (existing) {
        throw new Error(
          `Attendance already recorded for student ${rec.studentMembershipId} on this date.`
        );
      }
    }

    const records = [];
    for (const rec of input.records) {
      const record = await tx.attendanceRecord.create({
        data: {
          schoolId: input.schoolId,
          classId: input.classId,
          studentMembershipId: rec.studentMembershipId,
          date: attendanceDate,
          status: rec.status,
          markedByMembershipId: ctx.membershipId || authCtx.membershipId,
          notes: rec.notes,
          createdBy: authCtx.userId,
        },
      });
      records.push(record);
    }

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
    const existing = await tx.attendanceRecord.findUnique({ where: { id } });
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
      where: { classId, date: new Date(date), isDeleted: false },
      include: {
        studentMembership: {
          include: { user: { select: { name: true, email: true } } },
        },
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
