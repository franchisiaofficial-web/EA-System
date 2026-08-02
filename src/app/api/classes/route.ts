import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';
import { runSimpleMutation } from '@/lib/crud/mutation';
import type { Class, Prisma } from '@/generated/prisma/client';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1),
  academicYearId: z.string().min(1),
  displayName: z.string().optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    await requirePermission(authCtx, 'classes', 'read');
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '10')));
    const search = sp.get('search') || '';
    const academicYearId = sp.get('academicYearId') || undefined;
    const requestCtx = toRequestContext(authCtx);

    const result = await withRls(requestCtx, async (tx) => {
      const where: Prisma.ClassWhereInput = {
        schoolId: authCtx.schoolId, isDeleted: false,
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sections: { some: { name: { contains: search, mode: 'insensitive' } } } },
            { academicYear: { name: { contains: search, mode: 'insensitive' } } },
            { assignments: { some: { status: 'ACTIVE', teacherMembership: { user: { name: { contains: search, mode: 'insensitive' } } } } } },
          ],
        } : {}),
        ...(academicYearId ? { academicYearId } : {}),
      };
      const [items, total] = await Promise.all([
        tx.class.findMany({
          where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' },
          include: {
            academicYear: { select: { name: true } },
            sections: {
              where: { status: 'ACTIVE' },
              orderBy: { name: 'asc' },
              include: {
                enrollmentRecords: { where: { status: 'ACTIVE' }, select: { id: true } },
                studentEnrollments: { where: { status: 'ACTIVE', isDeleted: false }, select: { id: true } },
              },
            },
            assignments: {
              where: { status: 'ACTIVE', role: 'PRIMARY' },
              include: { teacherMembership: { include: { user: { select: { name: true } } } } },
            },
          },
        }),
        tx.class.count({ where }),
      ]);

      let sectionAttendance: Record<string, { present: number; late: number; absent: number; excused: number; total: number }> = {};
      if (items.length > 0) {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const classIds = items.map(c => c.id);
        const [enrollments, records] = await Promise.all([
          tx.studentEnrollment.findMany({
            where: { classId: { in: classIds }, status: 'ACTIVE', isDeleted: false, section: { status: 'ACTIVE' } },
            select: {
              sectionId: true,
              student: { select: { user: { select: { memberships: { where: { schoolId: authCtx.schoolId, role: 'STUDENT', status: 'ACTIVE' }, select: { id: true } } } } } },
            },
          }),
          tx.attendanceRecord.findMany({
            where: { classId: { in: classIds }, date: { gte: from, lte: to }, isDeleted: false },
            select: { studentMembershipId: true, status: true },
          }),
        ]);
        const membershipToSection: Record<string, string> = {};
        for (const se of enrollments) {
          const mid = se.student.user?.memberships?.[0]?.id;
          if (mid) membershipToSection[mid] = se.sectionId;
        }
        for (const r of records) {
          const sectionId = membershipToSection[r.studentMembershipId];
          if (!sectionId) continue;
          const b = (sectionAttendance[sectionId] ??= { present: 0, late: 0, absent: 0, excused: 0, total: 0 });
          b.total++;
          if (r.status === 'PRESENT') b.present++;
          else if (r.status === 'LATE') b.late++;
          else if (r.status === 'ABSENT') b.absent++;
          else if (r.status === 'EXCUSED') b.excused++;
        }
      }

      return { items, total, sectionAttendance };
    });

    return NextResponse.json({ success: true, data: { items: result.items, total: result.total, page, pageSize, totalPages: Math.ceil(result.total / pageSize), sectionAttendance: result.sectionAttendance } });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('GET /api/classes error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);

    const result = await runSimpleMutation<typeof parsed, Class>({
      resource: 'classes', action: 'create', input: parsed,
      execute: async (data, { authCtx: ac, requestCtx: rc }) => {
        return withRls(rc, async (tx) => {
          const year = await tx.academicYear.findFirst({ where: { id: data.academicYearId, schoolId: ac.schoolId }, select: { id: true } });
          if (!year) throw new AuthorizationError('Academic year not found in this school');
          return tx.class.create({
            data: { schoolId: ac.schoolId, name: data.name, academicYearId: data.academicYearId, displayName: data.displayName ?? null, description: data.description ?? null, sortOrder: data.sortOrder ?? 0, createdBy: ac.userId },
          });
        });
      },
      getEntityId: (r) => r.id,
      buildAfter: (r) => ({ name: r.name, academicYearId: r.academicYearId }),
    });

    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    console.error('POST /api/classes error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Missing id' } }, { status: 400 });
    const body = await req.json();
    const parsed = z.object({ name: z.string().min(1).optional(), displayName: z.string().optional(), description: z.string().optional(), gradeLevel: z.string().optional(), sortOrder: z.number().int().optional(), academicYearId: z.string().optional(), status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional() }).parse(body);

    const result = await runSimpleMutation<typeof parsed, Class>({
      resource: 'classes', action: 'update', input: parsed,
      execute: async (data, { authCtx: ac, requestCtx: rc }) => {
        return withRls(rc, async (tx) => {
          const existing = await tx.class.findFirst({ where: { id, schoolId: ac.schoolId }, select: { id: true } });
          if (!existing) throw new AuthorizationError('Class not found in this school');
          return tx.class.update({ where: { id }, data });
        });
      },
      getEntityId: () => id,
      buildAfter: (r) => ({ name: r.name }),
    });

    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    console.error('PATCH /api/classes error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Missing id' } }, { status: 400 });

    const result = await runSimpleMutation<string, Class>({
      resource: 'classes', action: 'archive', input: id,
      execute: async (entityId, { authCtx: ac, requestCtx: rc }) => {
        return withRls(rc, async (tx) => {
          const existing = await tx.class.findFirst({ where: { id: entityId, schoolId: ac.schoolId }, select: { id: true } });
          if (!existing) throw new AuthorizationError('Class not found in this school');
          return tx.class.update({ where: { id: entityId }, data: { status: 'ARCHIVED', isDeleted: true } });
        });
      },
      getEntityId: () => id,
      buildAfter: () => ({ status: 'ARCHIVED', isDeleted: true }),
    });

    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    return NextResponse.json(result);
  } catch (e) {
    console.error('DELETE /api/classes error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

