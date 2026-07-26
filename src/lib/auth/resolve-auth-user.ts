import { authPrisma } from '@/lib/prisma/auth-client';
import type { User, Membership, School } from '@/generated/prisma/client';

type MembershipWithSchool = Membership & { school: Pick<School, 'status'> };
type UserWithMemberships = User & { memberships: MembershipWithSchool[] };

export type AuthResolution =
  | {
      ok: true;
      user: UserWithMemberships;
      membership: MembershipWithSchool;
    }
  | {
      ok: false;
      reason:
        | 'ACCOUNT_NOT_FOUND'
        | 'ACCOUNT_DISABLED'
        | 'NO_ACTIVE_MEMBERSHIP'
        | 'SCHOOL_SUSPENDED'
        | 'SCHOOL_ARCHIVED';
    };

export async function resolveAuthUser(userId: string): Promise<AuthResolution> {
  const user = (await authPrisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: { status: 'ACTIVE' },
        include: {
          school: { select: { status: true } },
        },
        orderBy: { joinedAt: 'desc' },
      },
    },
  })) as UserWithMemberships | null;

  if (!user) {
    return { ok: false, reason: 'ACCOUNT_NOT_FOUND' };
  }

  if (user.status !== 'active') {
    return { ok: false, reason: 'ACCOUNT_DISABLED' };
  }

  if (user.memberships.length === 0) {
    return { ok: false, reason: 'NO_ACTIVE_MEMBERSHIP' };
  }

  const membership = user.memberships[0];

  if (membership.school.status === 'SUSPENDED') {
    return { ok: false, reason: 'SCHOOL_SUSPENDED' };
  }

  if (membership.school.status === 'ARCHIVED') {
    return { ok: false, reason: 'SCHOOL_ARCHIVED' };
  }

  return { ok: true, user, membership };
}
