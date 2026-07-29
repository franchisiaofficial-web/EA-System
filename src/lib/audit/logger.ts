import { authPrisma } from '@/lib/prisma/auth-client';
import type { Prisma } from '@/generated/prisma/client';

export interface AuditLogInput {
  userId: string;
  schoolId?: string;
  action: string;
  entity: string;
  recordId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

export async function auditLog(input: AuditLogInput) {
  return authPrisma.auditLog.create({
    data: {
      userId: input.userId,
      schoolId: input.schoolId,
      action: input.action,
      entity: input.entity,
      recordId: input.recordId,
      before: input.before,
      after: input.after,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  });
}

export async function auditLogForSchool(
  schoolId: string,
  input: Omit<AuditLogInput, 'schoolId'>
) {
  return auditLog({ ...input, schoolId });
}
