import { withRls, type PrismaTransactionClient } from '@/lib/prisma/rls-middleware';
import { toRequestContext, type AuthContext } from '@/lib/auth/context';
import { AuthorizationError } from '@/lib/permissions/guards';
import { Prisma } from '@/generated/prisma/client';
import type { Membership, User } from '@/generated/prisma/client';

// ============================================
// StaffService — the single, shared server-side data source for all Staff
// Domain reads/writes (Staff Domain Phase 1.3 — service layer).
//
// Canonical contract:
//   - StaffDomain Architecture v1 (§7) — staff routes must consume this
//     service; no route may implement Staff Prisma queries directly.
//   - Permission (RBAC) checks remain the caller's responsibility
//     (routes call requirePermission before invoking the service).
//
// Tenant security (Rule 3 / Addendum-2 pattern):
//   - Every query executes inside withRls(ctx) with a context derived from
//     the authenticated membership.
//   - Every query ALSO filters/binds by schoolId from authCtx.schoolId
//     (defense-in-depth; RLS is not an active control — 5B.1).
//   - Record ownership is verified BEFORE any mutation
//     (findFirst({ id, schoolId }) — never findUnique({ id })).
//
// Audit (Architecture Rule 7): every write emits a staff audit record in
// the same transaction (rollback-safe).
// ============================================

export const STAFF_ROLES = [
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

export type StaffRole = (typeof STAFF_ROLES)[number];
export type StaffStatus = 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

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

function synthesizeEmployeeId(membershipId: string, role: string): string {
  const suffix = membershipId.slice(-5).toUpperCase();
  const prefix = role === 'TEACHER' || role === 'CLASS_TEACHER' ? 'TCH' : 'STF';
  return `${prefix}-${suffix}`;
}

export class StaffServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffServiceError';
  }
}

export class StaffNotFoundError extends StaffServiceError {
  constructor(message = 'Member not found') {
    super(message);
    this.name = 'StaffNotFoundError';
  }
}

export class StaffConflictError extends StaffServiceError {
  constructor(message: string) {
    super(message);
    this.name = 'StaffConflictError';
  }
}

// --------------------------------------------
// Inputs
// --------------------------------------------

export interface ListStaffParams {
  page: number;
  pageSize: number;
  search?: string;
  role?: string;
  status?: string;
}

export interface CreateStaffInput {
  name: string;
  email: string;
  phone?: string;
  role: StaffRole;
  employeeId?: string;
  gender?: string;
  department?: string;
  designation?: string;
}

export interface UpdateStaffInput {
  name?: string;
  phone?: string;
  role?: StaffRole;
  designation?: string;
  gender?: string;
  department?: string;
  employeeId?: string;
}

// --------------------------------------------
// Result shapes (identical to the pre-refactor API contracts)
// --------------------------------------------

export interface StaffMemberListItem {
  id: string;
  userId: string;
  employeeId: string;
  fullName: string;
  email: string;
  phone: string | null;
  designation: string;
  role: string;
  status: string;
}

const profileSelect = {
  id: true,
  employeeId: true,
  designation: true,
  gender: true,
  department: true,
  qualification: true,
  joiningDate: true,
  photoUrl: true,
  address: true,
  dateOfBirth: true,
} as const;

type StaffProfilePayload = Prisma.StaffProfileGetPayload<{
  select: typeof profileSelect;
}>;

export interface StaffAssignmentItem {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
}

export interface StaffMemberDetail {
  id: string;
  userId: string;
  employeeId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  profile: StaffProfilePayload | null;
  assignments: StaffAssignmentItem[];
}

export interface CreatedStaffMember {
  id: string;
  userId: string;
  employeeId: string;
  fullName: string;
  email: string;
  phone: string | null;
  designation: string;
  role: string;
  status: string;
}

// --------------------------------------------
// Reads
// --------------------------------------------

