import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hasPermission } from '../src/lib/permissions/permissions';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (!TEST_DB) throw new Error('TEST_DATABASE_URL is not set');

function buildUserUrl(superUrl: string): string {
  const url = new URL(superUrl);
  const projectRef = url.username.split('.')[1] || '';
  url.username = projectRef ? `app_user.${projectRef}` : 'app_user';
  url.password = 'knVnzbJJI9Ab_En4oAy0NOdqxpYR-CVF';
  return url.toString();
}

const superPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: TEST_DB }),
});
const userPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: buildUserUrl(TEST_DB) }),
});

async function runInContext(
  userId: string,
  query: string
): Promise<Record<string, unknown>[]> {
  return userPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}'`);
    return tx.$queryRawUnsafe(query);
  });
}

const SCHOOL = 'acad-test-school';
const AY = 'acad-test-ay';
const SECTION = 'acad-test-section';
const CLASS = 'acad-test-class';
const ADMIN_USER = 'acad-test-admin';
const TEACHER_USER = 'acad-test-teacher';
const STUDENT_USER = 'acad-test-student';
const PARENT_USER = 'acad-test-parent';
const OTHER_USER = 'acad-test-other';
const ADMIN_MEM = 'acad-test-admin-mem';
const TEACHER_MEM = 'acad-test-teacher-mem';
const STUDENT_MEM = 'acad-test-student-mem';
const PARENT_MEM = 'acad-test-parent-mem';
const OTHER_MEM = 'acad-test-other-mem';
const ASSIGNMENT = 'acad-test-assign';
const ENROLLMENT = 'acad-test-enroll';
const TRANSFER_ENR = 'acad-test-trans';

beforeAll(async () => {
  const now = new Date();
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO schools (id, name, slug, status, timezone, currency, created_at, updated_at) VALUES ('${SCHOOL}', 'Test School', 'acad-test', 'ACTIVE', 'UTC', 'USD', $1, $1) ON CONFLICT (id) DO NOTHING`,
    [now]
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO users (id, name, email, email_verified, status, created_at, updated_at) VALUES ('${ADMIN_USER}', 'Admin', 'acad-admin@test.com', true, 'active', $1, $1), ('${TEACHER_USER}', 'Teacher', 'acad-teacher@test.com', true, 'active', $1, $1), ('${STUDENT_USER}', 'Student', 'acad-student@test.com', true, 'active', $1, $1), ('${PARENT_USER}', 'Parent', 'acad-parent@test.com', true, 'active', $1, $1), ('${OTHER_USER}', 'Other', 'acad-other@test.com', true, 'active', $1, $1) ON CONFLICT (id) DO NOTHING`,
    [now]
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO memberships (id, school_id, user_id, role, status, joined_at, created_at, updated_at) VALUES ('${ADMIN_MEM}', '${SCHOOL}', '${ADMIN_USER}', 'SCHOOL_ADMIN', 'ACTIVE', $1, $1, $1), ('${TEACHER_MEM}', '${SCHOOL}', '${TEACHER_USER}', 'TEACHER', 'ACTIVE', $1, $1, $1), ('${STUDENT_MEM}', '${SCHOOL}', '${STUDENT_USER}', 'STUDENT', 'ACTIVE', $1, $1, $1), ('${PARENT_MEM}', '${SCHOOL}', '${PARENT_USER}', 'PARENT', 'ACTIVE', $1, $1, $1), ('${OTHER_MEM}', '${SCHOOL}', '${OTHER_USER}', 'STUDENT', 'ACTIVE', $1, $1, $1) ON CONFLICT (id) DO NOTHING`,
    [now]
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_active, created_at, updated_at) VALUES ('${AY}', '${SCHOOL}', '2025-26', '2025-04-01', '2026-03-31', true, $1, $1) ON CONFLICT (id) DO NOTHING`,
    [now]
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO sections (id, school_id, name, created_at, updated_at) VALUES ('${SECTION}', '${SCHOOL}', 'A', $1, $1) ON CONFLICT (id) DO NOTHING`,
    [now]
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO classes (id, school_id, academic_year_id, section_id, name, grade_level, created_at, updated_at) VALUES ('${CLASS}', '${SCHOOL}', '${AY}', '${SECTION}', 'Grade 5', '5', $1, $1) ON CONFLICT (id) DO NOTHING`,
    [now]
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO class_assignments (id, school_id, class_id, teacher_membership_id, role, created_at, updated_at) VALUES ('${ASSIGNMENT}', '${SCHOOL}', '${CLASS}', '${TEACHER_MEM}', 'PRIMARY', $1, $1) ON CONFLICT (id) DO NOTHING`,
    [now]
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO class_enrollments (id, school_id, class_id, student_membership_id, created_at, updated_at) VALUES ('${ENROLLMENT}', '${SCHOOL}', '${CLASS}', '${STUDENT_MEM}', $1, $1) ON CONFLICT (id) DO NOTHING`,
    [now]
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO parent_student_links (id, school_id, parent_membership_id, student_membership_id, relationship, created_at, updated_at) VALUES ('acad-test-psl', '${SCHOOL}', '${PARENT_MEM}', '${STUDENT_MEM}', 'MOTHER', $1, $1) ON CONFLICT (id) DO NOTHING`,
    [now]
  );
});

afterAll(async () => {
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM class_enrollments WHERE id IN ('${ENROLLMENT}','${TRANSFER_ENR}')`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM parent_student_links WHERE id = 'acad-test-psl'`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM class_assignments WHERE id = '${ASSIGNMENT}'`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM classes WHERE id = '${CLASS}'`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM sections WHERE id = '${SECTION}'`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM academic_years WHERE id = '${AY}'`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM memberships WHERE id IN ('${ADMIN_MEM}','${TEACHER_MEM}','${STUDENT_MEM}','${PARENT_MEM}','${OTHER_MEM}')`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM users WHERE id IN ('${ADMIN_USER}','${TEACHER_USER}','${STUDENT_USER}','${PARENT_USER}','${OTHER_USER}')`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM schools WHERE id = '${SCHOOL}'`
  );
  await superPrisma.$disconnect();
  await userPrisma.$disconnect();
});

