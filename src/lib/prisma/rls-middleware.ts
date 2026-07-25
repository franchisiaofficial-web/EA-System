import { prisma } from './client';
import type { PrismaClient } from '@/generated/prisma/client';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface RequestContext {
  userId: string;
  schoolId?: string;
  membershipId?: string;
  role?: string;
}

export async function withRls<T>(
  ctx: RequestContext,
  fn: (tx: PrismaTransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT set_config('app.current_user_id', ${ctx.userId}, true)
    `;
    if (ctx.schoolId) {
      await tx.$executeRaw`
        SELECT set_config('app.current_school_id', ${ctx.schoolId}, true)
      `;
    }
    if (ctx.membershipId) {
      await tx.$executeRaw`
        SELECT set_config('app.current_membership_id', ${ctx.membershipId}, true)
      `;
    }
    if (ctx.role) {
      await tx.$executeRaw`
        SELECT set_config('app.current_role', ${ctx.role}, true)
      `;
    }
    return fn(tx);
  });
}

export async function withServiceRole<T>(
  fn: (tx: PrismaTransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    return fn(tx);
  });
}

export function buildContext(
  userId: string,
  membership?: { id: string; schoolId: string; role: string } | null
): RequestContext {
  if (!membership) {
    return { userId };
  }
  return {
    userId,
    schoolId: membership.schoolId,
    membershipId: membership.id,
    role: membership.role,
  };
}
