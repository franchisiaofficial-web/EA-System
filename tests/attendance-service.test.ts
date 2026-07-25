/**
 * Sprint 2 — Production function tests for attendance service
 * Exercises markAttendance, bulkMarkAttendance against the real database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { AuthContext } from '../src/lib/auth/context';
import type { RequestContext } from '../src/lib/prisma/rls-middleware';
import {
  markAttendance,
  bulkMarkAttendance,
  calculateAttendancePercentage,
} from '../src/services/attendance/attendance-service';

const TEST_DB = process.env.TEST_DATABASE_URL;
if (!TEST_DB) throw new Error('TEST_DATABASE_URL is not set');

const superPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: TEST_DB }),
});

const SCHOOL = 's2t-sch';
const AY = 's2t-ay';
const SECTION = 's2t-sec';
const CLASS = 's2t-cls';
const ADMIN = 's2t-adm';
const TEACHER = 's2t-tchr';
const STUDENT = 's2t-stu';
const STUDENT2 = 's2t-stu2';
const ADMIN_MEM = 's2t-adm-m';
const TEACHER_MEM = 's2t-tchr-m';
const STUDENT_MEM = 's2t-stu-m';
const STUDENT2_MEM = 's2t-stu2-m';
const ENROLLMENT = 's2t-enr';
const ENROLLMENT2 = 's2t-enr2';

// studentMembershipId = membership ID (FK to memberships), not enrollment ID
const authCtx: AuthContext = {
  userId: ADMIN,
  email: 's2t-adm@t.com',
  membershipId: TEACHER_MEM,
  schoolId: SCHOOL,
  role: 'TEACHER',
  schoolStatus: 'ACTIVE',
};

const ctx: RequestContext = {
  userId: ADMIN,
  schoolId: SCHOOL,
  membershipId: TEACHER_MEM,
  role: 'TEACHER',
};

function getDateOffset(daysOffset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(0, 0, 0, 0);
  return d;
}

beforeAll(async () => {
  const now = new Date();

  await superPrisma.$executeRawUnsafe(
    `INSERT INTO schools (id, name, slug, status, timezone, currency, created_at, updated_at)
     VALUES ('${SCHOOL}', 'S2T School', 's2t-slug', 'ACTIVE', 'Asia/Kolkata', 'INR', '${now.toISOString()}', '${now.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );

  await superPrisma.$executeRawUnsafe(
    `INSERT INTO users (id, name, email, email_verified, status, created_at, updated_at)
     VALUES
       ('${ADMIN}', 'S2T Admin', 's2t-adm@t.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}'),
       ('${TEACHER}', 'S2T Teacher', 's2t-tchr@t.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}'),
       ('${STUDENT}', 'S2T Student', 's2t-stu@t.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}'),
       ('${STUDENT2}', 'S2T Student2', 's2t-stu2@t.com', true, 'active', '${now.toISOString()}', '${now.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );

  await superPrisma.$executeRawUnsafe(
    `INSERT INTO memberships (id, school_id, user_id, role, status, joined_at, created_at, updated_at)
     VALUES
       ('${ADMIN_MEM}', '${SCHOOL}', '${ADMIN}', 'SCHOOL_ADMIN', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}'),
       ('${TEACHER_MEM}', '${SCHOOL}', '${TEACHER}', 'TEACHER', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}'),
       ('${STUDENT_MEM}', '${SCHOOL}', '${STUDENT}', 'STUDENT', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}'),
       ('${STUDENT2_MEM}', '${SCHOOL}', '${STUDENT2}', 'STUDENT', 'ACTIVE', '${now.toISOString()}', '${now.toISOString()}', '${now.toISOString()}')
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
     VALUES ('${CLASS}', '${SCHOOL}', '${AY}', '${SECTION}', 'S2T Class', '5', '${now.toISOString()}', '${now.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );

  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

  // Enroll STUDENT_MEM and STUDENT2_MEM
  await superPrisma.$executeRawUnsafe(
    `INSERT INTO class_enrollments (id, school_id, class_id, student_membership_id, joined_at, created_at, updated_at)
     VALUES
       ('${ENROLLMENT}', '${SCHOOL}', '${CLASS}', '${STUDENT_MEM}', '${tenDaysAgo.toISOString()}', '${tenDaysAgo.toISOString()}', '${tenDaysAgo.toISOString()}'),
       ('${ENROLLMENT2}', '${SCHOOL}', '${CLASS}', '${STUDENT2_MEM}', '${tenDaysAgo.toISOString()}', '${tenDaysAgo.toISOString()}', '${tenDaysAgo.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );

  await superPrisma.$executeRawUnsafe(
    `INSERT INTO class_assignments (id, school_id, class_id, teacher_membership_id, role, created_at, updated_at)
     VALUES ('s2t-asgn', '${SCHOOL}', '${CLASS}', '${TEACHER_MEM}', 'PRIMARY', '${now.toISOString()}', '${now.toISOString()}')
     ON CONFLICT (id) DO NOTHING`
  );
});

afterAll(async () => {
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM attendance_records WHERE id LIKE 's2t-%'`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM class_enrollments WHERE id IN ('${ENROLLMENT}','${ENROLLMENT2}')`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM class_assignments WHERE id = 's2t-asgn'`
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
    `DELETE FROM memberships WHERE id IN ('${ADMIN_MEM}','${TEACHER_MEM}','${STUDENT_MEM}','${STUDENT2_MEM}')`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM users WHERE id IN ('${ADMIN}','${TEACHER}','${STUDENT}','${STUDENT2}')`
  );
  await superPrisma.$executeRawUnsafe(
    `DELETE FROM schools WHERE id = '${SCHOOL}'`
  );
  await superPrisma.$disconnect();
});

// ============================================================
// markAttendance — duplicate rejection
// ============================================================
describe('markAttendance — duplicate rejection', () => {
  it('rejects duplicate attendance via production function', async () => {
    const today = getDateOffset(0);

    const first = await markAttendance(
      {
        schoolId: SCHOOL,
        classId: CLASS,
        studentMembershipId: STUDENT_MEM,
        date: today,
        status: 'PRESENT',
      },
      authCtx,
      ctx
    );
    expect(first.id).toBeTruthy();

    await expect(
      markAttendance(
        {
          schoolId: SCHOOL,
          classId: CLASS,
          studentMembershipId: STUDENT_MEM,
          date: today,
          status: 'LATE',
        },
        authCtx,
        ctx
      )
    ).rejects.toThrow('Attendance already recorded');

    await superPrisma.$executeRawUnsafe(
      `DELETE FROM attendance_records WHERE id = '${first.id}'`
    );
  });
});

// ============================================================
// markAttendance — date boundaries
// ============================================================
describe('markAttendance — date boundaries', () => {
  it('rejects attendance 4 days in the past', async () => {
    await expect(
      markAttendance(
        {
          schoolId: SCHOOL,
          classId: CLASS,
          studentMembershipId: STUDENT_MEM,
          date: getDateOffset(-4),
          status: 'PRESENT',
        },
        authCtx,
        ctx
      )
    ).rejects.toThrow('may only be marked for today or up to');
  });

  it('rejects attendance for tomorrow', async () => {
    await expect(
      markAttendance(
        {
          schoolId: SCHOOL,
          classId: CLASS,
          studentMembershipId: STUDENT_MEM,
          date: getDateOffset(+1),
          status: 'PRESENT',
        },
        authCtx,
        ctx
      )
    ).rejects.toThrow('may only be marked for today or up to');
  });

  it('allows attendance exactly 3 days in the past (inclusive boundary)', async () => {
    const r = await markAttendance(
      {
        schoolId: SCHOOL,
        classId: CLASS,
        studentMembershipId: STUDENT_MEM,
        date: getDateOffset(-3),
        status: 'PRESENT',
      },
      authCtx,
      ctx
    );
    expect(r.id).toBeTruthy();
    await superPrisma.$executeRawUnsafe(
      `DELETE FROM attendance_records WHERE id = '${r.id}'`
    );
  });

  it('allows attendance for today', async () => {
    const r = await markAttendance(
      {
        schoolId: SCHOOL,
        classId: CLASS,
        studentMembershipId: STUDENT_MEM,
        date: getDateOffset(0),
        status: 'PRESENT',
      },
      authCtx,
      ctx
    );
    expect(r.id).toBeTruthy();
    await superPrisma.$executeRawUnsafe(
      `DELETE FROM attendance_records WHERE id = '${r.id}'`
    );
  });
});

// ============================================================
// bulkMarkAttendance — atomic rollback
// ============================================================
describe('bulkMarkAttendance — atomic rollback', () => {
  it('rolls back all records when one is invalid', async () => {
    const today = getDateOffset(0);

    await expect(
      bulkMarkAttendance(
        {
          schoolId: SCHOOL,
          classId: CLASS,
          date: today,
          records: [
            { studentMembershipId: STUDENT_MEM, status: 'PRESENT' as const },
            { studentMembershipId: STUDENT2_MEM, status: 'PRESENT' as const },
            {
              studentMembershipId: 's2t-nonexistent',
              status: 'PRESENT' as const,
            },
            { studentMembershipId: STUDENT_MEM, status: 'LATE' as const },
            { studentMembershipId: STUDENT2_MEM, status: 'LATE' as const },
          ],
        },
        authCtx,
        ctx
      )
    ).rejects.toThrow();

    const remaining = await superPrisma.$queryRawUnsafe(
      `SELECT count(*)::int as cnt FROM attendance_records WHERE school_id = '${SCHOOL}' AND class_id = '${CLASS}' AND date = '${today.toISOString().split('T')[0]}'`
    );
    expect(Number((remaining as Record<string, unknown>[])[0].cnt)).toBe(0);
  });
});

// ============================================================
// WITHDRAWN enrollment eligibility
// ============================================================
describe('Historical enrollment — WITHDRAWN', () => {
  beforeAll(async () => {
    const twoDaysAgo = getDateOffset(-2);
    await superPrisma.$executeRawUnsafe(
      `UPDATE class_enrollments SET status = 'WITHDRAWN', left_at = '${twoDaysAgo.toISOString()}', is_deleted = true WHERE id = '${ENROLLMENT2}'`
    );
  });

  it('allows attendance within enrollment period for WITHDRAWN student', async () => {
    const enrollment = await superPrisma.$queryRawUnsafe(
      `SELECT id, status, joined_at, left_at, is_deleted FROM class_enrollments WHERE id = '${ENROLLMENT2}'`
    );
    expect((enrollment as Record<string, unknown>[])[0].status).toBe(
      'WITHDRAWN'
    );

    const r = await markAttendance(
      {
        schoolId: SCHOOL,
        classId: CLASS,
        studentMembershipId: STUDENT2_MEM,
        date: getDateOffset(-3),
        status: 'PRESENT',
      },
      authCtx,
      ctx
    );
    expect(r.id).toBeTruthy();
    await superPrisma.$executeRawUnsafe(
      `DELETE FROM attendance_records WHERE id = '${r.id}'`
    );
  });

  it('rejects attendance today (after leftAt) for WITHDRAWN student', async () => {
    await expect(
      markAttendance(
        {
          schoolId: SCHOOL,
          classId: CLASS,
          studentMembershipId: STUDENT2_MEM,
          date: getDateOffset(0),
          status: 'PRESENT',
        },
        authCtx,
        ctx
      )
    ).rejects.toThrow('not enrolled');
  });
});

// ============================================================
// TRANSFERRED enrollment eligibility (confirm fix)
// ============================================================
describe('Historical enrollment — TRANSFERRED', () => {
  beforeAll(async () => {
    const twoDaysAgo = getDateOffset(-2);
    await superPrisma.$executeRawUnsafe(
      `UPDATE class_enrollments SET status = 'TRANSFERRED', left_at = '${twoDaysAgo.toISOString()}', is_deleted = true WHERE id = '${ENROLLMENT}'`
    );
  });

  it('allows attendance within enrollment period for TRANSFERRED student', async () => {
    const enrollment = await superPrisma.$queryRawUnsafe(
      `SELECT id, status, joined_at, left_at, is_deleted FROM class_enrollments WHERE id = '${ENROLLMENT}'`
    );
    expect((enrollment as Record<string, unknown>[])[0].status).toBe(
      'TRANSFERRED'
    );

    const r = await markAttendance(
      {
        schoolId: SCHOOL,
        classId: CLASS,
        studentMembershipId: STUDENT_MEM,
        date: getDateOffset(-3),
        status: 'PRESENT',
      },
      authCtx,
      ctx
    );
    expect(r.id).toBeTruthy();
    await superPrisma.$executeRawUnsafe(
      `DELETE FROM attendance_records WHERE id = '${r.id}'`
    );
  });

  it('rejects attendance today (after leftAt) for TRANSFERRED student', async () => {
    await expect(
      markAttendance(
        {
          schoolId: SCHOOL,
          classId: CLASS,
          studentMembershipId: STUDENT_MEM,
          date: getDateOffset(0),
          status: 'PRESENT',
        },
        authCtx,
        ctx
      )
    ).rejects.toThrow('not enrolled');
  });
});

// ============================================================
// Pure function regression
// ============================================================
describe('calculateAttendancePercentage (regression)', () => {
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
});
