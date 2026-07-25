import { prisma } from '@/lib/prisma/client';

export async function getUsersForSchool(schoolId: string) {
  const memberships = await prisma.membership.findMany({
    where: { schoolId, status: 'ACTIVE' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          status: true,
        },
      },
    },
  });

  return memberships.map((m) => ({
    ...m.user,
    role: m.role,
    membershipId: m.id,
    membershipStatus: m.status,
  }));
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      phone: true,
      avatarUrl: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
}
