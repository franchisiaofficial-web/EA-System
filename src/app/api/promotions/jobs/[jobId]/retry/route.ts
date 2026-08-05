import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import {
  requirePermission,
  AuthorizationError,
} from '@/lib/permissions/guards';
import { createPromotionJob } from '@/services/promotion/promotion-job-service';
import { withRls } from '@/lib/prisma/rls-middleware';

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<'/api/promotions/jobs/[jobId]/retry'>
) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx)
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN' } },
        { status: 401 }
      );
    await requirePermission(authCtx, 'students', 'update');
    const rc = toRequestContext(authCtx);

    const { jobId } = await ctx.params;

    // Retry ONLY the FAILED batches of the job. Idempotency is guaranteed by
    // the runner: eligibility is re-derived from the DB (source enrollment
    // status = ACTIVE), so already-promoted students are automatically skipped.
    const failed = await withRls(rc, (tx) =>
      tx.promotionJobBatch.findMany({
        where: { promotionJobId: jobId, status: 'FAILED' },
        select: { sourceClassId: true },
        distinct: ['sourceClassId'],
      })
    );
    const retryClassIds = failed
      .map((b) => b.sourceClassId)
      .filter((id): id is string => !!id);
    if (retryClassIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOTHING_TO_RETRY',
            message: 'No failed batches to retry for this job',
          },
        },
        { status: 409 }
      );
    }

    const job = await withRls(rc, (tx) =>
      tx.promotionJob.findUnique({
        where: { id: jobId },
        select: {
          schoolId: true,
          fromAcademicYearId: true,
          toAcademicYearId: true,
        },
      })
    );
    if (!job)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Promotion job not found' },
        },
        { status: 404 }
      );

    const { job: retryJob, duplicate } = await createPromotionJob(
      {
        schoolId: job.schoolId,
        fromAcademicYearId: job.fromAcademicYearId,
        toAcademicYearId: job.toAcademicYearId,
        retryClassIds,
      },
      authCtx,
      rc
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          jobId: retryJob.id,
          status: retryJob.status,
          retryClassIds,
          duplicate,
        },
      },
      { status: 202 }
    );
  } catch (e) {
    if (e instanceof AuthorizationError)
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: e.message } },
        { status: 403 }
      );
    console.error('POST /api/promotions/jobs/[jobId]/retry error:', e);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL', message: 'An unexpected error occurred' },
      },
      { status: 500 }
    );
  }
}
