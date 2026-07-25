import { prisma } from '@/lib/prisma/client';
import {
  hasPermission,
  type Resource,
  type Action,
} from '@/lib/permissions/permissions';
import type { AuthContext } from '@/lib/auth/context';

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export async function requireAuth(): Promise<AuthContext> {
  const { getAuthContext } = await import('@/lib/auth/context');
  const ctx = await getAuthContext();
  if (!ctx) {
    throw new AuthorizationError('Not authenticated');
  }
  return ctx;
}

export async function requirePermission(
  ctx: AuthContext,
  resource: Resource,
  action: Action
): Promise<void> {
  if (!hasPermission(ctx.role, resource, action)) {
    throw new AuthorizationError(
      `Role ${ctx.role} does not have ${action} permission on ${resource}`
    );
  }
}

export async function requireActiveMembership(
  userId: string,
  schoolId: string
): Promise<{ id: string; role: string; schoolId: string }> {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      schoolId,
      status: 'ACTIVE',
    },
  });

  if (!membership) {
    throw new AuthorizationError('No active membership found for this school');
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { status: true },
  });

  if (!school || school.status !== 'ACTIVE') {
    throw new AuthorizationError('School is not active');
  }

  return {
    id: membership.id,
    role: membership.role,
    schoolId: membership.schoolId,
  };
}

export async function requireSchoolActive(schoolId: string): Promise<void> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { status: true },
  });

  if (!school) {
    throw new AuthorizationError('School not found');
  }

  if (school.status === 'SUSPENDED') {
    throw new AuthorizationError('School account has been suspended');
  }

  if (school.status === 'ARCHIVED') {
    throw new AuthorizationError('School account has been archived');
  }
}
