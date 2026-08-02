import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { markAttendance, bulkMarkAttendance, updateAttendanceRecord, getClassAttendance } from '../src/services/attendance/attendance-service';
import { withRls, buildContext, type RequestContext } from '../src/lib/prisma/rls-middleware';

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const p = new PrismaClient({ adapter });

const SCHOOL_A = 'seed_school_ea';
const SCHOOL_B = 'fixture_school_b';
const CLASS_B = 'fixture_cls_b_g01';
const MEM_B = 'fixture_mem_b_stu';
const DATE = new Date('2026-08-01');

const authCtx = {
  userId: 'seed_user_admin',
  email: 'admin@easystem.dev',
  membershipId: 'seed_mem_admin',
  schoolId: SCHOOL_A,
  role: 'SCHOOL_ADMIN',
  schoolStatus: 'ACTIVE',
};
const ctx: RequestContext = buildContext(authCtx.userId, {
  id: authCtx.membershipId,
  schoolId: authCtx.schoolId,
  role: authCtx.role,
});

async function dbCount(label: string) {
  const rows = await p.$queryRawUnsafe<Array<{ school_id: string }>>(
    `select school_id, class_id, student_membership_id, date::text, status
     from attendance_records where class_id = $1 order by created_at`,
    CLASS_B
  );
  console.log(`DB rows for ${CLASS_B} [${label}]: ${rows.length}`);
  return rows;
}

async function main() {
  // 1) remove pre-fix pollution: cross-tenant attendance + its audit rows
  await p.$executeRawUnsafe(`delete from attendance_records where class_id = $1`, CLASS_B);
  await p.$executeRawUnsafe(
    `delete from audit_logs
     where entity = 'attendance_record'
       and (after->>'classId' = $1 or after->>'studentMembershipId' = $2 or record_id = $3)`,
    CLASS_B, MEM_B, 'cmsajv5hxw64f62ai6pibr95y'
  );
  console.log('Pre-fix pollution removed (attendance + audit rows).');

  console.log('\n=== POST-FIX CROSS-TENANT TEST (School A admin acting on School B) ===\n');

  // T1-A: wildcard "*" against foreign classId
  try {
    const res = await bulkMarkAttendance(
      { schoolId: SCHOOL_A, classId: CLASS_B, date: DATE, records: [{ studentMembershipId: '*', status: 'PRESENT' }] },
      authCtx, ctx
    );
    console.log(`T1-A wildcard "*" + foreign classId -> OK, returned ${res.length} records (expected 0)`);
  } catch (e) {
    console.log(`T1-A wildcard "*" + foreign classId -> REJECTED: ${(e as Error).message}`);
  }
  await dbCount('after T1-A');

  // T1-B: explicit foreign membership + foreign classId
  try {
    const res = await bulkMarkAttendance(
      { schoolId: SCHOOL_A, classId: CLASS_B, date: DATE, records: [{ studentMembershipId: MEM_B, status: 'PRESENT' }] },
      authCtx, ctx
    );
    console.log(`T1-B explicit foreign membership -> OK, RETURNED ${res.length} record(s)`);
  } catch (e) {
    console.log(`T1-B explicit foreign membership -> REJECTED: ${(e as Error).message}`);
  }
  await dbCount('after T1-B');

  // T1-C: read path
  try {
    const recs = await getClassAttendance(CLASS_B, DATE, ctx);
    console.log(`T1-C getClassAttendance(foreign class) -> OK, returned ${recs.length} record(s)`);
  } catch (e) {
    console.log(`T1-C getClassAttendance(foreign class) -> REJECTED: ${(e as Error).message}`);
  }

  // T1-D: single markAttendance with foreign membership
  try {
    await markAttendance(
      { schoolId: SCHOOL_A, classId: CLASS_B, studentMembershipId: MEM_B, date: DATE, status: 'LATE' },
      authCtx, ctx
    );
    console.log('T1-D single markAttendance(foreign) -> OK (row written)');
  } catch (e) {
    console.log(`T1-D single markAttendance(foreign) -> REJECTED: ${(e as Error).message}`);
  }
  await dbCount('after T1-D');

  // T1-E: update a record from a foreign class (fresh attempt, any id)
  try {
    await updateAttendanceRecord('does-not-exist-anyway', { status: 'ABSENT' }, authCtx, ctx);
    console.log('T1-E updateAttendanceRecord -> OK (updated)');
  } catch (e) {
    console.log(`T1-E updateAttendanceRecord -> REJECTED: ${(e as Error).message}`);
  }

  // T1-F: direct raw SQL INSERT with foreign school_id inside withRls (defense-in-depth probe)
  try {
    const res = await withRls(ctx, (tx) =>
      tx.$queryRawUnsafe<Array<{ id: string; school_id: string }>>(
        `insert into attendance_records (id, school_id, class_id, student_membership_id, date, status, marked_by_membership_id, created_by, updated_at)
         values ($7::text, $1::text, $2::text, $3::text, $4::date, 'PRESENT'::"AttendanceStatus", $5::text, $6::text, CURRENT_TIMESTAMP)
         returning id, school_id`,
        SCHOOL_B, CLASS_B, MEM_B, '2026-08-01', authCtx.membershipId, authCtx.userId, 'fixture_raw_bypass2'
      )
    );
    console.log(`T1-F direct SQL INSERT with foreign school_id -> OK, INSERTED: ${JSON.stringify(res)}`);
  } catch (e) {
    console.log(`T1-F direct SQL INSERT with foreign school_id -> REJECTED: ${(e as Error).message}`);
  }
  await dbCount('after T1-F (final)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
