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
    const student = await withRls(rc, async (tx) => tx.student.findUnique({
      where: { id, schoolId: authCtx.schoolId },
      include: {
        enrollmentRecords: {
          include: {
            academicYear: true,
            class: { include: { assignments: { where: { status: 'ACTIVE', role: 'PRIMARY' }, include: { teacherMembership: { include: { user: { select: { name: true } } } } }, take: 1 } } },
            section: true,
          },
          orderBy: { joinedAt: 'desc' },
        },
        passedOutRecords: {
          include: { finalAcademicYear: true, finalClass: true, finalSection: true },
          orderBy: { passedOutDate: 'desc' },
        },
        guardians: { include: { guardian: true } },
        user: {
          select: {
            name: true,
            email: true,
            memberships: { where: { schoolId: authCtx.schoolId, role: 'STUDENT' }, select: { id: true } },
          },
        },
      },
    }));
    if (!student) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Student not found' } }, { status: 404 });
    return NextResponse.json({ success: true, data: student });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: (e as Error).message } }, { status: 500 });
  }
}

const siblingSchema = z.object({
  name: z.string().min(1),
  admissionNo: z.string().optional(),
  age: z.number().int().positive().optional(),
  gender: z.string().optional(),
  className: z.string().optional(),
  relationship: z.string().optional(),
  schoolName: z.string().optional(),
  notes: z.string().optional(),
  reason: z.string().optional(),
});

const updateSchema = z.object({ firstName: z.string().optional(), lastName: z.string().optional(), dateOfBirth: z.string().optional(), gender: z.string().optional(), phone: z.string().optional(), address: z.string().optional(), admissionNumber: z.string().optional(), photoUrl: z.string().optional(), studentStatus: z.string().optional(), academicYearId: z.string().optional(), classId: z.string().optional(), sectionId: z.string().optional(), rollNumber: z.string().optional(), bloodGroup: z.string().optional(), admissionDate: z.string().optional(), siblings: z.array(siblingSchema).optional() });

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
      execute: async (data, { authCtx: ac, requestCtx: rc2 }) => withRls(rc2, async (tx) => {
        const { studentStatus, academicYearId, classId, sectionId, rollNumber, bloodGroup, admissionDate, siblings, ...rest } = data;
        const updateData: Record<string, unknown> = { ...rest };
        updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
        updateData.bloodGroup = bloodGroup || null;
        updateData.admissionDate = admissionDate ? new Date(admissionDate) : null;
        updateData.siblings = siblings && siblings.length > 0 ? siblings : [];
        if (studentStatus) updateData.status = studentStatus;
        const updated = await tx.student.update({ where: { id }, data: updateData as any });
        if (academicYearId && classId && sectionId) {
          const year = await tx.academicYear.findFirst({ where: { id: academicYearId, schoolId: ac.schoolId }, select: { id: true } });
          if (!year) throw new AuthorizationError('Academic year not found in this school');
          const cls = await tx.class.findFirst({ where: { id: classId, schoolId: ac.schoolId }, select: { id: true } });
          if (!cls) throw new AuthorizationError('Class not found in this school');
          const sec = await tx.section.findFirst({ where: { id: sectionId, schoolId: ac.schoolId }, select: { id: true } });
          if (!sec) throw new AuthorizationError('Section not found in this school');
          const existing = await tx.enrollment.findFirst({ where: { studentId: id, academicYearId, status: 'ACTIVE' } });
          if (existing) {
            await tx.enrollment.update({ where: { id: existing.id }, data: { classId, sectionId, rollNumber: rollNumber || null } });
          } else {
            // Close any other ACTIVE enrollment so the one-ACTIVE-per-student invariant holds.
            await tx.enrollment.updateMany({
              where: { studentId: id, status: 'ACTIVE', academicYearId: { not: academicYearId } },
              data: { status: 'PROMOTED', leftAt: new Date() },
            });
            await tx.enrollment.create({ data: { schoolId: ac.schoolId, studentId: id, academicYearId, classId, sectionId, rollNumber: rollNumber || null, status: "ACTIVE", joinedAt: new Date() } });
          }
        }
        return updated;
      }),
      getEntityId: () => id,
      buildAfter: (r) => ({ firstName: r.firstName, lastName: r.lastName }),
    });
    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : result.error?.code === 'INTERNAL' ? 500 : 400 });
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
      const student = await tx.student.findFirst({
        where: { id, schoolId: authCtx.schoolId },
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
        { success: true, alreadyArchived: true },
        { status: 200 }
      );
    }

    const mutationResult = await runSimpleMutation<string, Student>({
      resource: 'students', action: 'archive', input: id,
      execute: async (_eid, { requestCtx: rc2 }) => withRls(rc2, async (tx) =>
        tx.student.update({ where: { id }, data: { status: 'ARCHIVED', isDeleted: true } })),
      getEntityId: () => id,
      buildAfter: () => ({ status: 'ARCHIVED', isDeleted: true }),
    });
    if (!mutationResult.success) return NextResponse.json(mutationResult, { status: mutationResult.error?.code === 'FORBIDDEN' ? 403 : mutationResult.error?.code === 'INTERNAL' ? 500 : 400 });
    return NextResponse.json(mutationResult);
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: (e as Error).message } }, { status: 500 });
  }
}
