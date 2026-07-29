import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import type { Resource, Action } from '@/lib/permissions/permissions';
import { withRls, type PrismaTransactionClient } from '@/lib/prisma/rls-middleware';
import type { AuthContext } from '@/lib/auth/context';
import type { PaginationParams, PaginatedResult, TenantContext } from './types';

export async function paginatedQuery<T>(opts: {
  resource: string;
  pagination: PaginationParams;
  buildWhere: (search: string, filters: Record<string, string | undefined>, authCtx: AuthContext) => Record<string, unknown>;
  execute: (tx: PrismaTransactionClient, where: Record<string, unknown>, skip: number, take: number) => Promise<T[]>;
  count: (tx: PrismaTransactionClient, where: Record<string, unknown>) => Promise<number>;
}): Promise<PaginatedResult<T>> {
  const authCtx = await getAuthContext();
  if (!authCtx) throw new AuthorizationError('Not authenticated');
  await requirePermission(authCtx, opts.resource as Resource, 'read' as Action);
  const requestCtx = toRequestContext(authCtx);
  const page = Math.max(1, opts.pagination.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pagination.pageSize ?? 10));
  const search = opts.pagination.search ?? '';
  const filters = opts.pagination.filters ?? {};

  return withRls(requestCtx, async (tx) => {
    const where = opts.buildWhere(search, filters, authCtx);
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      opts.execute(tx, where, skip, pageSize),
      opts.count(tx, where),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  });
}

export type { PaginationParams, PaginatedResult, TenantContext };
