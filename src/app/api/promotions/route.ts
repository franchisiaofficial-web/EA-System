import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { runPromotionBatch, type PromotionItem } from '@/services/promotion/promotion-service';
import { z } from 'zod';

const promotionItemSchema = z.object({
  studentId: z.string().min(1),
  action: z.enum(['PROMOTE', 'SKIP', 'GRADUATE', 'TRANSFER']),
  toClassId: z.string().optional(),
  toSectionId: z.string().optional(),
  rollNumber: z.string().optional(),
});

const bodySchema = z.object({
  fromAcademicYearId: z.string().min(1),
  toAcademicYearId: z.string().min(1),
  classId: z.string().optional(),
  items: z.array(promotionItemSchema).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 401 });
    await requirePermission(authCtx, 'students', 'update');
    const rc = toRequestContext(authCtx);

    const body = await req.json();
    const parsed = bodySchema.parse(body);

    const result = await runPromotionBatch(
      {
        schoolId: authCtx.schoolId,
        fromAcademicYearId: parsed.fromAcademicYearId,
        toAcademicYearId: parsed.toAcademicYearId,
        classId: parsed.classId,
        items: parsed.items as PromotionItem[] | undefined,
      },
      authCtx,
      rc
    );

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('POST /api/promotions error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}
