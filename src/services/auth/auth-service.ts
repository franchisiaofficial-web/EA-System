import { prisma } from '@/lib/prisma/client';
import { auditLog } from '@/lib/audit/logger';

export async function getUserMemberships(userId: string) {
  return prisma.membership.findMany({
    where: { userId, status: 'ACTIVE' },
    include: {
      school: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          logoUrl: true,
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });
}

export async function getActiveSchools(userId: string) {
  const memberships = await getUserMemberships(userId);
  return memberships.filter((m) => m.school.status === 'ACTIVE');
}

export async function recordLogin(
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  await auditLog({
    userId,
    action: 'login',
    entity: 'user',
    recordId: userId,
    ipAddress,
    userAgent,
  });
}
