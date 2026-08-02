import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';
import { runSimpleMutation } from '@/lib/crud/mutation';
import type { AcademicYear, Prisma } from '@/generated/prisma/client';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isActive: z.boolean(),
});

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    await requirePermission(authCtx, 'academic_years', 'read');
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '10')));
    const search = sp.get('search') || '';
    const requestCtx = toRequestContext(authCtx);

    const result = await withRls(requestCtx, async (tx) => {
      const where: Prisma.AcademicYearWhereInput = {
        schoolId: authCtx.schoolId,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      };
      const [items, total] = await Promise.all([
        tx.academicYear.findMany({
          where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { startDate: 'desc' },
          include: { _count: { select: { classes: true, enrollments: true } } },
        }),
        tx.academicYear.count({ where }),
      ]);
      return { items, total };
    });

    return NextResponse.json({ success: true, data: { items: result.items, total: result.total, page, pageSize, totalPages: Math.ceil(result.total / pageSize) } });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('GET /api/academic-years error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.parse(body);

    const result = await runSimpleMutation<typeof parsed, AcademicYear>({
      resource: 'academic_years', action: 'create', input: parsed,
      execute: async (data, { authCtx: ac, requestCtx: rc }) => {
        if (data.isActive) {
          await withRls(rc, async (tx) => {
            await tx.academicYear.updateMany({ where: { schoolId: ac.schoolId, isActive: true }, data: { isActive: false } });
          });
        }
        return withRls(rc, async (tx) => tx.academicYear.create({
          data: { schoolId: ac.schoolId, name: data.name, startDate: new Date(data.startDate), endDate: new Date(data.endDate), isActive: data.isActive, createdBy: ac.userId },
        }));
      },
      getEntityId: (r) => r.id,
      buildAfter: (r) => ({ name: r.name, isActive: r.isActive }),
    });

    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    console.error('POST /api/academic-years error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Missing id' } }, { status: 400 });
    const body = await req.json();
    const parsed = z.object({ name: z.string().min(1).optional(), startDate: z.string().optional(), endDate: z.string().optional(), isActive: z.boolean().optional() }).parse(body);

    const result = await runSimpleMutation<typeof parsed, AcademicYear>({
      resource: 'academic_years', action: 'update', input: parsed,
      execute: async (data, { authCtx: ac, requestCtx: rc }) => {
        return withRls(rc, async (tx) => {
          const existing = await tx.academicYear.findFirst({ where: { id, schoolId: ac.schoolId }, select: { id: true } });
          if (!existing) throw new AuthorizationError('Academic year not found in this school');
          return tx.academicYear.update({ where: { id }, data: { ...data, ...(data.startDate ? { startDate: new Date(data.startDate) } : {}), ...(data.endDate ? { endDate: new Date(data.endDate) } : {}) } });
        });
      },
      getEntityId: () => id,
      buildAfter: (r) => ({ name: r.name, isActive: r.isActive }),
    });

    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    console.error('PATCH /api/academic-years error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Missing id' } }, { status: 400 });

    const result = await runSimpleMutation<string, AcademicYear>({
      resource: 'academic_years', action: 'archive', input: id,
      execute: async (entityId, { authCtx: ac, requestCtx: rc }) => {
        return withRls(rc, async (tx) => {
          const existing = await tx.academicYear.findFirst({ where: { id: entityId, schoolId: ac.schoolId }, select: { id: true } });
          if (!existing) throw new AuthorizationError('Academic year not found in this school');
          return tx.academicYear.update({ where: { id: entityId }, data: { status: 'COMPLETED', isActive: false } });
        });
      },
      getEntityId: () => id,
      buildAfter: () => ({ status: 'COMPLETED', isActive: false }),
    });

    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    return NextResponse.json(result);
  } catch (e) {
    console.error('DELETE /api/academic-years error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}
