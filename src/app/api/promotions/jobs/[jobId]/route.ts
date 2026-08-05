import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import {
  requirePermission,
  AuthorizationError,
} from '@/lib/permissions/guards';
import { getPromotionJob } from '@/services/promotion/promotion-job-service';

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<'/api/promotions/jobs/[jobId]'>
) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx)
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN' } },
        { status: 401 }
      );
    await requirePermission(authCtx, 'students', 'read');
    const rc = toRequestContext(authCtx);

    const { jobId } = await ctx.params;
    const job = await getPromotionJob(jobId, rc);
    if (!job)
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Promotion job not found' },
        },
        { status: 404 }
      );

    return NextResponse.json({ success: true, data: job });
  } catch (e) {
    if (e instanceof AuthorizationError)
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: e.message } },
        { status: 403 }
      );
    console.error('GET /api/promotions/jobs/[jobId] error:', e);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL', message: 'An unexpected error occurred' },
      },
      { status: 500 }
    );
  }
}
