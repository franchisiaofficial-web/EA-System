import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { withRls } from '@/lib/prisma/rls-middleware';
import { z } from 'zod';

const createSchema = z.object({
  id: z.string().optional(),
  data: z.record(z.string(), z.any()),
  progress: z.number().int().min(0).max(100).default(0),
  lastStep: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    const rc = toRequestContext(authCtx);
    const sp = req.nextUrl.searchParams;
    const draftId = sp.get('id');

    const result = await withRls(rc, async (tx) => {
      if (draftId) {
        return tx.studentDraft.findFirst({
          where: { id: draftId, schoolId: authCtx.schoolId, createdBy: authCtx.userId },
        });
      }
      return tx.studentDraft.findMany({
        where: { schoolId: authCtx.schoolId, createdBy: authCtx.userId },
        orderBy: { updatedAt: 'desc' },
      });
    });

    if (draftId && !result) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Draft not found' } }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error('GET /api/students/drafts error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    const rc = toRequestContext(authCtx);
    const body = await req.json();
    const parsed = createSchema.parse(body);

    const result = await withRls(rc, async (tx) => {
      if (parsed.id) {
        return tx.studentDraft.update({
          where: { id: parsed.id, schoolId: authCtx.schoolId, createdBy: authCtx.userId },
          data: { data: parsed.data as any, progress: parsed.progress, lastStep: parsed.lastStep ?? null },
        });
      }
      return tx.studentDraft.create({
        data: {
          schoolId: authCtx.schoolId,
          createdBy: authCtx.userId,
          data: parsed.data as any,
          progress: parsed.progress,
          lastStep: parsed.lastStep ?? null,
        },
      });
    });

    return NextResponse.json({ success: true, data: result }, { status: parsed.id ? 200 : 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    console.error('POST /api/students/drafts error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    const rc = toRequestContext(authCtx);
    const draftId = req.nextUrl.searchParams.get('id');
    if (!draftId) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: 'Missing draft id' } }, { status: 400 });

    await withRls(rc, async (tx) => {
      await tx.studentDraft.deleteMany({
        where: { id: draftId, schoolId: authCtx.schoolId, createdBy: authCtx.userId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/students/drafts error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}
