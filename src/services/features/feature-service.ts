import { withRls, type RequestContext } from '@/lib/prisma/rls-middleware';

export async function getEnabledFeatures(
  schoolId: string,
  ctx: RequestContext
) {
  return withRls(ctx, (tx) =>
    tx.schoolFeature.findMany({
      where: { schoolId, enabled: true },
      include: { feature: true },
    })
  );
}

export async function isFeatureEnabled(
  schoolId: string,
  featureKey: string,
  ctx: RequestContext
): Promise<boolean> {
  const result = await withRls(ctx, (tx) =>
    tx.schoolFeature.findFirst({
      where: {
        schoolId,
        feature: { key: featureKey },
        enabled: true,
      },
    })
  );
  return result !== null;
}

export async function getAllFeatures(ctx: RequestContext) {
  return withRls(ctx, (tx) =>
    tx.feature.findMany({ orderBy: { module: 'asc' } })
  );
}

export async function toggleSchoolFeature(
  schoolId: string,
  featureId: string,
  enabled: boolean,
  ctx: RequestContext
) {
  return withRls(ctx, (tx) =>
    tx.schoolFeature.upsert({
      where: { schoolId_featureId: { schoolId, featureId } },
      update: { enabled },
      create: { schoolId, featureId, enabled },
    })
  );
}
