import type { AuthContext } from '@/lib/auth/context';
import type { RequestContext } from '@/lib/prisma/rls-middleware';
import type { Prisma } from '@/generated/prisma/client';

// ── Standard response envelope ──
export type CrudResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};

// ── Audit event schema ──
export interface AuditEvent {
  actorId: string;
  schoolId: string;
  entity: string;
  entityId?: string;
  action: 'create' | 'update' | 'archive' | 'delete' | 'restore';
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

// ── Pagination ──
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, string | undefined>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Tenant context passed to every mutation/query ──
export interface TenantContext {
  authCtx: AuthContext;
  requestCtx: RequestContext;
}

// ── Mutation pipeline context ──
export interface MutationContext<TInput> {
  tenant: TenantContext;
  resource: string;
  action: 'create' | 'update' | 'archive' | 'delete' | 'restore';
  input: TInput;
  ipAddress?: string;
  userAgent?: string;
}
