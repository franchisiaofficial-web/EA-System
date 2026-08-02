import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';
import { runSimpleMutation } from '@/lib/crud/mutation';
import type { CrudDemo, Prisma } from '@/generated/prisma/client';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  category: z.string().default('general'),
});

// GET — paginated list
export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    await requirePermission(authCtx, 'schools', 'read');
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10')));
    const search = searchParams.get('search') || '';
    const requestCtx = toRequestContext(authCtx);

    const result = await withRls(requestCtx, async (tx) => {
      const where: Prisma.CrudDemoWhereInput = {
        schoolId: authCtx.schoolId, isActive: true,
        ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
      };
      const [items, total] = await Promise.all([
        tx.crudDemo.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
        tx.crudDemo.count({ where }),
      ]);
      return { items, total };
    });

    return NextResponse.json({
      success: true,
      data: {
        items: result.items.map((r) => ({ id: r.id, title: r.title, description: r.description, category: r.category, isActive: r.isActive, createdAt: r.createdAt.toISOString() })),
        total: result.total, page, pageSize, totalPages: Math.ceil(result.total / pageSize),
      },
    });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('GET /api/crud-demo error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

// POST — create using shared mutation wrapper
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);

    const result = await runSimpleMutation<typeof parsed, CrudDemo>({
      resource: 'schools',
      action: 'create',
      input: parsed,
      execute: async (data, { authCtx: ac, requestCtx: rc }) => {
        return withRls(rc, async (tx) => {
          return tx.crudDemo.create({
            data: { schoolId: ac.schoolId, title: data.title, description: data.description ?? null, category: data.category },
          });
        });
      },
      getEntityId: (r) => r.id,
      buildAfter: (r) => ({ title: r.title, category: r.category }),
    });

    if (!result.success) {
      return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    }
    return NextResponse.json({ success: true, data: { id: result.data!.id, title: result.data!.title, category: result.data!.category } }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    console.error('POST /api/crud-demo error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

// DELETE — archive using shared mutation wrapper
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Missing id' } }, { status: 400 });

    const result = await runSimpleMutation<string, CrudDemo>({
      resource: 'schools',
      action: 'archive',
      input: id,
      execute: async (entityId, { authCtx: ac, requestCtx: rc }) => {
        return withRls(rc, async (tx) => {
          const existing = await tx.crudDemo.findFirst({ where: { id: entityId, schoolId: ac.schoolId }, select: { id: true } });
          if (!existing) throw new AuthorizationError('Crud demo not found in this school');
          return tx.crudDemo.update({ where: { id: entityId }, data: { isActive: false } });
        });
      },
      getEntityId: () => id,
      buildAfter: (r) => ({ title: r.title, isActive: false }),
    });

    if (!result.success) {
      return NextResponse.json(result, { status: result.error?.code === 'FORBIDDEN' ? 403 : 400 });
    }
    return NextResponse.json({ success: true, data: { id } });
  } catch (e) {
    console.error('DELETE /api/crud-demo error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}
