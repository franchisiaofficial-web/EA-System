import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForRls = globalThis as unknown as {
  rlsPrisma: PrismaClient | undefined;
};

function createRlsPrisma() {
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error('DIRECT_URL required for RLS transaction operations');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: Number(process.env.PRISMA_POOL_MAX) || 6 }) });
}

export const rlsPrisma = globalForRls.rlsPrisma ?? createRlsPrisma();
if (process.env.NODE_ENV !== 'production') globalForRls.rlsPrisma = rlsPrisma;

export type PrismaTransactionClient = Omit<
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
  return rlsPrisma.$transaction(async (tx) => {
    // Set the session context in a SINGLE round trip instead of one SET LOCAL
    // per variable (the DB may be remote — round trips dominate latency).
    const pairs: { key: string; value: string }[] = [];
    if (ctx.userId) pairs.push({ key: 'app.current_user_id', value: ctx.userId });
    if (ctx.schoolId) pairs.push({ key: 'app.current_school_id', value: ctx.schoolId });
    if (ctx.membershipId) pairs.push({ key: 'app.current_membership_id', value: ctx.membershipId });
    if (ctx.role) pairs.push({ key: 'app.current_role', value: ctx.role });
    if (pairs.length > 0) {
      const sql =
        'SELECT ' + pairs.map((_, i) => `set_config('${pairs[i].key}', $${i + 1}, true)`).join(', ');
      await tx.$queryRawUnsafe(sql, ...pairs.map((p) => p.value));
    }
    return fn(tx);
  }, { timeout: 30000, maxWait: 15000 });
}

export async function withServiceRole<T>(
  fn: (tx: PrismaTransactionClient) => Promise<T>
): Promise<T> {
  return rlsPrisma.$transaction(async (tx) => {
    return fn(tx);
  }, { timeout: 30000, maxWait: 15000 });
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
