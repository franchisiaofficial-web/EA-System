import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { z } from 'zod';
import {
  archiveStaff,
  StaffConflictError,
  StaffNotFoundError,
} from '@/services/staff/staff-service';

const archiveSchema = z.object({
  reason: z.string().min(10, 'Archive reason is required (min 10 characters)'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    await requirePermission(authCtx, 'staff', 'archive');
    const body = await req.json();
    const parsed = archiveSchema.parse(body);

    const result = await archiveStaff(authCtx, id, parsed);

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    if (e instanceof StaffNotFoundError) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: e.message } }, { status: 404 });
    if (e instanceof StaffConflictError) return NextResponse.json({ success: false, error: { code: 'CONFLICT', message: e.message } }, { status: 409 });
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('POST /api/staff/members/[id]/archive error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}