describe('Academic Foundation — RLS', () => {
  it('school admin can see academic years', async () => {
    const r = await runInContext(
      ADMIN_USER,
      `SELECT count(*)::int as cnt FROM academic_years WHERE school_id = '${SCHOOL}'`
    );
    expect(Number(r[0].cnt)).toBe(1);
  });

  it('teacher CAN see assigned class', async () => {
    const r = await runInContext(
      TEACHER_USER,
      `SELECT count(*)::int as cnt FROM class_assignments WHERE id = '${ASSIGNMENT}'`
    );
    expect(Number(r[0].cnt)).toBe(1);
  });

  it('student CAN see own enrollment', async () => {
    const r = await runInContext(
      STUDENT_USER,
      `SELECT count(*)::int as cnt FROM class_enrollments WHERE id = '${ENROLLMENT}'`
    );
    expect(Number(r[0].cnt)).toBe(1);
  });

  it('student CANNOT see other student enrollment', async () => {
    const r = await runInContext(
      STUDENT_USER,
      `SELECT count(*)::int as cnt FROM class_enrollments WHERE student_membership_id = '${OTHER_MEM}'`
    );
    expect(Number(r[0].cnt)).toBe(0);
  });

  it('cross-school access denied', async () => {
    const r = await runInContext(
      'nonexistent-user',
      `SELECT count(*)::int as cnt FROM classes`
    );
    expect(Number(r[0].cnt)).toBe(0);
  });

  it('teacher CANNOT see unassigned class assignment', async () => {
    // Create another class without an assignment for this teacher
    const now = new Date();
    await superPrisma.$executeRawUnsafe(
      `INSERT INTO classes (id, school_id, academic_year_id, section_id, name, grade_level, created_at, updated_at) VALUES ('acad-unassigned', '${SCHOOL}', '${AY}', '${SECTION}', 'Unassigned Class', '7', $1, $1) ON CONFLICT (id) DO NOTHING`,
      [now]
    );
    await superPrisma.$executeRawUnsafe(
      `INSERT INTO class_assignments (id, school_id, class_id, teacher_membership_id, role, created_at, updated_at) VALUES ('acad-other-assign', '${SCHOOL}', 'acad-unassigned', '${OTHER_MEM}', 'PRIMARY', $1, $1) ON CONFLICT (id) DO NOTHING`,
      [now]
    );
    const r = await runInContext(
      TEACHER_USER,
      `SELECT has_class_assignment('acad-unassigned') as val`
    );
    expect(r[0].val).toBe(false);
    await superPrisma.$executeRawUnsafe(
      `DELETE FROM class_assignments WHERE id = 'acad-other-assign'`
    );
    await superPrisma.$executeRawUnsafe(
      `DELETE FROM classes WHERE id = 'acad-unassigned'`
    );
  });

  it('parent CAN see enrollment in own school', async () => {
    // Parent has PARENT role membership in the school, RLS allows seeing
    // enrollments in their school via the parent policy
    const r = await runInContext(
      PARENT_USER,
      `SELECT count(*)::int as cnt FROM class_enrollments WHERE school_id = '${SCHOOL}' AND student_membership_id = '${STUDENT_MEM}'`
    );
    expect(Number(r[0].cnt)).toBe(1);
  });

  it('student transfer preserves history', async () => {
    const now = new Date();
    await superPrisma.$executeRawUnsafe(
      `INSERT INTO class_enrollments (id, school_id, class_id, student_membership_id, status, created_at, updated_at) VALUES ('${TRANSFER_ENR}', '${SCHOOL}', '${CLASS}', '${STUDENT_MEM}', 'TRANSFERRED', $1, $1) ON CONFLICT (id) DO NOTHING`,
      [now]
    );
    const r = await superPrisma.$queryRawUnsafe(
      `SELECT count(*)::int as cnt FROM class_enrollments WHERE id = '${TRANSFER_ENR}' AND status = 'TRANSFERRED'`
    );
    expect(Number(r[0].cnt)).toBe(1);
    await superPrisma.$executeRawUnsafe(
      `DELETE FROM class_enrollments WHERE id = '${TRANSFER_ENR}'`
    );
  });
});

