import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';
import { runSimpleMutation } from '@/lib/crud/mutation';
import { logError } from '@/services/error-log.service';
import type { Student, Prisma } from '@/generated/prisma/client';
import { Prisma as PrismaClient } from '@/generated/prisma/client';
import { z } from 'zod';

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

const createSchema = z.object({
  firstName: z.string().min(1), lastName: z.string().min(1),
  admissionNumber: z.string().min(1), dateOfBirth: z.string().optional(),
  gender: z.string().optional(), phone: z.string().optional(), address: z.string().optional(),
  academicYearId: z.string().optional(), classId: z.string().optional(), sectionId: z.string().optional(),
  rollNumber: z.string().optional(), bloodGroup: z.string().optional(),
  studentStatus: z.string().optional(), admissionDate: z.string().optional(),
  siblings: z.array(siblingSchema).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    await requirePermission(authCtx, 'students', 'read');
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20')));
    const search = sp.get('search') || '';
    const showArchived = sp.get('archived') === 'true';
    const statusFilter = sp.get('status') || '';
    const academicYearId = sp.get('academicYearId') || undefined;
    const classId = sp.get('classId') || undefined;
    const requestCtx = toRequestContext(authCtx);

    const result = await withRls(requestCtx, async (tx) => {
      // CLASS_TEACHER: auto-scope to assigned classes
      let classIds: string[] | undefined;
      if (authCtx.role === 'CLASS_TEACHER') {
        const assignments = await tx.classAssignment.findMany({
          where: { teacherMembershipId: authCtx.membershipId, status: 'ACTIVE' },
          select: { classId: true },
        });
        classIds = assignments.map((a) => a.classId);
        if (classIds.length === 0) {
          return { items: [], total: 0 };
        }
      }

      const where: Prisma.StudentWhereInput = {
        schoolId: authCtx.schoolId,
        ...(showArchived ? {} : { isDeleted: false }),
        // Passed-out students are hidden from the default (current) list but
        // remain searchable and can be listed via status=PASSED_OUT / status=ALL.
        ...(statusFilter && statusFilter !== 'ALL'
          ? { status: statusFilter as Prisma.StudentWhereInput['status'] }
          : statusFilter === 'ALL'
            ? {}
            : search
              ? {}
              : { status: { not: 'PASSED_OUT' as const } }),
        ...(classIds ? { enrollmentRecords: { some: { classId: { in: classIds }, status: 'ACTIVE' } } } : {}),
        ...(academicYearId ? { enrollmentRecords: { some: { academicYearId, status: 'ACTIVE' } } } : {}),
        ...(classId ? { enrollmentRecords: { some: { classId, status: 'ACTIVE' } } } : {}),
        ...(search ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { admissionNumber: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      };
      const [items, total] = await Promise.all([
        tx.student.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' }, include: { enrollmentRecords: { where: { status: "ACTIVE" }, include: { class: { select: { name: true, displayName: true, gradeLevel: true, assignments: { where: { status: 'ACTIVE' }, select: { role: true, teacherMembership: { select: { user: { select: { name: true } } } } } } } }, section: { select: { name: true } } }, take: 1 } } }),
        tx.student.count({ where }),
      ]);
      return { items, total };
    });
    return NextResponse.json({ success: true, data: { items: result.items, total: result.total, page, pageSize, totalPages: Math.ceil(result.total / pageSize) } });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('GET /api/students error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);
    const result = await runSimpleMutation<typeof parsed, Student>({
      resource: 'students', action: 'create', input: parsed,
      execute: async (data, { authCtx: ac, requestCtx: rc }) => {
        return withRls(rc, async (tx) => {
          const studentData: Record<string, unknown> = { schoolId: ac.schoolId, firstName: data.firstName, lastName: data.lastName, admissionNumber: data.admissionNumber, dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null, gender: data.gender, phone: data.phone, address: data.address, bloodGroup: data.bloodGroup || null, admissionDate: data.admissionDate ? new Date(data.admissionDate) : null, siblings: data.siblings && data.siblings.length > 0 ? data.siblings : [] };
          if (data.studentStatus) studentData.status = data.studentStatus;
          const newStudent = await tx.student.create({ data: studentData as any });
          if (data.academicYearId && data.classId && data.sectionId) {
            const year = await tx.academicYear.findFirst({ where: { id: data.academicYearId, schoolId: ac.schoolId }, select: { id: true } });
            if (!year) throw new AuthorizationError('Academic year not found in this school');
            const cls = await tx.class.findFirst({ where: { id: data.classId, schoolId: ac.schoolId }, select: { id: true } });
            if (!cls) throw new AuthorizationError('Class not found in this school');
            const sec = await tx.section.findFirst({ where: { id: data.sectionId, schoolId: ac.schoolId }, select: { id: true } });
            if (!sec) throw new AuthorizationError('Section not found in this school');
            await tx.enrollment.create({ data: { schoolId: ac.schoolId, studentId: newStudent.id, academicYearId: data.academicYearId, classId: data.classId, sectionId: data.sectionId, rollNumber: data.rollNumber || null, status: "ACTIVE", joinedAt: new Date() } });
          }
          return newStudent;
        });
      },
      getEntityId: (r) => r.id,
      buildAfter: (r) => ({ firstName: r.firstName, lastName: r.lastName, admissionNumber: r.admissionNumber }),
    });
    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : result.error?.code === 'INTERNAL' ? 500 : 400 });
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    if (e instanceof PrismaClient.PrismaClientKnownRequestError && e.code === 'P2002') {
      console.error('Duplicate admission number:', (e as any).meta);
      await logError({ service: "API", module: "Student", severity: "WARNING", category: "VALIDATION", message: "Duplicate admission number", errorCode: "P2002", metadata: (e as any).meta });
      return NextResponse.json({ success: false, error: { code: 'DUPLICATE_ADMISSION_NUMBER', message: 'Admission number already exists.' } }, { status: 409 });
    }
    console.error('POST /api/students error:', e);
    await logError({ service: "API", module: "Student", severity: "ERROR", category: "API", message: (e as Error).message || 'Unknown error', errorCode: "INTERNAL" });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}
