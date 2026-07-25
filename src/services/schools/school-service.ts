import { withRls, type RequestContext } from '@/lib/prisma/rls-middleware';
import type { Prisma } from '@/generated/prisma/client';

export async function getSchoolById(schoolId: string, ctx: RequestContext) {
  return withRls(ctx, (tx) =>
    tx.school.findUnique({
      where: { id: schoolId },
      include: { settings: true, subscription: { include: { plan: true } } },
    })
  );
}

export async function getSchoolBySlug(slug: string, ctx: RequestContext) {
  return withRls(ctx, (tx) =>
    tx.school.findUnique({
      where: { slug },
      include: { settings: true },
    })
  );
}

export async function updateSchoolSettings(
  schoolId: string,
  data: {
    attendanceStart?: string;
    attendanceEnd?: string;
    language?: string;
    academicYearStart?: Date;
    academicYearEnd?: Date;
    gradingSystem?: string;
  },
  userId: string,
  ctx: RequestContext
) {
  return withRls(ctx, async (tx) => {
    const existing = await tx.schoolSettings.findUnique({
      where: { schoolId },
    });

    const updated = await tx.schoolSettings.upsert({
      where: { schoolId },
      update: data,
      create: { schoolId, ...data },
    });

    await tx.auditLog.create({
      data: {
        userId,
        schoolId,
        action: existing ? 'update' : 'create',
        entity: 'school_settings',
        recordId: updated.id,
        before: (existing ?? undefined) as Prisma.InputJsonValue | undefined,
        after: updated as unknown as Prisma.InputJsonValue,
      },
    });

    return updated;
  });
}
