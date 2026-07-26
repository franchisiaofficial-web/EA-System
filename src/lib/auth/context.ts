import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import type { RequestContext } from '@/lib/prisma/rls-middleware';
import { buildContext } from '@/lib/prisma/rls-middleware';
import { resolveAuthUser } from '@/lib/auth/resolve-auth-user';

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

  const result = await resolveAuthUser(session.user.id);

  if (!result.ok) return null;

  return {
    userId: result.user.id,
    email: result.user.email,
    membershipId: result.membership.id,
    schoolId: result.membership.schoolId,
    role: result.membership.role,
    schoolStatus: result.membership.school.status,
  };
}

export function toRequestContext(authCtx: AuthContext): RequestContext {
  return buildContext(authCtx.userId, {
    id: authCtx.membershipId,
    schoolId: authCtx.schoolId,
    role: authCtx.role,
  });
}
