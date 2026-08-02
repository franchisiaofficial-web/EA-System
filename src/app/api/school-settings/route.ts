import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';
import { z } from 'zod';
import type { SchoolSettings } from '@/generated/prisma/client';

const patchSchema = z.object({
  attendanceStart: z.string().optional(),
  attendanceEnd: z.string().optional(),
  language: z.string().optional(),
  academicYearStart: z.string().optional(),
  academicYearEnd: z.string().optional(),
  gradingSystem: z.string().optional(),
  schoolType: z.string().optional(),
  grades: z.array(z.string().min(1)).optional(),
});

export async function GET() {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 401 });
    await requirePermission(authCtx, 'settings', 'read');
    const rc = toRequestContext(authCtx);
    const settings = await withRls(rc, async (tx) =>
      tx.schoolSettings.findUnique({ where: { schoolId: authCtx.schoolId } })
    );
    return NextResponse.json({ success: true, data: settings });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('GET /api/school-settings error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 401 });
    await requirePermission(authCtx, 'settings', 'update');
    const rc = toRequestContext(authCtx);
    const body = await req.json();
    const parsed = patchSchema.parse(body);

    const result = await withRls(rc, async (tx) => {
      const existing = await tx.schoolSettings.findUnique({ where: { schoolId: authCtx.schoolId } });
      const data: Record<string, unknown> = {};
      if (parsed.attendanceStart !== undefined) data.attendanceStart = parsed.attendanceStart;
      if (parsed.attendanceEnd !== undefined) data.attendanceEnd = parsed.attendanceEnd;
      if (parsed.language !== undefined) data.language = parsed.language;
      if (parsed.gradingSystem !== undefined) data.gradingSystem = parsed.gradingSystem;
      if (parsed.schoolType !== undefined) data.schoolType = parsed.schoolType;
      if (parsed.grades !== undefined) data.grades = parsed.grades;
      if (parsed.academicYearStart !== undefined) data.academicYearStart = parsed.academicYearStart ? new Date(parsed.academicYearStart) : null;
      if (parsed.academicYearEnd !== undefined) data.academicYearEnd = parsed.academicYearEnd ? new Date(parsed.academicYearEnd) : null;

      if (existing) {
        return tx.schoolSettings.update({ where: { schoolId: authCtx.schoolId }, data: data as any });
      }
      return tx.schoolSettings.create({ data: { schoolId: authCtx.schoolId, ...(data as any) } });
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('PATCH /api/school-settings error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}
