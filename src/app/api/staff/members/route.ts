import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';

const STAFF_ROLES = [
  'PRINCIPAL',
  'VICE_PRINCIPAL',
  'HR',
  'ACCOUNTANT',
  'TEACHER',
  'CLASS_TEACHER',
  'NON_TEACHING',
  'LIBRARIAN',
  'TRANSPORT_MANAGER',
  'DRIVER',
  'CAFETERIA_STAFF',
] as const;

const STAFF_ROLE_LABELS: Record<string, string> = {
  PRINCIPAL: 'Principal',
  VICE_PRINCIPAL: 'Vice Principal',
  HR: 'HR',
  ACCOUNTANT: 'Accountant',
  TEACHER: 'Teacher',
  CLASS_TEACHER: 'Class Teacher',
  NON_TEACHING: 'Non-Teaching',
  LIBRARIAN: 'Librarian',
  TRANSPORT_MANAGER: 'Transport Manager',
  DRIVER: 'Driver',
  CAFETERIA_STAFF: 'Cafeteria Staff',
};

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(STAFF_ROLES),
  employeeId: z.string().min(1).optional(),
  gender: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
});

function synthesizeEmployeeId(membershipId: string, role: string): string {
  const suffix = membershipId.slice(-5).toUpperCase();
  const prefix = role === 'TEACHER' || role === 'CLASS_TEACHER' ? 'TCH' : 'STF';
  return `${prefix}-${suffix}`;
}

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    await requirePermission(authCtx, 'teachers', 'read');
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '10')));
    const search = sp.get('search') || '';
    const roleParam = sp.get('role') || '';
    const validRole = STAFF_ROLES.includes(roleParam as (typeof STAFF_ROLES)[number]) ? (roleParam as (typeof STAFF_ROLES)[number]) : undefined;
    const statusParam = sp.get('status') || 'ACTIVE';
    const validStatus: 'ACTIVE' | 'SUSPENDED' | 'REMOVED' | undefined =
      statusParam === 'ACTIVE' || statusParam === 'SUSPENDED' || statusParam === 'REMOVED' ? statusParam : undefined;
    const rc = toRequestContext(authCtx);

    const result = await withRls(rc, async (tx) => {
      const where: Prisma.MembershipWhereInput = {
        schoolId: authCtx.schoolId,
        role: { in: [...STAFF_ROLES] },
        ...(validRole ? { role: validRole } : {}),
        ...(validStatus ? { status: validStatus } : {}),
        ...(search
          ? {
              OR: [
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
                { user: { phone: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      };
      const [memberships, total] = await Promise.all([
        tx.membership.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { joinedAt: 'asc' },
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            staffProfile: { select: { id: true, employeeId: true, designation: true, gender: true, department: true } },
          },
        }),
        tx.membership.count({ where }),
      ]);

      const items = memberships.map((m) => ({
        id: m.id,
        userId: m.user.id,
        employeeId: m.staffProfile?.employeeId ?? synthesizeEmployeeId(m.id, m.role),
        fullName: m.user.name,
        email: m.user.email,
        phone: m.user.phone ?? null,
        designation: m.staffProfile?.designation ?? STAFF_ROLE_LABELS[m.role] ?? m.role,
        role: m.role,
        status: m.status,
      }));

      return { items, total };
    });

    return NextResponse.json({ success: true, data: { items: result.items, total: result.total, page, pageSize, totalPages: Math.ceil(result.total / pageSize) } });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('GET /api/staff/members error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createSchema.parse(body);
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    await requirePermission(authCtx, 'teachers', 'create');
    const rc = toRequestContext(authCtx);

    const result = await withRls(rc, async (tx) => {
      const existing = await tx.membership.findFirst({
        where: { schoolId: authCtx.schoolId, user: { email: parsed.email.toLowerCase() } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictError('A member with this email already exists in this school');
      }
      const user = await tx.user.create({
        data: {
          name: parsed.name,
          email: parsed.email.toLowerCase(),
          emailVerified: true,
          status: 'active',
          phone: parsed.phone ?? null,
        },
      });
      const membership = await tx.membership.create({
        data: {
          schoolId: authCtx.schoolId,
          userId: user.id,
          role: parsed.role,
          status: 'ACTIVE',
        },
      });
      const employeeId = parsed.employeeId ?? synthesizeEmployeeId(membership.id, parsed.role);
      const staffProfile = await tx.staffProfile.create({
        data: {
          schoolId: authCtx.schoolId,
          membershipId: membership.id,
          employeeId,
          gender: parsed.gender ?? null,
          department: parsed.department ?? null,
          designation: parsed.designation ?? null,
        },
      });
      return { id: membership.id, userId: user.id, employeeId: staffProfile.employeeId, fullName: user.name, email: user.email, phone: user.phone, designation: staffProfile.designation ?? STAFF_ROLE_LABELS[parsed.role] ?? parsed.role, role: membership.role, status: membership.status };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    if (e instanceof ConflictError) return NextResponse.json({ success: false, error: { code: 'CONFLICT', message: e.message } }, { status: 409 });
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('POST /api/staff/members error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}

class ConflictError extends Error {}