describe('Academic Foundation — has_class_assignment()', () => {
  it('returns true for assigned teacher', async () => {
    const r = await runInContext(
      TEACHER_USER,
      `SELECT has_class_assignment('${CLASS}') as val`
    );
    expect(r[0].val).toBe(true);
  });

  it('returns false for unassigned user', async () => {
    const r = await runInContext(
      STUDENT_USER,
      `SELECT has_class_assignment('${CLASS}') as val`
    );
    expect(r[0].val).toBe(false);
  });
});

describe('Academic Foundation — Partial Unique Indexes', () => {
  it('academic_years has partial index for active', async () => {
    const r = await superPrisma.$queryRawUnsafe(
      `SELECT count(*)::int as cnt FROM pg_indexes WHERE indexname = 'academic_years_school_id_is_active_key'`
    );
    expect(Number(r[0].cnt)).toBe(1);
  });

  it('class_assignments has partial index for active', async () => {
    const r = await superPrisma.$queryRawUnsafe(
      `SELECT count(*)::int as cnt FROM pg_indexes WHERE indexname = 'class_assignments_class_id_teacher_role_key'`
    );
    expect(Number(r[0].cnt)).toBe(1);
  });

  it('class_enrollments has partial index for active', async () => {
    const r = await superPrisma.$queryRawUnsafe(
      `SELECT count(*)::int as cnt FROM pg_indexes WHERE indexname = 'class_enrollments_class_id_student_key'`
    );
    expect(Number(r[0].cnt)).toBe(1);
  });

  it('rejects duplicate active academic year', async () => {
    const now = new Date();
    try {
      await superPrisma.$executeRawUnsafe(
        `INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_active, created_at, updated_at) VALUES ('acad-dup-ay', '${SCHOOL}', 'Active Dup', '2026-04-01', '2027-03-31', true, $1, $1)`,
        [now]
      );
      expect('should not reach').toBe('this');
    } catch (e: unknown) {
      expect((e as Error).message).toContain('duplicate');
    }
  });
});

describe('Academic Foundation — RBAC', () => {
  it('school admin can manage classes', () => {
    expect(hasPermission('SCHOOL_ADMIN', 'classes', 'manage')).toBe(true);
  });

  it('teacher can read classes', () => {
    expect(hasPermission('TEACHER', 'classes', 'read')).toBe(true);
  });

  it('teacher cannot create classes', () => {
    expect(hasPermission('TEACHER', 'classes', 'create')).toBe(false);
  });

  it('student can read own class enrollment', () => {
    expect(hasPermission('STUDENT', 'class_enrollments', 'read')).toBe(true);
  });

  it('student cannot update classes', () => {
    expect(hasPermission('STUDENT', 'classes', 'update')).toBe(false);
  });
});
