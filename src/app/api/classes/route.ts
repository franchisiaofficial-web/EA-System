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
  sectionId: z.string().min(1),
  gradeLevel: z.string().optional(),
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
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        ...(academicYearId ? { academicYearId } : {}),
      };
      const [items, total] = await Promise.all([
        tx.class.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
        tx.class.count({ where }),
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

    const result = await runSimpleMutation<typeof parsed, Class>({
      resource: 'classes', action: 'create', input: parsed,
      execute: async (data, { authCtx: ac, requestCtx: rc }) => {
        return withRls(rc, async (tx) => tx.class.create({
          data: { schoolId: ac.schoolId, name: data.name, academicYearId: data.academicYearId, sectionId: data.sectionId, gradeLevel: data.gradeLevel ?? null, createdBy: ac.userId },
        }));
      },
      getEntityId: (r) => r.id,
      buildAfter: (r) => ({ name: r.name, academicYearId: r.academicYearId, sectionId: r.sectionId }),
    });

    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: (e as Error).message } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Missing id' } }, { status: 400 });
    const body = await req.json();
    const parsed = z.object({ name: z.string().min(1).optional(), gradeLevel: z.string().optional(), academicYearId: z.string().optional(), sectionId: z.string().optional() }).parse(body);

    const result = await runSimpleMutation<typeof parsed, Class>({
      resource: 'classes', action: 'update', input: parsed,
      execute: async (data, { requestCtx: rc }) => {
        return withRls(rc, async (tx) => tx.class.update({ where: { id }, data }));
      },
      getEntityId: () => id,
      buildAfter: (r) => ({ name: r.name }),
    });

    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: (e as Error).message } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Missing id' } }, { status: 400 });

    const result = await runSimpleMutation<string, Class>({
      resource: 'classes', action: 'archive', input: id,
      execute: async (entityId, { requestCtx: rc }) => {
        return withRls(rc, async (tx) => tx.class.update({ where: { id: entityId }, data: { status: 'ARCHIVED', isDeleted: true } }));
      },
      getEntityId: () => id,
      buildAfter: () => ({ status: 'ARCHIVED', isDeleted: true }),
    });

    if (!result.success) return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: (e as Error).message } }, { status: 500 });
  }
}
