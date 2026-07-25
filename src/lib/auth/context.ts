import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma/client';
import { headers } from 'next/headers';
import type { RequestContext } from '@/lib/prisma/rls-middleware';
import { buildContext } from '@/lib/prisma/rls-middleware';

export interface AuthContext {
  userId: string;
  email: string;
  membershipId: string;
  schoolId: string;
  role: string;
  schoolStatus: string;
}

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getSession();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      memberships: {
        where: { status: 'ACTIVE' },
        include: {
          school: { select: { status: true } },
        },
        orderBy: { joinedAt: 'desc' },
      },
    },
  });

  if (!user || user.status !== 'active' || user.memberships.length === 0) {
    return null;
  }

  const membership = user.memberships[0];
  if (membership.school.status !== 'ACTIVE') return null;

  return {
    userId: user.id,
    email: user.email,
    membershipId: membership.id,
    schoolId: membership.schoolId,
    role: membership.role,
    schoolStatus: membership.school.status,
  };
}

export function toRequestContext(authCtx: AuthContext): RequestContext {
  return buildContext(authCtx.userId, {
    id: authCtx.membershipId,
    schoolId: authCtx.schoolId,
    role: authCtx.role,
  });
}
