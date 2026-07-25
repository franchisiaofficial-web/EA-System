import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { SchoolStatus } from '@/generated/prisma/client';
import type { Prisma } from '@/generated/prisma/client';

const superPrisma = globalThis as unknown as {
  _superPrisma: PrismaClient | undefined;
};

if (!superPrisma._superPrisma) {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) throw new Error('DIRECT_URL not set');
  superPrisma._superPrisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export const superAdmin = superPrisma._superPrisma;

export async function superCreateSchool(
  input: {
    name: string;
    slug: string;
    timezone?: string;
    currency?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  },
  actorId: string
) {
  return superAdmin.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: {
        name: input.name,
        slug: input.slug,
        timezone: input.timezone ?? 'Asia/Kolkata',
        currency: input.currency ?? 'INR',
        logoUrl: input.logoUrl,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        address: input.address,
        city: input.city,
        state: input.state,
        country: input.country,
        status: 'ACTIVE',
        settings: { create: { language: 'en' } },
      },
      include: { settings: true },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        schoolId: school.id,
        action: 'create',
        entity: 'school',
        recordId: school.id,
        after: {
          name: school.name,
          slug: school.slug,
        } as Prisma.InputJsonValue,
      },
    });

    return school;
  });
}

export async function superUpdateSchoolStatus(
  schoolId: string,
  status: SchoolStatus,
  actorId: string
) {
  return superAdmin.$transaction(async (tx) => {
    const existing = await tx.school.findUnique({ where: { id: schoolId } });
    if (!existing) throw new Error('School not found');

    const updated = await tx.school.update({
      where: { id: schoolId },
      data: { status },
    });

    const action =
      status === 'SUSPENDED'
        ? 'suspend'
        : status === 'ARCHIVED'
          ? 'archive'
          : 'reactivate';

    await tx.auditLog.create({
      data: {
        userId: actorId,
        schoolId,
        action,
        entity: 'school',
        recordId: schoolId,
        before: { status: existing.status } as Prisma.InputJsonValue,
        after: { status } as Prisma.InputJsonValue,
      },
    });

    return updated;
  });
}

export async function superDeleteSchool(schoolId: string, actorId: string) {
  return superAdmin.$transaction(async (tx) => {
    const school = await tx.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new Error('School not found');

    await tx.auditLog.create({
      data: {
        userId: actorId,
        schoolId,
        action: 'delete',
        entity: 'school',
        recordId: schoolId,
        before: {
          name: school.name,
          slug: school.slug,
        } as Prisma.InputJsonValue,
      },
    });

    await tx.school.delete({ where: { id: schoolId } });
    return { deleted: true };
  });
}

export async function superCreateSubscription(
  input: {
    schoolId: string;
    planId: string;
    studentLimit?: number;
    staffLimit?: number;
  },
  actorId: string
) {
  return superAdmin.$transaction(async (tx) => {
    const plan = await tx.plan.findUnique({ where: { id: input.planId } });
    if (!plan) throw new Error('Plan not found');

    const subscription = await tx.subscription.create({
      data: {
        schoolId: input.schoolId,
        planId: input.planId,
        status: 'TRIALING',
        studentLimit: input.studentLimit ?? plan.studentLimit,
        staffLimit: input.staffLimit ?? plan.staffLimit,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        schoolId: input.schoolId,
        action: 'create',
        entity: 'subscription',
        recordId: subscription.id,
        after: {
          planId: input.planId,
          status: 'TRIALING',
        } as Prisma.InputJsonValue,
      },
    });

    return subscription;
  });
}

export async function superToggleFeature(
  schoolId: string,
  featureId: string,
  enabled: boolean,
  actorId: string
) {
  return superAdmin.$transaction(async (tx) => {
    const sf = await tx.schoolFeature.upsert({
      where: { schoolId_featureId: { schoolId, featureId } },
      update: { enabled },
      create: { schoolId, featureId, enabled },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        schoolId,
        action: enabled ? 'enable' : 'disable',
        entity: 'feature',
        recordId: sf.id,
        after: { featureId, enabled } as Prisma.InputJsonValue,
      },
    });

    return sf;
  });
}

export async function superAssignPlan(
  schoolId: string,
  planId: string,
  actorId: string
) {
  return superAdmin.$transaction(async (tx) => {
    const plan = await tx.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');

    const existing = await tx.subscription.findUnique({ where: { schoolId } });
    if (!existing) throw new Error('No subscription found for school');

    const sub = await tx.subscription.update({
      where: { schoolId },
      data: {
        planId,
        studentLimit: plan.studentLimit,
        staffLimit: plan.staffLimit,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: actorId,
        schoolId,
        action: 'assign_plan',
        entity: 'subscription',
        recordId: sub.id,
        before: { planId: existing.planId } as Prisma.InputJsonValue,
        after: { planId } as Prisma.InputJsonValue,
      },
    });

    return sub;
  });
}
