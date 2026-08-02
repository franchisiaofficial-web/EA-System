import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { completeAcademicYearFlow } from '@/services/promotion/promotion-service';
import { z } from 'zod';

const bodySchema = z.object({
  fromAcademicYearId: z.string().min(1),
  toAcademicYearId: z.string().min(1),
  classId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 401 });
    await requirePermission(authCtx, 'students', 'update');
    const rc = toRequestContext(authCtx);

    const body = await req.json();
    const parsed = bodySchema.parse(body);

    const result = await completeAcademicYearFlow(
      {
        schoolId: authCtx.schoolId,
        fromAcademicYearId: parsed.fromAcademicYearId,
        toAcademicYearId: parsed.toAcademicYearId,
        classId: parsed.classId,
      },
      authCtx,
      rc
    );

    if (!result.success) {
      if (result.code === 'TRANSITION_BLOCKED') {
        return NextResponse.json({ success: false, error: { code: 'TRANSITION_BLOCKED', message: result.message, summary: result.summary } }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: result.message } }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('POST /api/promotions/close-year error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}
