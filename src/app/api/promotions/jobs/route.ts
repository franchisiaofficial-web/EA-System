import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import {
  requirePermission,
  AuthorizationError,
} from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx)
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN' } },
        { status: 401 }
      );
    await requirePermission(authCtx, 'students', 'read');
    const rc = toRequestContext(authCtx);

    const url = new URL(req.url);
    const pageSize = Math.min(
      Number(url.searchParams.get('pageSize')) || 5,
      20
    );

    const jobs = await withRls(rc, (tx) =>
      tx.promotionJob.findMany({
        where: { schoolId: authCtx.schoolId },
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        select: {
          id: true,
          status: true,
          fromAcademicYearId: true,
          toAcademicYearId: true,
          eligibleStudents: true,
          processedStudents: true,
          promotedStudents: true,
          passedOutStudents: true,
          failedStudents: true,
          startedAt: true,
          completedAt: true,
          durationMs: true,
          error: true,
          createdAt: true,
        },
      })
    );

    return NextResponse.json({ success: true, data: { items: jobs } });
  } catch (e) {
    if (e instanceof AuthorizationError)
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: e.message } },
        { status: 403 }
      );
    console.error('GET /api/promotions/jobs error:', e);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL', message: 'An unexpected error occurred' },
      },
      { status: 500 }
    );
  }
}
