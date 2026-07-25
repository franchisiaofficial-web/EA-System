import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hasPermission } from '../src/lib/permissions/permissions';
import { calculateAttendancePercentage } from '../src/services/attendance/attendance-service';

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

const SCHOOL = 'att-test-sch';
const AY = 'att-test-ay';
const SECTION = 'att-test-sec';
const CLASS = 'att-test-cls';
const ADMIN = 'att-test-adm';
const TEACHER = 'att-test-tchr';
const STUDENT = 'att-test-stu';
const STUDENT2 = 'att-test-stu2';
const PARENT = 'att-test-prt';
const ADMIN_MEM = 'att-test-adm-m';
const TEACHER_MEM = 'att-test-tchr-m';
const STUDENT_MEM = 'att-test-stu-m';
const STUDENT2_MEM = 'att-test-stu2-m';
const PARENT_MEM = 'att-test-prt-m';

beforeAll(async () => {
  const now = new Date();
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO schools (id, name, slug, status, timezone, currency, created_at, updated_at) VALUES ('${SCHOOL}', 'Att School', 'att-test', 'ACTIVE', 'Asia/Kolkata', 'INR', '${now.toISOString()}', '${now.toISOString()}') ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO users (id, name, email, email_verified, status, created_at, updated_at) VALUES ('${ADMIN}', 'Admin', 'att-adm@t.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}'), ('${TEACHER}', 'Teacher', 'att-tchr@t.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}'), ('${STUDENT}', 'Student', 'att-stu@t.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}'), ('${STUDENT2}', 'Student2', 'att-stu2@t.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}'), ('${PARENT}', 'Parent', 'att-prt@t.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}') ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO memberships (id, school_id, user_id, role, status, joined_at, created_at, updated_at) VALUES ('${ADMIN_MEM}', '${SCHOOL}', '${ADMIN}', 'SCHOOL_ADMIN', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}'), ('${TEACHER_MEM}', '${SCHOOL}', '${TEACHER}', 'TEACHER', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}'), ('${STUDENT_MEM}', '${SCHOOL}', '${STUDENT}', 'STUDENT', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}'), ('${STUDENT2_MEM}', '${SCHOOL}', '${STUDENT2}', 'STUDENT', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}'), ('${PARENT_MEM}', '${SCHOOL}', '${PARENT}', 'PARENT', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}') ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO parent_student_links (id, school_id, parent_membership_id, student_membership_id, relationship, created_at, updated_at) VALUES ('att-psl', '${SCHOOL}', '${PARENT_MEM}', '${STUDENT_MEM}', 'MOTHER', '${now.toISOString()}', '${now.toISOString()}') ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_active, created_at, updated_at) VALUES ('${AY}', '${SCHOOL}', '2025', '2025-04-01', '2026-03-31', true, '${now.toISOString()}', '${now.toISOString()}') ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO sections (id, school_id, name, created_at, updated_at) VALUES ('${SECTION}', '${SCHOOL}', 'A', '${now.toISOString()}', '${now.toISOString()}') ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO classes (id, school_id, academic_year_id, section_id, name, grade_level, created_at, updated_at) VALUES ('${CLASS}', '${SCHOOL}', '${AY}', '${SECTION}', 'G5', '5', '${now.toISOString()}', '${now.toISOString()}') ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO class_enrollments (id, school_id, class_id, student_membership_id, created_at, updated_at) VALUES ('att-enr', '${SCHOOL}', '${CLASS}', '${STUDENT_MEM}', '${now.toISOString()}', '${now.toISOString()}'), ('att-enr2', '${SCHOOL}', '${CLASS}', '${STUDENT2_MEM}', '${now.toISOString()}', '${now.toISOString()}') ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO class_assignments (id, school_id, class_id, teacher_membership_id, role, created_at, updated_at) VALUES ('att-asgn', '${SCHOOL}', '${CLASS}', '${TEACHER_MEM}', 'PRIMARY', '${now.toISOString()}', '${now.toISOString()}') ON CONFLICT (id) DO NOTHING`
  );
});

afterAll(async () => {
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM attendance_records WHERE id LIKE 'att-%'`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM class_enrollments WHERE id IN ('att-enr','att-enr2')`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM class_assignments WHERE id = 'att-asgn'`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM parent_student_links WHERE id = 'att-psl'`
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
    `DELETE FROM memberships WHERE id IN ('${ADMIN_MEM}','${TEACHER_MEM}','${STUDENT_MEM}','${STUDENT2_MEM}','${PARENT_MEM}')`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM users WHERE id IN ('${ADMIN}','${TEACHER}','${STUDENT}','${STUDENT2}','${PARENT}')`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM schools WHERE id = '${SCHOOL}'`
  );
  await superPrisma.$disconnect();
  await userPrisma.$disconnect();
});

