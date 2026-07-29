import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import type { Resource, Action } from '@/lib/permissions/permissions';
import { auditLog } from '@/lib/audit/logger';
import type { AuthContext } from '@/lib/auth/context';
import type { RequestContext } from '@/lib/prisma/rls-middleware';
import type { Prisma } from '@/generated/prisma/client';
import { Prisma as PrismaClient } from '@/generated/prisma/client';
import type { CrudResult, AuditEvent, TenantContext, MutationContext } from './types';

export type { CrudResult, AuditEvent, TenantContext, MutationContext };

/**
 * Resolve tenant context from the current request (Server Components / Server Actions).
 * Must be called in a server context where headers() is available.
 */
export async function resolveTenant(): Promise<TenantContext> {
  const authCtx = await getAuthContext();
  if (!authCtx) throw new AuthorizationError('Not authenticated');

  const requestCtx = toRequestContext(authCtx);
  return { authCtx, requestCtx };
}

/**
 * Validate that the current user has permission for the requested operation.
 */
export async function checkCrudPermission(
  authCtx: AuthContext,
  resource: string,
  action: string
): Promise<void> {
  const permAction = action === 'archive' ? 'delete' : action;
  await requirePermission(authCtx, resource as Resource, permAction as Action);
}

/**
 * Write an audit log entry for a CRUD operation.
 */
export async function writeAudit(event: AuditEvent): Promise<void> {
  await auditLog({
    userId: event.actorId,
    schoolId: event.schoolId,
    action: event.action,
    entity: event.entity,
    recordId: event.entityId,
    before: event.before,
    after: event.after,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
  });
}

/**
 * Generic mutation pipeline that enforces:
 *   1. Authentication (caller must pass resolved tenant)
 *   2. Permission check
 *   3. Tenant scoping (caller's fn receives ctx with schoolId)
 *   4. Database mutation (caller provides fn)
 *   5. Audit log (caller provides audit event builder)
 *   6. Return standardized CrudResult
 */
export async function runMutation<TInput, TOutput>(opts: {
  resource: string;
  action: 'create' | 'update' | 'archive' | 'restore';
  input: TInput;
  execute: (ctx: { authCtx: AuthContext; requestCtx: RequestContext; input: TInput }) => Promise<TOutput>;
  buildAudit: (result: TOutput, ctx: { authCtx: AuthContext; schoolId: string }) => AuditEvent;
  ipAddress?: string;
  userAgent?: string;
}): Promise<CrudResult<TOutput>> {
  try {
    const tenant = await resolveTenant();
    await checkCrudPermission(tenant.authCtx, opts.resource, opts.action);

    const result = await opts.execute({
      authCtx: tenant.authCtx,
      requestCtx: tenant.requestCtx,
      input: opts.input,
    });

    const auditEvent = opts.buildAudit(result, {
      authCtx: tenant.authCtx,
      schoolId: tenant.authCtx.schoolId,
    });
    await writeAudit(auditEvent);

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        success: false,
        error: { code: 'FORBIDDEN', message: error.message },
      };
    }
    if (error instanceof PrismaClient.PrismaClientKnownRequestError && error.code === 'P2002') {
      console.error('Prisma unique constraint:', (error as any).meta);
      return {
        success: false,
        error: { code: 'DUPLICATE', message: 'A record with this value already exists.' },
      };
    }
    console.error('runMutation error:', error);
    return {
      success: false,
      error: { code: 'INTERNAL', message: 'An unexpected error occurred' },
    };
  }
}

/**
 * Simple mutation that does one Prisma operation + audit.
 * For CRUD patterns where the mutation is a single Prisma call.
 */
export async function runSimpleMutation<TInput, TOutput>(opts: {
  resource: string;
  action: 'create' | 'update' | 'archive';
  input: TInput;
  execute: (input: TInput, ctx: { authCtx: AuthContext; requestCtx: RequestContext }) => Promise<TOutput>;
  getEntityId: (result: TOutput) => string;
  buildBefore?: (input: TInput) => Prisma.InputJsonValue;
  buildAfter: (result: TOutput) => Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}): Promise<CrudResult<TOutput>> {
  return runMutation({
    resource: opts.resource,
    action: opts.action,
    input: opts.input,
    execute: ({ input, authCtx, requestCtx }) => opts.execute(input, { authCtx, requestCtx }),
    buildAudit: (result, { authCtx, schoolId }) => ({
      actorId: authCtx.userId,
      schoolId,
      entity: opts.resource,
      entityId: opts.getEntityId(result),
      action: opts.action,
      before: opts.buildBefore?.(opts.input),
      after: opts.buildAfter(result),
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    }),
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
  });
}
