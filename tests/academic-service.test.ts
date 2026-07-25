/**
 * Academic service layer tests — transferStudent atomicity
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { AuthContext } from '../src/lib/auth/context';
import type { RequestContext } from '../src/lib/prisma/rls-middleware';
import { transferStudent } from '../src/services/academic/academic-service';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (!TEST_DB) throw new Error('TEST_DATABASE_URL is not set');

const superPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: TEST_DB }),
});

const SCHOOL = 'atr-sch';
const AY = 'atr-ay';
const SECTION = 'atr-sec';
const CLASS_A = 'atr-cls-a';
const CLASS_B = 'atr-cls-b';
const ADMIN = 'atr-adm';
const TEACHER = 'atr-tchr';
const STUDENT = 'atr-stu';
const ADMIN_MEM = 'atr-adm-m';
const TEACHER_MEM = 'atr-tchr-m';
const STUDENT_MEM = 'atr-stu-m';
const ENROLLMENT_A = 'atr-enr-a';

const authCtx: AuthContext = {
  userId: ADMIN,
  email: 'atr-adm@t.com',
  membershipId: ADMIN_MEM,
  schoolId: SCHOOL,
  role: 'SCHOOL_ADMIN',
  schoolStatus: 'ACTIVE',
};
const ctx: RequestContext = {
  userId: ADMIN,
  schoolId: SCHOOL,
  membershipId: ADMIN_MEM,
  role: 'SCHOOL_ADMIN',
};

beforeAll(async () => {
  const now = new Date();
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO schools (id, name, slug, status, timezone, currency, created_at, updated_at)
     VALUES ('${SCHOOL}', 'ACR School', 'atr-slug', 'ACTIVE', 'UTC', 'USD', '${now.toISOString()}', '${now.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO users (id, name, email, email_verified, status, created_at, updated_at)
     VALUES ('${ADMIN}', 'Admin', 'atr-adm@t.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}'),
            ('${TEACHER}', 'Teacher', 'atr-tchr@t.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}'),
            ('${STUDENT}', 'Student', 'atr-stu@t.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO memberships (id, school_id, user_id, role, status, joined_at, created_at, updated_at)
     VALUES ('${ADMIN_MEM}', '${SCHOOL}', '${ADMIN}', 'SCHOOL_ADMIN', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}'),
            ('${TEACHER_MEM}', '${SCHOOL}', '${TEACHER}', 'TEACHER', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}'),
            ('${STUDENT_MEM}', '${SCHOOL}', '${STUDENT}', 'STUDENT', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_active, created_at, updated_at)
     VALUES ('${AY}', '${SCHOOL}', '2025', '2025-04-01', '2026-03-31', true, '${now.toISOString()}', '${now.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO sections (id, school_id, name, created_at, updated_at)
     VALUES ('${SECTION}', '${SCHOOL}', 'A', '${now.toISOString()}', '${now.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO classes (id, school_id, academic_year_id, section_id, name, grade_level, created_at, updated_at)
     VALUES ('${CLASS_A}', '${SCHOOL}', '${AY}', '${SECTION}', 'Grade 5A', '5', '${now.toISOString()}', '${now.toISOString()}'),
            ('${CLASS_B}', '${SCHOOL}', '${AY}', '${SECTION}', 'Grade 5B', '5', '${now.toISOString()}', '${now.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );
  // Enroll student in CLASS_A
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO class_enrollments (id, school_id, class_id, student_membership_id, joined_at, created_at, updated_at)
     VALUES ('${ENROLLMENT_A}', '${SCHOOL}', '${CLASS_A}', '${STUDENT_MEM}', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );
});

afterAll(async () => {
  // transferStudent creates a new enrollment (auto-generated ID), clean by membership
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM class_enrollments WHERE student_membership_id = '${STUDENT_MEM}'`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM classes WHERE id IN ('${CLASS_A}','${CLASS_B}')`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM sections WHERE id = '${SECTION}'`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM academic_years WHERE id = '${AY}'`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM memberships WHERE id IN ('${ADMIN_MEM}','${TEACHER_MEM}','${STUDENT_MEM}')`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM users WHERE id IN ('${ADMIN}','${TEACHER}','${STUDENT}')`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM schools WHERE id = '${SCHOOL}'`
  );
  await superPrisma.$disconnect();
});

describe('transferStudent — atomicity', () => {
  it('closes old enrollment and creates new enrollment atomically', async () => {
    // Capture state BEFORE transfer
    const before = await superPrisma.$queryRawUnsafe(
      `SELECT id, class_id, status, is_deleted, joined_at, left_at
       FROM class_enrollments WHERE student_membership_id = '${STUDENT_MEM}'`
    );
    const beforeRows = before as Record<string, unknown>[];
    expect(beforeRows.length).toBe(1);
    expect(beforeRows[0].status).toBe('ACTIVE');
    expect(beforeRows[0].is_deleted).toBe(false);
    expect(beforeRows[0].class_id).toBe(CLASS_A);
    expect(beforeRows[0].left_at).toBeNull();

    // Perform transfer via production function
    const newEnrollment = await transferStudent(
      ENROLLMENT_A,
      CLASS_B,
      authCtx,
      ctx
    );
    expect(newEnrollment.id).toBeTruthy();
    expect(newEnrollment.classId).toBe(CLASS_B);
    expect(newEnrollment.status).toBe('ACTIVE');
    expect(newEnrollment.studentMembershipId).toBe(STUDENT_MEM);

    // Verify OLD enrollment: closed properly
    const oldEnrollment = await superPrisma.$queryRawUnsafe(
      `SELECT id, class_id, status, is_deleted, left_at, joined_at
       FROM class_enrollments WHERE id = '${ENROLLMENT_A}'`
    );
    const oldRow = (oldEnrollment as Record<string, unknown>[])[0];
    expect(oldRow.status).toBe('TRANSFERRED');
    expect(oldRow.is_deleted).toBe(true);
    expect(oldRow.left_at).not.toBeNull();
    expect(oldRow.class_id).toBe(CLASS_A);

    // Verify NEW enrollment: active in target class
    const newRow = await superPrisma.$queryRawUnsafe(
      `SELECT id, class_id, status, is_deleted, joined_at, left_at
       FROM class_enrollments WHERE id = '${newEnrollment.id}'`
    );
    const nr = (newRow as Record<string, unknown>[])[0];
    expect(nr.class_id).toBe(CLASS_B);
    expect(nr.status).toBe('ACTIVE');
    expect(nr.is_deleted).toBe(false);
    expect(nr.left_at).toBeNull();

    // Verify historical record preserved (old enrollment's joined_at unchanged)
    const oldJoinedAt = beforeRows[0].joined_at;
    expect(oldRow.joined_at).toEqual(oldJoinedAt);

    // Verify exactly 2 enrollment records exist for this student
    const all = await superPrisma.$queryRawUnsafe(
      `SELECT count(*)::int as cnt FROM class_enrollments WHERE student_membership_id = '${STUDENT_MEM}'`
    );
    expect(Number((all as Record<string, unknown>[])[0].cnt)).toBe(2);
  });

  it('rejects transfer to non-existent class (no partial state)', async () => {
    // Enroll a fresh student in CLASS_A for this test
    const now = new Date();
    await superPrisma.$executeRawUnsafe(
      `INSERT INTO class_enrollments (id, school_id, class_id, student_membership_id, joined_at, created_at, updated_at)
       VALUES ('atr-enr-fail', '${SCHOOL}', '${CLASS_A}', '${TEACHER_MEM}', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}')
       ON CONFLICT (id) DO NOTHING`
    );

    // Attempt transfer to non-existent class
    await expect(
      transferStudent('atr-enr-fail', 'atr-nonexistent-class', authCtx, ctx)
    ).rejects.toThrow('Target class not found');

    // Verify original enrollment is UNCHANGED (no partial state)
    const enrollment = await superPrisma.$queryRawUnsafe(
      `SELECT id, class_id, status, is_deleted, left_at
       FROM class_enrollments WHERE id = 'atr-enr-fail'`
    );
    const row = (enrollment as Record<string, unknown>[])[0];
    expect(row.class_id).toBe(CLASS_A);
    expect(row.status).toBe('ACTIVE');
    expect(row.is_deleted).toBe(false);
    expect(row.left_at).toBeNull();

    // Clean up
    await superPrisma.$executeRawUnsafe(
      `DELETE FROM class_enrollments WHERE id = 'atr-enr-fail'`
    );
  });
});