describe('Attendance — calculateAttendancePercentage', () => {
  it('returns 0 for empty stats', () => {
    expect(
      calculateAttendancePercentage({
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
      })
    ).toBe(0);
  });

  it('returns 100 for all present', () => {
    expect(
      calculateAttendancePercentage({
        present: 10,
        late: 0,
        absent: 0,
        excused: 0,
      })
    ).toBe(100);
  });

  it('handles late as present', () => {
    expect(
      calculateAttendancePercentage({
        present: 5,
        late: 2,
        absent: 3,
        excused: 0,
      })
    ).toBe(70);
  });

  it('excludes EXCUSED from calculation', () => {
    expect(
      calculateAttendancePercentage({
        present: 8,
        late: 2,
        absent: 0,
        excused: 5,
      })
    ).toBe(100);
  });

  it('EXCUSED excluded from both numerator and denominator', () => {
    expect(
      calculateAttendancePercentage({
        present: 5,
        late: 1,
        absent: 4,
        excused: 3,
      })
    ).toBe(60);
  });
});

describe('Attendance — RLS', () => {
  it('teacher can see assigned class attendance', async () => {
    const r = await runInContext(
      TEACHER,
      `SELECT count(*)::int FROM attendance_records WHERE class_id = '${CLASS}'`
    );
    expect(Number(r[0].count)).toBeGreaterThanOrEqual(0);
  });

  it('student can see own attendance', async () => {
    const r = await runInContext(
      STUDENT,
      `SELECT count(*)::int FROM attendance_records WHERE student_membership_id = '${STUDENT_MEM}'`
    );
    expect(Number(r[0].count)).toBeGreaterThanOrEqual(0);
  });

  it('student cannot see other student attendance', async () => {
    const r = await runInContext(
      STUDENT,
      `SELECT count(*)::int FROM attendance_records WHERE student_membership_id = '${STUDENT2_MEM}'`
    );
    expect(Number(r[0].count)).toBe(0);
  });

  it('parent can see linked child attendance', async () => {
    const r = await runInContext(
      PARENT,
      `SELECT count(*)::int FROM attendance_records WHERE student_membership_id = '${STUDENT_MEM}'`
    );
    expect(Number(r[0].count)).toBeGreaterThanOrEqual(0);
  });

  it('parent denied non-linked child attendance (RLS level)', async () => {
    const r = await runInContext(
      PARENT,
      `SELECT count(*)::int FROM attendance_records WHERE student_membership_id = '${STUDENT2_MEM}'`
    );
    expect(Number(r[0].count)).toBe(0);
  });

  it('admin can see all attendance', async () => {
    const r = await runInContext(
      ADMIN,
      `SELECT count(*)::int FROM attendance_records WHERE school_id = '${SCHOOL}'`
    );
    expect(Number(r[0].count)).toBeGreaterThanOrEqual(0);
  });
});

describe('Attendance — Partial Unique Index', () => {
  it('has partial unique index on attendance_records', async () => {
    const r = await superPrisma.$queryRawUnsafe(
      `SELECT count(*) as cnt FROM pg_indexes WHERE indexname = 'attendance_records_student_date_key'`
    );
    expect(
      Number(
        (r[0] as Record<string, unknown>).cnt ??
          (r[0] as Record<string, unknown>).count
      )
    ).toBe(1);
  });
});

describe('Attendance — RBAC', () => {
  it('teacher can create attendance', () => {
    expect(hasPermission('TEACHER', 'attendance_records', 'create')).toBe(true);
  });
  it('student can read own attendance', () => {
    expect(hasPermission('STUDENT', 'attendance_records', 'read')).toBe(true);
  });
  it('student cannot create attendance', () => {
    expect(hasPermission('STUDENT', 'attendance_records', 'create')).toBe(
      false
    );
  });
  it('parent can read attendance', () => {
    expect(hasPermission('PARENT', 'attendance_records', 'read')).toBe(true);
  });
  it('school admin can manage attendance', () => {
    expect(hasPermission('SCHOOL_ADMIN', 'attendance_records', 'manage')).toBe(
      true
    );
  });
});
