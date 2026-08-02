import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 401 });
    await requirePermission(authCtx, 'teachers', 'read');
    const sp = req.nextUrl.searchParams;
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '100')));
    const search = sp.get('search') || '';
    const rc = toRequestContext(authCtx);

    const result = await withRls(rc, async (tx) => {
      const where: any = {
        schoolId: authCtx.schoolId,
        status: 'ACTIVE',
        role: { in: ['TEACHER', 'CLASS_TEACHER'] },
        ...(search ? { user: { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } } : {}),
      };
      const items = await tx.membership.findMany({
        where,
        take: pageSize,
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true, email: true } } },
      });
      return items;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('GET /api/teachers error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

