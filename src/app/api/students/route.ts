import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';
import { runSimpleMutation } from '@/lib/crud/mutation';
import type { Student, Prisma } from '@/generated/prisma/client';
import { Prisma as PrismaClient } from '@/generated/prisma/client';
import { z } from 'zod';

const createSchema = z.object({
  firstName: z.string().min(1), lastName: z.string().min(1),
  admissionNumber: z.string().min(1), dateOfBirth: z.string().optional(),
  gender: z.string().optional(), phone: z.string().optional(), address: z.string().optional(),
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
        ...(classIds ? { enrollments: { some: { classId: { in: classIds }, status: 'ACTIVE' } } } : {}),
        ...(search ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { admissionNumber: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      };
      const [items, total] = await Promise.all([
        tx.student.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
        tx.student.count({ where }),
      ]);
      return { items, total };
    });
    return NextResponse.json({ success: true, data: { items: result.items, total: result.total, page, pageSize, totalPages: Math.ceil(result.total / pageSize) } });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: (e as Error).message } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);
    const result = await runSimpleMutation<typeof parsed, Student>({
      resource: 'students', action: 'create', input: parsed,
      execute: async (data, { authCtx: ac, requestCtx: rc }) => {
        return withRls(rc, async (tx) => tx.student.create({
          data: { schoolId: ac.schoolId, firstName: data.firstName, lastName: data.lastName, admissionNumber: data.admissionNumber, dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null, gender: data.gender, phone: data.phone, address: data.address },
        }));
      },
      getEntityId: (r) => r.id,
      buildAfter: (r) => ({ firstName: r.firstName, lastName: r.lastName, admissionNumber: r.admissionNumber }),
    });
    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    if (e instanceof PrismaClient.PrismaClientKnownRequestError && e.code === 'P2002') {
      console.error('Duplicate admission number:', (e as any).meta);
      return NextResponse.json({ success: false, error: { code: 'DUPLICATE_ADMISSION_NUMBER', message: 'Admission number already exists.' } }, { status: 409 });
    }
    console.error('POST /api/students error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}
