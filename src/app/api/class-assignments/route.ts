import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';
import { runSimpleMutation } from '@/lib/crud/mutation';
import type { ClassAssignment } from '@/generated/prisma/client';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 401 });
    await requirePermission(authCtx, 'class_assignments', 'read');
    const classId = req.nextUrl.searchParams.get('classId');
    if (!classId) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'classId is required' } }, { status: 400 });
    const rc = toRequestContext(authCtx);
    const assignments = await withRls(rc, async (tx) =>
      tx.classAssignment.findMany({
        where: { classId, schoolId: authCtx.schoolId, status: 'ACTIVE' },
        include: { teacherMembership: { include: { user: { select: { name: true, email: true } } } } },
        orderBy: { createdAt: 'asc' },
      })
    );
    return NextResponse.json({ success: true, data: assignments });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('GET /api/class-assignments error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

const postSchema = z.object({
  classId: z.string().min(1),
  teacherMembershipId: z.string().min(1),
  role: z.enum(['PRIMARY', 'ASSISTANT', 'SUBSTITUTE']).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = postSchema.parse(body);
    const result = await runSimpleMutation<typeof parsed, ClassAssignment>({
      resource: 'class_assignments', action: 'create', input: parsed,
      execute: async (data, { authCtx: ac, requestCtx: rc }) => withRls(rc, async (tx) => {
        const cls = await tx.class.findFirst({ where: { id: data.classId, schoolId: ac.schoolId }, select: { id: true } });
        if (!cls) throw new AuthorizationError('Class not found in this school');
        const mem = await tx.membership.findFirst({ where: { id: data.teacherMembershipId, schoolId: ac.schoolId }, select: { id: true } });
        if (!mem) throw new AuthorizationError('Teacher not found in this school');
        const role = data.role ?? 'PRIMARY';
        const existing = await tx.classAssignment.findFirst({
          where: { classId: data.classId, role, status: 'ACTIVE', schoolId: ac.schoolId },
        });
        if (existing) {
          return tx.classAssignment.update({
            where: { id: existing.id },
            data: { teacherMembershipId: data.teacherMembershipId, status: 'ACTIVE' },
          });
        }
        return tx.classAssignment.create({
          data: { schoolId: ac.schoolId, classId: data.classId, teacherMembershipId: data.teacherMembershipId, role },
        });
      }),
      getEntityId: (r) => r.id,
      buildAfter: (r) => ({ classId: r.classId, role: r.role, status: r.status }),
    });
    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : result.error?.code === 'INTERNAL' ? 500 : 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    console.error('POST /api/class-assignments error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Missing id' } }, { status: 400 });
    const result = await runSimpleMutation<string, ClassAssignment>({
      resource: 'class_assignments', action: 'archive', input: id,
      execute: async (entityId, { requestCtx: rc }) => withRls(rc, async (tx) => {
        const existing = await tx.classAssignment.findFirst({ where: { id: entityId, schoolId: rc.schoolId }, select: { id: true } });
        if (!existing) throw new AuthorizationError('Assignment not found in this school');
        return tx.classAssignment.update({ where: { id: entityId }, data: { status: 'REMOVED' } });
      }),
      getEntityId: () => id,
      buildAfter: () => ({ status: 'REMOVED' }),
    });
    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : result.error?.code === 'INTERNAL' ? 500 : 400 });
    return NextResponse.json(result);
  } catch (e) {
    console.error('DELETE /api/class-assignments error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

