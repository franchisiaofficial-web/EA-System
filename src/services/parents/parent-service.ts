import { withRls, type RequestContext } from '@/lib/prisma/rls-middleware';
import type { Prisma, Relationship } from '@/generated/prisma/client';
import type { AuthContext } from '@/lib/auth/context';

export async function linkParentToStudent(
  input: {
    schoolId: string;
    parentMembershipId: string;
    studentMembershipId: string;
    relationship?: Relationship;
  },
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const existing = await tx.parentStudentLink.findFirst({
      where: {
        parentMembershipId: input.parentMembershipId,
        studentMembershipId: input.studentMembershipId,
        status: 'ACTIVE',
      },
    });

    if (existing) {
      throw new Error(
        'An active parent-student link already exists for this pair'
      );
    }

    const link = await tx.parentStudentLink.create({
      data: {
        schoolId: input.schoolId,
        parentMembershipId: input.parentMembershipId,
        studentMembershipId: input.studentMembershipId,
        relationship: input.relationship ?? 'FATHER',
        createdBy: authCtx.userId,
      },
      include: {
        parentMembership: {
          include: { user: { select: { name: true, email: true } } },
        },
        studentMembership: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: input.schoolId,
        action: 'create',
        entity: 'parent_student_link',
        recordId: link.id,
        after: {
          parentMembershipId: input.parentMembershipId,
          studentMembershipId: input.studentMembershipId,
        } as Prisma.InputJsonValue,
      },
    });

    return link;
  });
}

export async function removeParentLink(
  linkId: string,
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const link = await tx.parentStudentLink.update({
      where: { id: linkId },
      data: { status: 'REMOVED', updatedBy: authCtx.userId },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: link.schoolId,
        action: 'remove',
        entity: 'parent_student_link',
        recordId: linkId,
        before: { status: 'ACTIVE' } as Prisma.InputJsonValue,
        after: { status: 'REMOVED' } as Prisma.InputJsonValue,
      },
    });

    return link;
  });
}

export async function getLinkedStudents(
  parentMembershipId: string,
  ctx: RequestContext
) {
  return withRls(ctx, (tx) =>
    tx.parentStudentLink.findMany({
      where: { parentMembershipId, status: 'ACTIVE' },
      include: {
        studentMembership: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    })
  );
}

export async function getLinkedParents(
  studentMembershipId: string,
  ctx: RequestContext
) {
  return withRls(ctx, (tx) =>
    tx.parentStudentLink.findMany({
      where: { studentMembershipId, status: 'ACTIVE' },
      include: {
        parentMembership: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    })
  );
}
