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

    const result = await withRls(rc, async (tx) => {
      const years = await tx.academicYear.findMany({
        where: { schoolId: authCtx.schoolId },
        orderBy: { startDate: 'asc' },
        select: {
          id: true,
          name: true,
          status: true,
          isActive: true,
          isCurrent: true,
        },
      });

      const outcomes = await Promise.all(
        years.map(async (y) => {
          const [total, promoted, passedOut] = await Promise.all([
            tx.enrollment.count({
              where: { schoolId: authCtx.schoolId, academicYearId: y.id },
            }),
            tx.enrollment.count({
              where: {
                schoolId: authCtx.schoolId,
                academicYearId: y.id,
                status: 'PROMOTED',
              },
            }),
            tx.enrollment.count({
              where: {
                schoolId: authCtx.schoolId,
                academicYearId: y.id,
                status: 'PASSED_OUT',
              },
            }),
          ]);
          return {
            id: y.id,
            name: y.name,
            status: y.status,
            isActive: y.isActive,
            students: total,
            promoted,
            passedOut,
          };
        })
      );

      return outcomes;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof AuthorizationError)
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN' } },
        { status: 403 }
      );
    console.error('GET /api/academic-years/outcome error:', e);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL' } },
      { status: 500 }
    );
  }
}