export async function listStaffMembers(
  authCtx: AuthContext,
  params: ListStaffParams
): Promise<{ items: StaffMemberListItem[]; total: number }> {
  const ctx = toRequestContext(authCtx);
  const { page, pageSize, search, role, status } = params;
  const validRole = STAFF_ROLES.includes(role as StaffRole)
    ? (role as StaffRole)
    : undefined;
  const validStatus: StaffStatus | undefined =
    status === 'ACTIVE' || status === 'SUSPENDED' || status === 'REMOVED'
      ? (status as StaffStatus)
      : undefined;
  return withRls(ctx, async (tx) => {
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
          staffProfile: {
            select: {
              id: true,
              employeeId: true,
              designation: true,
              gender: true,
              department: true,
            },
          },
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
}

export async function getStaffMember(
  authCtx: AuthContext,
  id: string
): Promise<StaffMemberDetail | null> {
  const ctx = toRequestContext(authCtx);

  return withRls(ctx, async (tx) => {
    const m = await tx.membership.findFirst({
      where: { id, schoolId: authCtx.schoolId },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, status: true },
        },
        staffProfile: { select: { ...profileSelect } },
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
      assignments: m.subjectAssignments.map((a) => ({
        id: a.id,
        subjectId: a.subjectId,
        subjectName: a.subject.name,
        subjectCode: a.subject.code,
        academicYearId: a.academicYearId,
        classId: a.classId,
        sectionId: a.sectionId,
      })),
    };
  });
}

// --------------------------------------------
// Writes
// --------------------------------------------

export async function createStaffMember(
  authCtx: AuthContext,
  input: CreateStaffInput
): Promise<CreatedStaffMember> {
  const ctx = toRequestContext(authCtx);
  const email = input.email.toLowerCase();

  return withRls(ctx, async (tx) => {
    const existing = await tx.membership.findFirst({
      where: { schoolId: authCtx.schoolId, user: { email } },
      select: { id: true },
    });
    if (existing) {
      throw new StaffConflictError(
        'A member with this email already exists in this school'
      );
    }

    const user = await tx.user.create({
      data: {
        name: input.name,
        email,
        emailVerified: true,
        status: 'active',
        phone: input.phone ?? null,
      },
    });

    const membership = await tx.membership.create({
      data: {
        schoolId: authCtx.schoolId,
        userId: user.id,
        role: input.role,
        status: 'ACTIVE',
      },
    });

    const employeeId = input.employeeId ?? synthesizeEmployeeId(membership.id, input.role);
    const staffProfile = await tx.staffProfile.create({
      data: {
        schoolId: authCtx.schoolId,
        membershipId: membership.id,
        employeeId,
        gender: input.gender ?? null,
        department: input.department ?? null,
        designation: input.designation ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: authCtx.schoolId,
        action: 'staff_created',
        entity: 'staff_profile',
        recordId: membership.id,
        after: {
          role: membership.role,
          employeeId,
          email,
          designation: staffProfile.designation ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      id: membership.id,
      userId: user.id,
      employeeId: staffProfile.employeeId,
      fullName: user.name,
      email: user.email,
      phone: user.phone,
      designation: staffProfile.designation ?? STAFF_ROLE_LABELS[input.role] ?? input.role,
      role: membership.role,
      status: membership.status,
    };
  });
}

export async function updateStaffMember(
  authCtx: AuthContext,
  id: string,
  input: UpdateStaffInput
): Promise<{ user: User; membership: Membership; profile: StaffProfilePayload | null }> {
  const ctx = toRequestContext(authCtx);

  return withRls(ctx, async (tx) => {
    const m = await tx.membership.findFirst({
      where: { id, schoolId: authCtx.schoolId },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        staffProfile: {
          select: { employeeId: true, designation: true, gender: true, department: true },
        },
      },
    });
    if (!m) {
      throw new StaffNotFoundError('Member not found');
    }

    if (input.employeeId) {
      const dup = await tx.staffProfile.findFirst({
        where: {
          schoolId: authCtx.schoolId,
          employeeId: input.employeeId,
          membershipId: { not: id },
        },
        select: { id: true },
      });
      if (dup) {
        throw new StaffConflictError('This employee ID is already in use');
      }
    }

    const [user, membership] = await Promise.all([
      tx.user.update({
        where: { id: m.userId },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        },
      }),
      tx.membership.update({
        where: { id },
        data: {
          ...(input.role ? { role: input.role } : {}),
        },
      }),
    ]);

    const profileFields: {
      designation?: string | null;
      gender?: string | null;
      department?: string | null;
      employeeId?: string;
    } = {};
    if (input.designation !== undefined) profileFields.designation = input.designation || null;
    if (input.gender !== undefined) profileFields.gender = input.gender || null;
    if (input.department !== undefined) profileFields.department = input.department || null;
    if (input.employeeId) profileFields.employeeId = input.employeeId;

    let profile = await tx.staffProfile.findFirst({ where: { membershipId: id } });
    if (profile) {
      profile = await tx.staffProfile.update({
        where: { id: profile.id },
        data: { ...profileFields },
      });
    } else if (Object.keys(profileFields).length > 0) {
      profile = await tx.staffProfile.create({
        data: {
          schoolId: authCtx.schoolId,
          membershipId: id,
          employeeId: profileFields.employeeId ?? `STF-${id.slice(-5).toUpperCase()}`,
          ...profileFields,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: authCtx.userId,
        schoolId: authCtx.schoolId,
        action: 'staff_updated',
        entity: 'staff_profile',
        recordId: id,
        before: {
          name: m.user.name,
          phone: m.user.phone ?? null,
          role: m.role,
          status: m.status,
          employeeId: m.staffProfile?.employeeId ?? null,
          designation: m.staffProfile?.designation ?? null,
          gender: m.staffProfile?.gender ?? null,
          department: m.staffProfile?.department ?? null,
        } as Prisma.InputJsonValue,
        after: {
          name: user.name,
          phone: user.phone ?? null,
          role: membership.role,
          status: membership.status,
          employeeId: profile?.employeeId ?? null,
          designation: profile?.designation ?? null,
          gender: profile?.gender ?? null,
          department: profile?.department ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    return { user, membership, profile };
  });
}

// --------------------------------------------
// Lifecycle (Staff Domain Phase 1.5)
// --------------------------------------------
// State transitions (architecture §5, delete policy §15.2):
//   archive    : ACTIVE | SUSPENDED → REMOVED  (+ StaffProfile.isDeleted = true)
//   restore    : REMOVED → ACTIVE              (+ StaffProfile.isDeleted = false)
//   deactivate : ACTIVE → SUSPENDED            (session revocation)
//   reactivate : SUSPENDED → ACTIVE
// Rules:
//   - Every mutation verifies the target belongs to authCtx.schoolId
//     (findFirst({ id, schoolId }) — never findUnique({ id })), per 5B / §16.
//   - Every transition is audited in the SAME transaction (rollback-safe).
//   - Archive + Deactivate revoke the target's sessions immediately.
//   - Archived/suspended members are already excluded from auth
//     (resolveAuthUser filters memberships WHERE status = 'ACTIVE') and from
//     the teacher selection reader (/api/teachers filters status = 'ACTIVE').
//   - No schema change: lifecycle metadata (archivedAt/archivedBy/archiveReason)
//     is captured in the audit-log before/after JSON (architecture §5/§15.2).

export interface LifecycleResult {
  membershipId: string;
  staffProfileId: string | null;
  userId: string;
  previousStatus: StaffStatus;
  newStatus: StaffStatus;
  reason?: string;
}

type LifecycleAction =
  | 'staff_archived'
  | 'staff_restored'
  | 'staff_deactivated'
  | 'staff_reactivated';

const LIFECYCLE_TRANSITIONS: Record<
  LifecycleAction,
  { from: StaffStatus[]; to: StaffStatus; setsDeleted: boolean; revokeSessions: boolean }
> = {
  staff_archived: { from: ['ACTIVE', 'SUSPENDED'], to: 'REMOVED', setsDeleted: true, revokeSessions: true },
  staff_restored: { from: ['REMOVED'], to: 'ACTIVE', setsDeleted: false, revokeSessions: false },
  staff_deactivated: { from: ['ACTIVE'], to: 'SUSPENDED', setsDeleted: false, revokeSessions: true },
  staff_reactivated: { from: ['SUSPENDED'], to: 'ACTIVE', setsDeleted: false, revokeSessions: false },
};

interface LifecycleTarget {
  membershipId: string;
  userId: string;
  staffProfileId: string | null;
  currentStatus: StaffStatus;
}

async function assertLifecycleTarget(
  tx: PrismaTransactionClient,
  authCtx: AuthContext,
  id: string
): Promise<LifecycleTarget> {
  const m = await tx.membership.findFirst({
    where: { id, schoolId: authCtx.schoolId },
    select: { id: true, userId: true, status: true, staffProfile: { select: { id: true } } },
  });
  if (!m) {
    throw new AuthorizationError('Member not found in this school');
  }
  return {
    membershipId: m.id,
    userId: m.userId,
    staffProfileId: m.staffProfile?.id ?? null,
    currentStatus: m.status,
  };
}

async function writeLifecycleAudit(
  tx: PrismaTransactionClient,
  authCtx: AuthContext,
  action: LifecycleAction,
  target: LifecycleTarget,
  previousStatus: StaffStatus,
  newStatus: StaffStatus,
  reason?: string
): Promise<void> {
  const now = new Date();
  await tx.auditLog.create({
    data: {
      userId: authCtx.userId,
      schoolId: authCtx.schoolId,
      action,
      entity: 'staff_profile',
      recordId: target.membershipId,
      before: {
        status: previousStatus,
        staffProfileId: target.staffProfileId,
        membershipId: target.membershipId,
      } as Prisma.InputJsonValue,
      after: {
        staffProfileId: target.staffProfileId,
        membershipId: target.membershipId,
        schoolId: authCtx.schoolId,
        actorMembershipId: authCtx.membershipId,
        previousStatus,
        newStatus,
        reason: reason ?? null,
        timestamp: now.toISOString(),
      } as Prisma.InputJsonValue,
    },
  });
}

async function runLifecycleTransition(
  authCtx: AuthContext,
  id: string,
  action: LifecycleAction,
  reason?: string
): Promise<LifecycleResult> {
  const spec = LIFECYCLE_TRANSITIONS[action];
  const ctx = toRequestContext(authCtx);

  return withRls(ctx, async (tx) => {
    const target = await assertLifecycleTarget(tx, authCtx, id);
    if (!spec.from.includes(target.currentStatus)) {
      throw new StaffConflictError(
        `Cannot ${action.replace('staff_', '')} a member in status ${target.currentStatus}`
      );
    }

    const membership = await tx.membership.update({
      where: { id: target.membershipId },
      data: { status: spec.to },
      select: { id: true, userId: true, status: true },
    });

    if (target.staffProfileId && (spec.setsDeleted || spec.from.includes('REMOVED'))) {
      await tx.staffProfile.update({
        where: { id: target.staffProfileId },
        data: { isDeleted: spec.setsDeleted },
      });
    }

    if (spec.revokeSessions) {
      await tx.session.deleteMany({
        where: { userId: target.userId },
      });
    }

    await writeLifecycleAudit(
      tx,
      authCtx,
      action,
      target,
      target.currentStatus,
      spec.to,
      reason
    );

    return {
      membershipId: membership.id,
      staffProfileId: target.staffProfileId,
      userId: membership.userId,
      previousStatus: target.currentStatus,
      newStatus: membership.status,
      reason,
    };
  });
}

export async function archiveStaff(
  authCtx: AuthContext,
  id: string,
  input: { reason: string }
): Promise<LifecycleResult> {
  return runLifecycleTransition(authCtx, id, 'staff_archived', input.reason);
}

export async function restoreStaff(
  authCtx: AuthContext,
  id: string
): Promise<LifecycleResult> {
  return runLifecycleTransition(authCtx, id, 'staff_restored');
}

export async function deactivateStaff(
  authCtx: AuthContext,
  id: string
): Promise<LifecycleResult> {
  return runLifecycleTransition(authCtx, id, 'staff_deactivated');
}

export async function reactivateStaff(
  authCtx: AuthContext,
  id: string
): Promise<LifecycleResult> {
  return runLifecycleTransition(authCtx, id, 'staff_reactivated');
}
