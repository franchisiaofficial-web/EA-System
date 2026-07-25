import { withRls, type RequestContext } from '@/lib/prisma/rls-middleware';
import type { AuthContext } from '@/lib/auth/context';
import type { Role } from '@/generated/prisma/client';
import type { Prisma } from '@/generated/prisma/client';

export async function getSchoolMembers(schoolId: string, ctx: RequestContext) {
  return withRls(ctx, (tx) =>
    tx.membership.findMany({
      where: { schoolId, status: 'ACTIVE' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    })
  );
}

export async function getMemberCount(schoolId: string, ctx: RequestContext) {
  return withRls(ctx, (tx) =>
    tx.membership.count({
      where: { schoolId, status: 'ACTIVE' },
    })
  );
}

export async function inviteUser(
  schoolId: string,
  email: string,
  role: Role,
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await tx.invite.create({
      data: {
        schoolId,
        email,
        role,
        token,
        invitedById: authCtx.userId,
        expiresAt,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId,
        action: 'create',
        entity: 'invite',
        recordId: invite.id,
        after: { email, role, schoolId } as Prisma.InputJsonValue,
      },
    });

    return invite;
  });
}

export async function acceptInvite(
  token: string,
  userId: string,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const invite = await tx.invite.findUnique({
      where: { token },
      include: { school: { select: { status: true } } },
    });

    if (!invite) throw new Error('Invite not found');
    if (invite.status !== 'PENDING')
      throw new Error('Invite is no longer pending');
    if (invite.expiresAt < new Date()) throw new Error('Invite has expired');

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || invite.email !== user.email) {
      throw new Error('Invite email does not match user email');
    }
    if (invite.school.status !== 'ACTIVE')
      throw new Error('School is not active');

    const membership = await tx.membership.upsert({
      where: {
        schoolId_userId_role: {
          schoolId: invite.schoolId,
          userId,
          role: invite.role,
        },
      },
      update: { status: 'ACTIVE' },
      create: {
        schoolId: invite.schoolId,
        userId,
        role: invite.role,
        status: 'ACTIVE',
      },
    });

    await tx.invite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED' },
    });

    await tx.auditLog.create({
      data: {
        userId,
        schoolId: invite.schoolId,
        action: 'accept_invite',
        entity: 'membership',
        recordId: membership.id,
        after: {
          role: invite.role,
          schoolId: invite.schoolId,
        } as Prisma.InputJsonValue,
      },
    });

    return membership;
  });
}

export async function suspendMembership(
  membershipId: string,
  authCtx: AuthContext,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const membership = await tx.membership.update({
      where: { id: membershipId },
      data: { status: 'SUSPENDED' },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: membership.schoolId,
        action: 'suspend',
        entity: 'membership',
        recordId: membershipId,
        before: { status: 'ACTIVE' } as Prisma.InputJsonValue,
        after: { status: 'SUSPENDED' } as Prisma.InputJsonValue,
      },
    });

    return membership;
  });
}
