import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    await requirePermission(authCtx, 'subjects', 'update');
    const rc = toRequestContext(authCtx);

    const result = await withRls(rc, async (tx) => {
      const assignment = await tx.subjectAssignment.findFirst({
        where: { id, schoolId: authCtx.schoolId },
        select: { id: true },
      });
      if (!assignment) return null;
      return tx.subjectAssignment.update({
        where: { id },
        data: { status: 'REMOVED', removedAt: new Date() },
      });
    });

    if (!result) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found' } }, { status: 404 });
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('DELETE /api/subject-assignments/[id] error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}
