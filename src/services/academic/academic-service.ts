import { withRls, type RequestContext } from '@/lib/prisma/rls-middleware';
import type {
  Prisma,
  SectionStatus,
  AssignmentRole,
  ClassStatus,
} from '@/generated/prisma/client';
import type { AuthContext } from '@/lib/auth/context';

// ============================================
// Academic Years
// ============================================

export async function createAcademicYear(
  input: {
    schoolId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isActive?: boolean;
  },
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    if (input.isActive) {
      await tx.academicYear.updateMany({
        where: { schoolId: input.schoolId, isActive: true },
        data: { isActive: false },
      });
    }

    const year = await tx.academicYear.create({
      data: {
        schoolId: input.schoolId,
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        isActive: input.isActive ?? false,
        createdBy: authCtx.userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: input.schoolId,
        action: 'create',
        entity: 'academic_year',
        recordId: year.id,
        after: {
          name: input.name,
          isActive: input.isActive ?? false,
        } as Prisma.InputJsonValue,
      },
    });

    return year;
  });
}

export async function updateAcademicYear(
  id: string,
  input: { name?: string; startDate?: Date; endDate?: Date },
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const existing = await tx.academicYear.findUnique({ where: { id } });
    if (!existing) throw new Error('Academic year not found');

    const updated = await tx.academicYear.update({
      where: { id },
      data: { ...input, updatedBy: authCtx.userId },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: existing.schoolId,
        action: 'update',
        entity: 'academic_year',
        recordId: id,
        before: { name: existing.name } as Prisma.InputJsonValue,
        after: { name: updated.name } as Prisma.InputJsonValue,
      },
    });

    return updated;
  });
}

export async function activateAcademicYear(
  id: string,
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const year = await tx.academicYear.findUnique({ where: { id } });
    if (!year) throw new Error('Academic year not found');

    // Previously active years are handled by the partial unique index
    await tx.academicYear.updateMany({
      where: { schoolId: year.schoolId, isActive: true, id: { not: id } },
      data: { isActive: false },
    });

    const active = await tx.academicYear.update({
      where: { id },
      data: { isActive: true, updatedBy: authCtx.userId },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: year.schoolId,
        action: 'activate',
        entity: 'academic_year',
        recordId: id,
        after: { name: year.name } as Prisma.InputJsonValue,
      },
    });

    return active;
  });
}

export async function getAcademicYears(schoolId: string, ctx: RequestContext) {
  return withRls(ctx, (tx) =>
    tx.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { classes: true } } },
    })
  );
}

// ============================================
// Sections
// ============================================

export async function createSection(
  input: { schoolId: string; classId: string; name: string; description?: string },
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const section = await tx.section.create({
      data: {
        schoolId: input.schoolId,
        classId: input.classId,
        name: input.name,
        description: input.description,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: input.schoolId,
        action: 'create',
        entity: 'section',
        recordId: section.id,
        after: { name: input.name } as Prisma.InputJsonValue,
      },
    });

    return section;
  });
}

export async function updateSection(
  id: string,
  input: { name?: string; description?: string; status?: SectionStatus },
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const section = await tx.section.update({ where: { id }, data: input });
    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: section.schoolId,
        action: 'update',
        entity: 'section',
        recordId: id,
        after: { name: input.name } as Prisma.InputJsonValue,
      },
    });
    return section;
  });
}

export async function getSections(schoolId: string, ctx: RequestContext) {
  return withRls(ctx, (tx) =>
    tx.section.findMany({
      where: { schoolId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    })
  );
}

// ============================================
// Classes
// ============================================

export async function createClass(
  input: {
    schoolId: string;
    academicYearId: string;
    name: string;
    gradeLevel?: string;
  },
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const cls = await tx.class.create({
      data: {
        schoolId: input.schoolId,
        academicYearId: input.academicYearId,
        name: input.name,
        gradeLevel: input.gradeLevel,
        createdBy: authCtx.userId,
      },
      include: { sections: true, academicYear: true },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: input.schoolId,
        action: 'create',
        entity: 'class',
        recordId: cls.id,
        after: {
          name: input.name,
          gradeLevel: input.gradeLevel,
        } as Prisma.InputJsonValue,
      },
    });

    return cls;
  });
}

export async function updateClass(
  id: string,
  input: { name?: string; gradeLevel?: string; status?: ClassStatus },
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const cls = await tx.class.update({
      where: { id },
      data: { ...input, updatedBy: authCtx.userId },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: cls.schoolId,
        action: 'update',
        entity: 'class',
        recordId: id,
        after: { name: cls.name } as Prisma.InputJsonValue,
      },
    });

    return cls;
  });
}

export async function archiveClass(
  id: string,
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const cls = await tx.class.update({
      where: { id },
      data: { status: 'ARCHIVED', isDeleted: true, updatedBy: authCtx.userId },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: cls.schoolId,
        action: 'archive',
        entity: 'class',
        recordId: id,
        before: { name: cls.name } as Prisma.InputJsonValue,
      },
    });

    return cls;
  });
}

export async function getClass(id: string, ctx: RequestContext) {
  return withRls(ctx, (tx) =>
    tx.class.findUnique({
      where: { id },
      include: {
        sections: true,
        academicYear: true,
        _count: { select: { enrollmentRecords: { where: { status: 'ACTIVE' } }, assignments: true } },
      },
    })
  );
}

