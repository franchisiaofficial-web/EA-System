import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';
import type { Prisma } from '@/generated/prisma/client';

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 401 });
    await requirePermission(authCtx, 'students', 'read');
    const q = req.nextUrl.searchParams.get('q') || '';
    const requestCtx = toRequestContext(authCtx);

    const result = await withRls(requestCtx, async (tx) => {
      const where: Prisma.StudentWhereInput = { schoolId: authCtx.schoolId, isDeleted: false };
      if (q) {
        where.OR = [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { admissionNumber: { contains: q, mode: 'insensitive' } },
        ];
      }
      return tx.student.findMany({ where, take: 20, orderBy: { createdAt: 'desc' }, select: { id: true, firstName: true, lastName: true, admissionNumber: true } });
    });
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: (e as Error).message } }, { status: 500 });
  }
}
