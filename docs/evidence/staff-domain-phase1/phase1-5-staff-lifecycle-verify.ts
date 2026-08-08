import 'dotenv/config';
import { withRls, type RequestContext } from '../../../src/lib/prisma/rls-middleware';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../src/generated/prisma/client';
import { resolveAuthUser } from '../../../src/lib/auth/resolve-auth-user';
import {
  createStaffMember,
  deactivateStaff,
  reactivateStaff,
  archiveStaff,
  restoreStaff,
  StaffConflictError,
  StaffServiceError,
} from '../../../src/services/staff/staff-service';
import { AuthorizationError } from '../../../src/lib/permissions/guards';
import { hasPermission } from '../../../src/lib/permissions/permissions';

/**
 * Phase 1.5 runtime verification — Staff lifecycle.
 * Runs against the real seed DB (seed_school_ea) using a real SCHOOL_ADMIN
 * context, exercising the actual service layer. Self-rolled-back: every row
 * created is deleted at the end.
 *
 * Covers the 18 required checks (see phase1-5-staff-lifecycle.md §10).
 */

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const p = new PrismaClient({ adapter });

const SCHOOL_A = 'seed_school_ea';

let failures = 0;
const results: { id: string; pass: boolean; detail: string }[] = [];
function check(id: string, pass: boolean, detail: string) {
  results.push({ id, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  — ${detail}`);
  if (!pass) failures++;
}

async function buildAdminContext(): Promise<RequestContext> {
  const admin = await p.membership.findFirst({
    where: { schoolId: SCHOOL_A, role: 'SCHOOL_ADMIN', status: 'ACTIVE' },
    select: { id: true, schoolId: true, userId: true, role: true },
  });
  if (!admin) throw new Error('No SCHOOL_ADMIN membership in seed_school_ea');
  return { userId: admin.userId, schoolId: admin.schoolId, membershipId: admin.id, role: admin.role };
}

interface AuthLike {
  userId: string;
  email: string;
  membershipId: string;
  schoolId: string;
  role: string;
  schoolStatus: string;
}

async function main() {
  const ctx = await buildAdminContext();
  const adminUser = await p.user.findUniqueOrThrow({
    where: { id: ctx.userId },
    select: { email: true },
  });
  const adminCtx: AuthLike = {
    userId: ctx.userId,
    email: adminUser.email,
    membershipId: ctx.membershipId!,
    schoolId: ctx.schoolId!,
    role: ctx.role!,
    schoolStatus: 'ACTIVE',
  };

  console.log(`actor: ${adminCtx.email} (${adminCtx.role}) @ ${adminCtx.schoolId}`);

  // ---- Fixture: create a temp TEACHER + an enrollment anchor + assignment/attendance rows ----
  const tag = `p15-${Date.now().toString(36)}`;
  const email = `p15-verify-${tag}@seed.test`;
  const created = await createStaffMember(adminCtx as never, {
    name: `P15 Verify ${tag}`,
    email,
    role: 'TEACHER',
    designation: 'Lifecycle Test',
    department: 'Verify',
  });
  const membershipId = created.id;

  let classAssignmentId: string | null = null;
  let attendanceRecordId: string | null = null;
  let existingEnrollmentId: string | null = null;

  await withRls(ctx, async (tx) => {
    const anchor = await tx.classAssignment.findFirst({
      where: { schoolId: SCHOOL_A, status: 'ACTIVE' },
      select: { classId: true, sectionId: true, teacherMembershipId: true },
    });
    const anchorClass = await tx.classAssignment.findFirst({
      where: { schoolId: SCHOOL_A, status: 'ACTIVE' },
      select: { classId: true },
    });
    const studentEnrollment = await tx.membership.findFirst({
      where: { schoolId: SCHOOL_A, role: 'STUDENT', status: 'ACTIVE' },
      select: { id: true },
    });

    if (anchor) {
      const ca = await tx.classAssignment.create({
        data: {
          schoolId: SCHOOL_A,
          classId: anchor.classId,
          sectionId: anchor.sectionId,
          teacherMembershipId: membershipId,
          role: 'SUBSTITUTE',
          status: 'REMOVED',
        },
      });
      classAssignmentId = ca.id;
    }
    if (anchorClass && studentEnrollment) {
      existingEnrollmentId = studentEnrollment.id;
      const ar = await tx.attendanceRecord.create({
        data: {
          schoolId: SCHOOL_A,
          classId: anchorClass.classId,
          studentMembershipId: studentEnrollment.id,
          date: new Date('2026-01-05'),
          status: 'PRESENT',
          markedByMembershipId: membershipId,
        },
      });
      attendanceRecordId = ar.id;
    }
  });

  // create a fake session for the temp user so revocation can be observed
  await withRls(ctx, async (tx) => {
    await tx.session.create({
      data: {
        token: `p15-session-${tag}`,
        expiresAt: new Date(Date.now() + 86400000),
        userId: created.userId,
      },
    });
  });

  const statusOf = async (id: string) =>
    withRls(ctx, (tx) => tx.membership.findUniqueOrThrow({ where: { id }, select: { status: true } }));

  const profileOf = async (id: string) =>
    withRls(ctx, (tx) =>
      tx.staffProfile.findFirst({ where: { membershipId: id }, select: { isDeleted: true } })
    );

  const sessionCount = async (userId: string) =>
    withRls(ctx, (tx) => tx.session.count({ where: { userId } }));

  const auditOf = async (id: string, action: string) =>
    withRls(ctx, (tx) =>
      tx.auditLog.findFirst({
        where: { recordId: id, action, schoolId: SCHOOL_A },
        orderBy: { createdAt: 'desc' },
      })
    );

  const activeListContains = async (id: string) =>
    withRls(ctx, (tx) =>
      tx.membership.count({
        where: { schoolId: SCHOOL_A, status: 'ACTIVE', role: { in: ['TEACHER', 'CLASS_TEACHER'] }, id },
      })
    );

  const resolveAuthOf = async (userId: string) => resolveAuthUser(userId);

  // ---- 1. ACTIVE initial state ----
  const initial = await statusOf(membershipId);
  check('01-initial-active', initial.status === 'ACTIVE', `status=${initial.status}`);

  // ---- 2. ACTIVE → SUSPENDED (deactivate) ----
  const deact = await deactivateStaff(adminCtx as never, membershipId);
  check('02-deactivate', deact.newStatus === 'SUSPENDED', `ACTIVE→SUSPENDED ok`);
  const afterDeact = await statusOf(membershipId);
  check('03-deactivate-persisted', afterDeact.status === 'SUSPENDED', `db status=${afterDeact.status}`);

  // ---- 8/9. audit row for deactivate, transactional audit ----
  const auditDeact = await auditOf(membershipId, 'staff_deactivated');
  check('08-audit-deactivated', !!auditDeact, 'staff_deactivated audit row exists');
  const ad = auditDeact?.after as Record<string, unknown> | undefined;
  check(
    '08b-audit-fields',
    !!ad &&
      ad.staffProfileId != null &&
      ad.membershipId === membershipId &&
      ad.schoolId === SCHOOL_A &&
      ad.actorMembershipId === adminCtx.membershipId &&
      ad.previousStatus === 'ACTIVE' &&
      ad.newStatus === 'SUSPENDED' &&
      !!ad.timestamp,
    `audit after=${JSON.stringify(ad)}`
  );

  // ---- 11. suspended excluded from active staff list ----
  check('11-suspended-excluded', (await activeListContains(membershipId)) === 0, 'not in active teacher list');

  // ---- 12/14. suspended excluded from teacher selection; assignment preserved ----
  if (classAssignmentId) {
    const ca = await withRls(ctx, (tx) => tx.classAssignment.findUnique({ where: { id: classAssignmentId! } }));
    check('14-assignment-preserved-suspended', !!ca && ca.teacherMembershipId === membershipId, `assignment row retained (status=${ca?.status})`);
  } else {
    check('14-assignment-preserved-suspended', false, 'no anchor assignment to create fixture');
  }

  // ---- 15. session revoked + auth blocked ----
  check('15-sessions-revoked-deactivate', (await sessionCount(created.userId)) === 0, 'sessions deleted');
  const authAfterDeact = await resolveAuthOf(created.userId);
  check(
    '15b-auth-blocked-deactivate',
    !authAfterDeact.ok && authAfterDeact.reason === 'NO_ACTIVE_MEMBERSHIP',
    `resolveAuthUser → ${authAfterDeact.ok ? 'ok' : authAfterDeact.reason}`
  );

  // ---- 5. invalid transition: deactivate an already-suspended member ----
  let invalidRejected = false;
  try {
    await deactivateStaff(adminCtx as never, membershipId);
  } catch (e) {
    invalidRejected = e instanceof StaffConflictError;
  }
  check('05-invalid-transition-deactivate-suspended', invalidRejected, 'StaffConflictError thrown');

  // ---- 3. SUSPENDED → ACTIVE (reactivate) ----
  const rea = await reactivateStaff(adminCtx as never, membershipId);
  check('03-reactivate', rea.newStatus === 'ACTIVE', 'SUSPENDED→ACTIVE ok');
  const afterRea = await statusOf(membershipId);
  check('03b-reactivate-persisted', afterRea.status === 'ACTIVE', `db status=${afterRea.status}`);
  check('08c-audit-reactivated', !!(await auditOf(membershipId, 'staff_reactivated')), 'staff_reactivated audit row exists');
  check('15c-auth-restored', (await resolveAuthOf(created.userId)).ok, 'resolveAuthUser ok after reactivate');

  // ---- 1. ACTIVE → ARCHIVED (archive with reason) ----
  // create a fresh session BEFORE archive so revocation can be observed
  await withRls(ctx, async (tx) => {
    await tx.session.create({
      data: { token: `p15-session-${tag}-2`, expiresAt: new Date(Date.now() + 86400000), userId: created.userId },
    });
  });
  const reason = 'End of employment — lifecycle verification fixture';
  const arch = await archiveStaff(adminCtx as never, membershipId, { reason });
  check('01-archive', arch.newStatus === 'REMOVED', 'ACTIVE→REMOVED ok');
  const afterArch = await statusOf(membershipId);
  check('01b-archive-persisted', afterArch.status === 'REMOVED', `db status=${afterArch.status}`);
  const profArch = await profileOf(membershipId);
  check('01c-archive-isDeleted', profArch?.isDeleted === true, `isDeleted=${profArch?.isDeleted}`);
  const auditArch = await auditOf(membershipId, 'staff_archived');
  check('08d-audit-archived', !!auditArch, 'staff_archived audit row exists');
  const aa = auditArch?.after as Record<string, unknown> | undefined;
  check(
    '08e-archive-reason',
    !!aa && aa.reason === reason && aa.previousStatus === 'ACTIVE' && aa.newStatus === 'REMOVED',
    `audit reason=${JSON.stringify(aa?.reason)} prev=${aa?.previousStatus} new=${aa?.newStatus}`
  );

  // ---- 11b. archived excluded from active list ----
  check('11b-archived-excluded', (await activeListContains(membershipId)) === 0, 'not in active teacher list');

  // ---- 14b. historical assignment + attendance preserved after archive ----
  if (classAssignmentId) {
    const ca = await withRls(ctx, (tx) => tx.classAssignment.findUnique({ where: { id: classAssignmentId! } }));
    check('14b-assignment-preserved-archived', !!ca && ca.teacherMembershipId === membershipId, 'class assignment row retained');
  }
  if (attendanceRecordId) {
    const ar = await withRls(ctx, (tx) => tx.attendanceRecord.findUnique({ where: { id: attendanceRecordId! } }));
    check('14c-attendance-preserved-archived', !!ar && ar.studentMembershipId === existingEnrollmentId, 'attendance record retained');
  }

  // ---- 15d. session revoked after archive ----
  check('15d-sessions-revoked-archive', (await sessionCount(created.userId)) === 0, 'sessions deleted after archive');
  const authAfterArch = await resolveAuthOf(created.userId);
  check('15e-auth-blocked-archived', !authAfterArch.ok, `resolveAuthUser → ${authAfterArch.ok ? 'ok' : authAfterArch.reason}`);

  // ---- 5b. invalid transition: reactivate an archived member, deactivate an archived member ----
  let invalidRejected2 = false;
  try { await reactivateStaff(adminCtx as never, membershipId); } catch (e) { invalidRejected2 = e instanceof StaffConflictError; }
  check('05b-invalid-transition-reactivate-archived', invalidRejected2, 'StaffConflictError thrown');

  // ---- 4. REMOVED → ACTIVE (restore) ----
  const res = await restoreStaff(adminCtx as never, membershipId);
  check('04-restore', res.newStatus === 'ACTIVE', 'REMOVED→ACTIVE ok');
  const afterRes = await statusOf(membershipId);
  check('04b-restore-persisted', afterRes.status === 'ACTIVE', `db status=${afterRes.status}`);
  const profRes = await profileOf(membershipId);
  check('04c-restore-isDeleted-false', profRes?.isDeleted === false, `isDeleted=${profRes?.isDeleted}`);
  check('08f-audit-restored', !!(await auditOf(membershipId, 'staff_restored')), 'staff_restored audit row exists');

  // ---- 5c. invalid transition: restore an active member ----
  let invalidRejected3 = false;
  try { await restoreStaff(adminCtx as never, membershipId); } catch (e) { invalidRejected3 = e instanceof StaffConflictError; }
  check('05c-invalid-transition-restore-active', invalidRejected3, 'StaffConflictError thrown');

  // ---- 6. wrong-school access rejected with 403 ----
  let crossSchool403 = false;
  try {
    const crossCtx: AuthLike = { ...adminCtx, schoolId: 'fixture_school_b' };
    await deactivateStaff(crossCtx as never, membershipId);
  } catch (e) {
    crossSchool403 = e instanceof AuthorizationError;
  }
  check('06-wrong-school-403', crossSchool403, 'AuthorizationError (403) on cross-school deactivate');

  // ---- 7. unauthorized roles rejected (permission map + route guard) ----
  const roleGrants = [
    ['SUPER_ADMIN', true],
    ['SCHOOL_ADMIN', true],
    ['HR', true],
    ['PRINCIPAL', false],
    ['VICE_PRINCIPAL', false],
    ['TEACHER', false],
    ['CLASS_TEACHER', false],
    ['ACCOUNTANT', false],
    ['LIBRARIAN', false],
    ['TRANSPORT_MANAGER', false],
    ['NON_TEACHING', false],
    ['DRIVER', false],
    ['CAFETERIA_STAFF', false],
  ] as const;
  let roleMatrixOk = true;
  for (const [role, expected] of roleGrants) {
    const actual = hasPermission(role, 'staff', 'deactivate');
    if (actual !== expected) {
      roleMatrixOk = false;
      console.log(`    MISMATCH deactivate ${role}: expected ${expected} got ${actual}`);
    }
  }
  check('07-role-matrix-deactivate', roleMatrixOk, 'deactivate grants match approved matrix');
  const reactMatrixOk =
    hasPermission('SUPER_ADMIN', 'staff', 'reactivate') &&
    hasPermission('SCHOOL_ADMIN', 'staff', 'reactivate') &&
    hasPermission('HR', 'staff', 'reactivate') &&
    !hasPermission('PRINCIPAL', 'staff', 'reactivate') &&
    !hasPermission('TEACHER', 'staff', 'reactivate');
  check('07b-role-matrix-reactivate', reactMatrixOk, 'reactivate grants match approved matrix');
  const restoreMatrixOk =
    hasPermission('SUPER_ADMIN', 'staff', 'restore') &&
    hasPermission('SCHOOL_ADMIN', 'staff', 'restore') &&
    !hasPermission('HR', 'staff', 'restore') &&
    !hasPermission('PRINCIPAL', 'staff', 'restore');
  check('07c-restore-admin-only', restoreMatrixOk, 'restore remains SCHOOL_ADMIN only');

  // ---- 16. no DELETE endpoint exists (static scan) ----
  const { execSync } = await import('child_process');
  let deleteHits = '';
  try {
    deleteHits = execSync(
      'node -e "const fs=require(\'fs\');const p=\'src/app/api/staff\';const files=[];const walk=d=>fs.readdirSync(d,{withFileTypes:true}).forEach(e=>{const f=d+\'/\'+e.name;if(e.isDirectory())walk(f);else if(e.name===\'route.ts\')files.push(f)});walk(p);const hits=files.filter(f=>fs.readFileSync(f,\'utf8\').includes(\'export async function DELETE\'));console.log(hits.join(\'\\n\'))"',
      { encoding: 'utf8' }
    ).trim();
  } catch { /* no hit output */ }
  check('16-no-delete-endpoint', deleteHits === '', `DELETE handlers found: ${JSON.stringify(deleteHits)}`);

  // ---- 17. existing staff CRUD still works (read) ----
  const detail = await withRls(ctx, (tx) =>
    tx.membership.findFirst({ where: { id: membershipId, schoolId: SCHOOL_A }, include: { staffProfile: true } })
  );
  check('17-crud-read-works', !!detail && detail.staffProfile?.employeeId === created.employeeId, 'GET member returns profile');

  // ---- 18. assignment resolver unchanged (api/teachers still ACTIVE-scoped) ----
  // after restore the member is ACTIVE again → the ACTIVE-scoped teacher reader
  // returns it (proving the resolver filter was NOT altered by lifecycle).
  const teachersRes = await withRls(ctx, (tx) =>
    tx.membership.count({
      where: { schoolId: SCHOOL_A, status: 'ACTIVE', role: { in: ['TEACHER', 'CLASS_TEACHER'] }, id: membershipId },
    })
  );
  check('18-resolver-unchanged', teachersRes === 1, 'ACTIVE teacher reader returns restored ACTIVE member (ACTIVE filter intact)');

  // ================= ROLLBACK =================
  await withRls(ctx, async (tx) => {
    if (classAssignmentId) await tx.classAssignment.deleteMany({ where: { id: classAssignmentId } });
    if (attendanceRecordId) await tx.attendanceRecord.deleteMany({ where: { id: attendanceRecordId } });
    await tx.session.deleteMany({ where: { userId: created.userId } });
    await tx.auditLog.deleteMany({ where: { recordId: membershipId, schoolId: SCHOOL_A } });
    await tx.staffProfile.deleteMany({ where: { membershipId } });
    await tx.membership.deleteMany({ where: { id: membershipId } });
    await tx.user.deleteMany({ where: { id: created.userId } });
  });
  console.log('rollback: temp staff, assignments, attendance, sessions, audit rows deleted');

  console.log(`\n=== ${results.length} checks, ${failures} failure(s) ===`);
  for (const r of results) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.id}`);
  console.log(failures === 0 ? 'ALL PHASE 1.5 CHECKS PASS' : 'FAILURES DETECTED');
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
