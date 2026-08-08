import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { z } from 'zod';
import {
  STAFF_ROLES,
  getStaffMember,
  updateStaffMember,
  StaffConflictError,
  StaffNotFoundError,
} from '@/services/staff/staff-service';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(STAFF_ROLES).optional(),
  designation: z.string().optional(),
  gender: z.string().optional(),
  department: z.string().optional(),
  employeeId: z.string().min(1).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    await requirePermission(authCtx, 'staff', 'read');

    const result = await getStaffMember(authCtx, id);
    if (!result) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } }, { status: 404 });
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('GET /api/staff/members/[id] error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    await requirePermission(authCtx, 'staff', 'update');
    const body = await req.json();
    const parsed = updateSchema.parse(body);

    const result = await updateStaffMember(authCtx, id, parsed);

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    if (e instanceof StaffNotFoundError) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: e.message } }, { status: 404 });
    if (e instanceof StaffConflictError) return NextResponse.json({ success: false, error: { code: 'CONFLICT', message: e.message } }, { status: 409 });
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('PATCH /api/staff/members/[id] error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}
