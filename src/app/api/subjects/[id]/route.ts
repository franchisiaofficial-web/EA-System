import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  description: z.string().optional(),
});

const reassignSchema = z.object({
  academicYearId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().min(1).nullable().optional(),
  teacherMembershipId: z.string().min(1),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    await requirePermission(authCtx, 'subjects', 'read');
    const rc = toRequestContext(authCtx);

    const result = await withRls(rc, async (tx) => {
      const subject = await tx.subject.findFirst({
        where: { id, schoolId: authCtx.schoolId },
        include: {
          assignments: {
            where: { status: 'ACTIVE' },
            orderBy: { assignedAt: 'desc' },
            include: {
              academicYear: { select: { id: true, name: true } },
              class: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
              teacherMembership: { select: { id: true, status: true, user: { select: { name: true, email: true } } } },
            },
          },
        },
      });
      if (!subject) return null;
      return subject;
    });

    if (!result) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Subject not found' } }, { status: 404 });
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('GET /api/subjects/[id] error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    await requirePermission(authCtx, 'subjects', 'update');
    const rc = toRequestContext(authCtx);

    if (body.action === 'assign') {
      const parsed = reassignSchema.parse(body);
      const result = await withRls(rc, async (tx) => {
        const subject = await tx.subject.findFirst({ where: { id, schoolId: authCtx.schoolId }, select: { id: true } });
        if (!subject) return null;

        const year = await tx.academicYear.findFirst({ where: { id: parsed.academicYearId, schoolId: authCtx.schoolId }, select: { id: true } });
        if (!year) return { foreignRef: 'academicYear' };
        const cls = await tx.class.findFirst({ where: { id: parsed.classId, schoolId: authCtx.schoolId }, select: { id: true } });
        if (!cls) return { foreignRef: 'class' };
        if (parsed.sectionId) {
          const sec = await tx.section.findFirst({ where: { id: parsed.sectionId, schoolId: authCtx.schoolId }, select: { id: true } });
          if (!sec) return { foreignRef: 'section' };
        }

        const dup = await tx.subjectAssignment.findFirst({
          where: {
            schoolId: authCtx.schoolId,
            subjectId: id,
            academicYearId: parsed.academicYearId,
            classId: parsed.classId,
            ...(parsed.sectionId ? { sectionId: parsed.sectionId } : { sectionId: null }),
            status: 'ACTIVE',
          },
          select: { id: true },
        });
        if (dup) return { duplicate: true };

        const teacher = await tx.membership.findFirst({
          where: { id: parsed.teacherMembershipId, schoolId: authCtx.schoolId, status: 'ACTIVE' },
          select: { id: true },
        });
        if (!teacher) return { teacherMissing: true };

        const assignment = await tx.subjectAssignment.create({
          data: {
            schoolId: authCtx.schoolId,
            subjectId: id,
            academicYearId: parsed.academicYearId,
            classId: parsed.classId,
            sectionId: parsed.sectionId ?? null,
            teacherMembershipId: parsed.teacherMembershipId,
            status: 'ACTIVE',
          },
        });
        return { assignment };
      });

      if (!result) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Subject not found' } }, { status: 404 });
      if (result.foreignRef) {
        const labels: Record<string, string> = { academicYear: 'Academic year', class: 'Class', section: 'Section' };
        return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: `${labels[result.foreignRef]} not found in this school` } }, { status: 403 });
      }
      if (result.duplicate) return NextResponse.json({ success: false, error: { code: 'CONFLICT', message: 'This subject is already assigned to the same class/section for this academic year' } }, { status: 409 });
      if (result.teacherMissing) return NextResponse.json({ success: false, error: { code: 'CONFLICT', message: 'Selected teacher is not an active member' } }, { status: 409 });
      return NextResponse.json({ success: true, data: result.assignment }, { status: 201 });
    }

    const parsed = updateSchema.parse(body);
    const result = await withRls(rc, async (tx) => {
      const existing = await tx.subject.findFirst({ where: { id, schoolId: authCtx.schoolId }, select: { id: true } });
      if (!existing) return null;
      if (parsed.code) {
        const dup = await tx.subject.findFirst({
          where: { schoolId: authCtx.schoolId, code: parsed.code, id: { not: id } },
          select: { id: true },
        });
        if (dup) return { duplicateCode: true };
      }
      const subject = await tx.subject.update({ where: { id }, data: parsed });
      return { subject };
    });

    if (!result) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Subject not found' } }, { status: 404 });
    if (result.duplicateCode) return NextResponse.json({ success: false, error: { code: 'CONFLICT', message: 'A subject with this code already exists' } }, { status: 409 });
    return NextResponse.json({ success: true, data: result.subject });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('PATCH /api/subjects/[id] error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

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
      const existing = await tx.subject.findFirst({ where: { id, schoolId: authCtx.schoolId }, select: { id: true } });
      if (!existing) return null;
      return tx.subject.update({ where: { id }, data: { isActive: false } });
    });

    if (!result) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Subject not found' } }, { status: 404 });
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('DELETE /api/subjects/[id] error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export type SubjectAssignmentPayload = Prisma.SubjectAssignmentGetPayload<{
  include: {
    academicYear: { select: { id: true; name: true } };
    class: { select: { id: true; name: true } };
    section: { select: { id: true; name: true } };
    teacherMembership: { select: { id: true; status: true; user: { select: { name: true; email: true } } } };
  };
}>;
