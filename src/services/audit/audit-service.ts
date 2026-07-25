import { prisma } from '@/lib/prisma/client';
import type { AuditLogInput } from '@/lib/audit/logger';
import { auditLog } from '@/lib/audit/logger';

export async function getAuditLogs(
  schoolId: string,
  options?: { entity?: string; userId?: string; limit?: number }
) {
  return prisma.auditLog.findMany({
    where: {
      schoolId,
      ...(options?.entity ? { entity: options.entity } : {}),
      ...(options?.userId ? { userId: options.userId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function logSchoolEvent(
  schoolId: string,
  input: Omit<AuditLogInput, 'schoolId'>
) {
  return auditLog({ ...input, schoolId });
}