export async function listClasses(
  schoolId: string,
  ctx: RequestContext,
  academicYearId?: string
) {
  return withRls(ctx, (tx) =>
    tx.class.findMany({
      where: {
        schoolId,
        isDeleted: false,
        ...(academicYearId ? { academicYearId } : {}),
      },
      include: {
        sections: true,
        academicYear: true,
        _count: { select: { enrollmentRecords: { where: { status: 'ACTIVE' } }, assignments: true } },
      },
      orderBy: { name: 'asc' },
    })
  );
}

// ============================================
// Class Assignments
// ============================================

export async function assignTeacher(
  input: {
    schoolId: string;
    classId: string;
    teacherMembershipId: string;
    role?: AssignmentRole;
  },
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const role = input.role ?? 'PRIMARY';

    const assignment = await tx.classAssignment.create({
      data: {
        schoolId: input.schoolId,
        classId: input.classId,
        teacherMembershipId: input.teacherMembershipId,
        role: role,
      },
      include: {
        teacherMembership: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: input.schoolId,
        action: 'assign_teacher',
        entity: 'class_assignment',
        recordId: assignment.id,
        after: {
          classId: input.classId,
          teacherMembershipId: input.teacherMembershipId,
          role,
        } as Prisma.InputJsonValue,
      },
    });

    return assignment;
  });
}

export async function removeTeacher(
  assignmentId: string,
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const assignment = await tx.classAssignment.update({
      where: { id: assignmentId },
      data: { status: 'REMOVED' },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: assignment.schoolId,
        action: 'remove_teacher',
        entity: 'class_assignment',
        recordId: assignmentId,
        before: { status: 'ACTIVE' } as Prisma.InputJsonValue,
        after: { status: 'REMOVED' } as Prisma.InputJsonValue,
      },
    });

    return assignment;
  });
}

export async function getAssignments(classId: string, ctx: RequestContext) {
  return withRls(ctx, (tx) =>
    tx.classAssignment.findMany({
      where: { classId, status: 'ACTIVE' },
      include: {
        teacherMembership: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    })
  );
}

// ============================================
// Class Enrollments
// ============================================

export async function enrollStudent(
  input: { schoolId: string; classId: string; studentMembershipId: string },
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const enrollment = await tx.classEnrollment.create({
      data: {
        schoolId: input.schoolId,
        classId: input.classId,
        studentMembershipId: input.studentMembershipId,
      },
      include: {
        studentMembership: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: input.schoolId,
        action: 'enroll',
        entity: 'class_enrollment',
        recordId: enrollment.id,
        after: {
          classId: input.classId,
          studentMembershipId: input.studentMembershipId,
        } as Prisma.InputJsonValue,
      },
    });

    return enrollment;
  });
}

export async function transferStudent(
  enrollmentId: string,
  targetClassId: string,
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const enrollment = await tx.classEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { class: true },
    });
    if (!enrollment) throw new Error('Enrollment not found');

    const targetClass = await tx.class.findUnique({
      where: { id: targetClassId },
    });
    if (!targetClass) throw new Error('Target class not found');
    if (targetClass.schoolId !== enrollment.schoolId)
      throw new Error('Cross-school transfer not supported');

    // Close current enrollment
    await tx.classEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'TRANSFERRED', leftAt: new Date(), isDeleted: true },
    });

    // Create new enrollment
    const newEnrollment = await tx.classEnrollment.create({
      data: {
        schoolId: enrollment.schoolId,
        classId: targetClassId,
        studentMembershipId: enrollment.studentMembershipId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: enrollment.schoolId,
        action: 'transfer',
        entity: 'class_enrollment',
        recordId: newEnrollment.id,
        after: {
          fromClassId: enrollment.classId,
          toClassId: targetClassId,
        } as Prisma.InputJsonValue,
      },
    });

    return newEnrollment;
  });
}

export async function archiveEnrollment(
  enrollmentId: string,
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const enrollment = await tx.classEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'WITHDRAWN', leftAt: new Date(), isDeleted: true },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: enrollment.schoolId,
        action: 'archive_enrollment',
        entity: 'class_enrollment',
        recordId: enrollmentId,
      },
    });

    return enrollment;
  });
}

export async function getEnrollments(classId: string, ctx: RequestContext) {
  // Roster source: Category A (Enrollment, ACTIVE) — resolution of the Phase 1A
  // roster gate (2026-08-01). Category C (class_enrollments) has no producer;
  // Category A is the single source of truth (one ACTIVE row per school+student,
  // DB-enforced). Historical statuses (PROMOTED/PASSED_OUT/...) are excluded.
  return withRls(ctx, async (tx) => {
    const rows = await tx.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      select: {
        id: true,
        student: {
          select: {
            user: {
              select: {
                name: true,
                memberships: {
                  where: { schoolId: ctx.schoolId ?? '', role: 'STUDENT', status: 'ACTIVE' },
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((e) => ({
      id: e.id,
      studentMembershipId: e.student.user?.memberships?.[0]?.id ?? '',
      studentMembership: {
        user: { name: e.student.user?.name ?? 'Unknown' },
      },
    }));
  });
}
