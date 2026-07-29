import { NextRequest, NextResponse } from 'next/server';
import { withRls } from '@/lib/prisma/rls-middleware';
import { runSimpleMutation } from '@/lib/crud/mutation';
import type { Student } from '@/generated/prisma/client';
import { z } from 'zod';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 401 });
    await requirePermission(authCtx, 'students', 'read');
    const rc = toRequestContext(authCtx);
    const student = await withRls(rc, async (tx) => tx.student.findUnique({ where: { id, schoolId: authCtx.schoolId }, include: { enrollments: { include: { academicYear: true, class: true, section: true } }, guardians: { include: { guardian: true } } } }));
    if (!student) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Student not found' } }, { status: 404 });
    return NextResponse.json({ success: true, data: student });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: (e as Error).message } }, { status: 500 });
  }
}

const updateSchema = z.object({ firstName: z.string().optional(), lastName: z.string().optional(), dateOfBirth: z.string().optional(), gender: z.string().optional(), phone: z.string().optional(), address: z.string().optional(), admissionNumber: z.string().optional(), photoUrl: z.string().optional() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 401 });
    const rc = toRequestContext(authCtx);

    // Pre-check: verify student exists in this school
    const preCheck = await withRls(rc, async (tx) => tx.student.findUnique({
      where: { id, schoolId: authCtx.schoolId },
      select: { id: true, isDeleted: true, status: true },
    }));
    if (!preCheck) {
      return NextResponse.json({ success: false, error: { code: 'STUDENT_NOT_FOUND', message: 'Student not found.' } }, { status: 404 });
    }
    if (preCheck.isDeleted || preCheck.status === "ARCHIVED") {
      return NextResponse.json({ success: false, error: { code: 'STUDENT_ARCHIVED', message: 'Cannot edit an archived student.' } }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateSchema.parse(body);
    const result = await runSimpleMutation<typeof parsed, Student>({
      resource: 'students', action: 'update', input: parsed,
      execute: async (data, { requestCtx: rc2 }) => withRls(rc2, async (tx) =>
        tx.student.update({ where: { id }, data: { ...data, ...(data.dateOfBirth ? { dateOfBirth: new Date(data.dateOfBirth) } : {}) } })),
      getEntityId: () => id,
      buildAfter: (r) => ({ firstName: r.firstName, lastName: r.lastName }),
    });
    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    console.error('PATCH /api/students error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 401 });
    const rc = toRequestContext(authCtx);

    const result = await withRls(rc, async (tx) => {
      const student = await tx.student.findUnique({
        where: { id },
        select: { isDeleted: true, status: true },
      });
      if (!student) {
        return { notFound: true };
      }
      if (student.isDeleted || student.status === "ARCHIVED") {
        return { alreadyArchived: true };
      }
      return tx.student.update({ where: { id }, data: { status: 'ARCHIVED', isDeleted: true } });
    });

    if ((result as any).notFound) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Student not found" } },
        { status: 404 }
      );
    }

    if ((result as any).alreadyArchived) {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "Student is already archived" } },
        { status: 409 }
      );
    }

    const mutationResult = await runSimpleMutation<string, Student>({
      resource: 'students', action: 'archive', input: id,
      execute: async (_eid, { requestCtx: rc2 }) => withRls(rc2, async (tx) =>
        tx.student.update({ where: { id }, data: { status: 'ARCHIVED', isDeleted: true } })),
      getEntityId: () => id,
      buildAfter: () => ({ status: 'ARCHIVED', isDeleted: true }),
    });
    if (!mutationResult.success) return NextResponse.json(mutationResult, { status: mutationResult.error?.code === 'FORBIDDEN' ? 403 : 400 });
    return NextResponse.json(mutationResult);
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: (e as Error).message } }, { status: 500 });
  }
}
