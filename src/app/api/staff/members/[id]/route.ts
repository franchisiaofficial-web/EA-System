import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { requirePermission, AuthorizationError } from '@/lib/permissions/guards';
import { withRls } from '@/lib/prisma/rls-middleware';
import { z } from 'zod';

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

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(STAFF_ROLES).optional(),
  designation: z.string().optional(),
  gender: z.string().optional(),
  department: z.string().optional(),
  employeeId: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REMOVED']).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    await requirePermission(authCtx, 'teachers', 'read');
    const rc = toRequestContext(authCtx);

    const result = await withRls(rc, async (tx) => {
      const m = await tx.membership.findFirst({
        where: { id, schoolId: authCtx.schoolId },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, status: true } },
          staffProfile: { select: { id: true, employeeId: true, designation: true, gender: true, department: true, qualification: true, joiningDate: true, photoUrl: true, address: true, dateOfBirth: true } },
          subjectAssignments: {
            where: { status: 'ACTIVE' },
            include: { subject: { select: { id: true, name: true, code: true } } },
          },
        },
      });
      if (!m) return null;
      return {
        id: m.id,
        userId: m.user.id,
        employeeId: m.staffProfile?.employeeId ?? null,
        fullName: m.user.name,
        email: m.user.email,
        phone: m.user.phone ?? null,
        role: m.role,
        status: m.status,
        profile: m.staffProfile,
        assignments: m.subjectAssignments.map((a) => ({ id: a.id, subjectId: a.subjectId, subjectName: a.subject.name, subjectCode: a.subject.code, academicYearId: a.academicYearId, classId: a.classId, sectionId: a.sectionId })),
      };
    });

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
    const body = await req.json();
    const parsed = updateSchema.parse(body);
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authenticated' } }, { status: 401 });
    await requirePermission(authCtx, 'teachers', 'update');
    const rc = toRequestContext(authCtx);

    const result = await withRls(rc, async (tx) => {
      const m = await tx.membership.findFirst({
        where: { id, schoolId: authCtx.schoolId },
        include: { user: { select: { id: true } } },
      });
      if (!m) return null;

      if (parsed.employeeId) {
        const dup = await tx.staffProfile.findFirst({
          where: { schoolId: authCtx.schoolId, employeeId: parsed.employeeId, membershipId: { not: id } },
          select: { id: true },
        });
        if (dup) return { duplicateEmployeeId: true };
      }

      const [user, membership] = await Promise.all([
        tx.user.update({
          where: { id: m.userId },
          data: {
            ...(parsed.name ? { name: parsed.name } : {}),
            ...(parsed.phone !== undefined ? { phone: parsed.phone || null } : {}),
          },
        }),
        tx.membership.update({
          where: { id },
          data: {
            ...(parsed.role ? { role: parsed.role } : {}),
            ...(parsed.status ? { status: parsed.status } : {}),
          },
        }),
      ]);

      const profileData: any = {
        ...(parsed.designation !== undefined ? { designation: parsed.designation || null } : {}),
        ...(parsed.gender !== undefined ? { gender: parsed.gender || null } : {}),
        ...(parsed.department !== undefined ? { department: parsed.department || null } : {}),
      };
      if (parsed.employeeId) profileData.employeeId = parsed.employeeId;

      let profile = await tx.staffProfile.findFirst({ where: { membershipId: id } });
      if (profile) {
        profile = await tx.staffProfile.update({ where: { id: profile.id }, data: profileData });
      } else if (Object.keys(profileData).length > 0) {
        profile = await tx.staffProfile.create({
          data: {
            schoolId: authCtx.schoolId,
            membershipId: id,
            employeeId: parsed.employeeId ?? `STF-${id.slice(-5).toUpperCase()}`,
            ...profileData,
          },
        });
      }

      return { user, membership, profile };
    });

    if (!result) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } }, { status: 404 });
    if (result.duplicateEmployeeId) return NextResponse.json({ success: false, error: { code: 'CONFLICT', message: 'This employee ID is already in use' } }, { status: 409 });
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: e.message } }, { status: 400 });
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: e.message } }, { status: 403 });
    console.error('PATCH /api/staff/members/[id] error:', e);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } }, { status: 500 });
  }
}
