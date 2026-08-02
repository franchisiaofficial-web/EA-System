import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { bulkMarkAttendance, AttendanceConflictError } from '../src/services/attendance/attendance-service';
import { buildContext, type RequestContext } from '../src/lib/prisma/rls-middleware';
import { isCuid } from '@paralleldrive/cuid2';

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const p = new PrismaClient({ adapter });

const SCHOOL_A = 'seed_school_ea';
const CLASS_G1 = 'seed_cls_2627_g01';
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

async function main() {
  const mids: Array<{ mid: string }> = await p.$queryRawUnsafe(
    `select m.id as mid
     from enrollments e
     join students s on s.id = e.student_id
     join memberships m on m.user_id = s.user_id and m.school_id = e.school_id and m.role = 'STUDENT' and m.status = 'ACTIVE'
     where e.class_id = $1 and e.status = 'ACTIVE'
     order by e.roll_number limit 4`,
    CLASS_G1
  );
  const validMids = mids.map((r) => r.mid);
  console.log('4 valid School A mids (Grade 1):', validMids);

  const invalidMid = 'fixture_mem_b_stu';
  const dateStr = '2026-08-01';

  const qCount = async (sql: string, ...args: unknown[]) => {
    const rows = await p.$queryRawUnsafe<Array<{ n: bigint }>>(sql, ...args);
    return Number(rows[0].n);
  };
  const attendanceBefore = await qCount(
    `select count(*) as n from attendance_records where class_id = $1 and date = $2::date and is_deleted = false`, CLASS_G1, dateStr
  );
  const auditBefore = await qCount(
    `select count(*) as n from audit_logs where entity = 'attendance_record' and action = 'bulk_create'`
  );
  console.log(`\nBaseline: attendance rows for ${CLASS_G1} ${dateStr} = ${attendanceBefore}; bulk_create audit rows = ${auditBefore}`);

  // ── TASK 4: rollback (4 valid + 1 invalid in ONE request) ──
  console.log('\n=== TASK 4 — ROLLBACK: 4 valid + 1 invalid ===');
  try {
    await bulkMarkAttendance(
      {
        schoolId: SCHOOL_A,
        classId: CLASS_G1,
        date: DATE,
        records: [
          ...validMids.map((mid) => ({ studentMembershipId: mid, status: 'PRESENT' as const })),
          { studentMembershipId: invalidMid, status: 'PRESENT' },
        ],
      },
      authCtx, ctx
    );
    console.log('UNEXPECTED: request succeeded');
  } catch (e) {
    console.log(`Request rejected: ${(e as Error).message}`);
  }
  const attendanceAfterRollback = await qCount(
    `select count(*) as n from attendance_records where class_id = $1 and date = $2::date and is_deleted = false`, CLASS_G1, dateStr
  );
  const auditAfterRollback = await qCount(
    `select count(*) as n from audit_logs where entity = 'attendance_record' and action = 'bulk_create'`
  );
  console.log(`SQL: select count(*) from attendance_records where class_id='${CLASS_G1}' and date='${dateStr}';`);
  console.log(`  before=${attendanceBefore}  after rollback=${attendanceAfterRollback}  -> inserted rows = ${attendanceAfterRollback - attendanceBefore}`);
  console.log(`SQL: select count(*) from audit_logs where entity='attendance_record' and action='bulk_create';`);
  console.log(`  before=${auditBefore}  after rollback=${auditAfterRollback}  -> audit rows = ${auditAfterRollback - auditBefore}`);
  console.log(`ROLLBACK VERIFIED: ${attendanceAfterRollback === attendanceBefore && auditAfterRollback === auditBefore ? 'YES (0 rows, 0 audit, no partial writes)' : 'NO'}`);

  // ── TASK 3: audit verification on a successful request ──
  console.log('\n=== TASK 3 — AUDIT: successful request ===');
  const res = await bulkMarkAttendance(
    {
      schoolId: SCHOOL_A,
      classId: CLASS_G1,
      date: DATE,
      records: validMids.map((mid) => ({ studentMembershipId: mid, status: 'PRESENT' })),
    },
    authCtx, ctx
  );
  console.log(`Success: ${res.length} records; ids = ${res.map((r) => r.id).join(', ')}`);
  console.log(`All ids official cuid2: ${res.every((r) => isCuid(r.id))}`);

  const audits = await p.$queryRawUnsafe<Array<{ id: string; user_id: string; school_id: string; action: string; entity: string; record_id: string; after: Record<string, unknown> }>>(
    `select id, user_id, school_id, action, entity, record_id, after
     from audit_logs
     where entity = 'attendance_record' and action = 'bulk_create'
     order by created_at desc limit 3`
  );
  const latest = audits[0];
  console.log('Audit rows written by successful bulk_create (latest first):');
  for (const a of audits) console.log(`  ${a.id} | action=${a.action} entity=${a.entity} actor=${a.user_id} school=${a.school_id} record_id=${a.record_id} after=${JSON.stringify(a.after)}`);
  const totalAuditAfter = await qCount(`select count(*) as n from audit_logs where entity = 'attendance_record' and action = 'bulk_create'`);
  console.log(`Total bulk_create audit rows before=${auditBefore} after=${totalAuditAfter} -> delta = ${totalAuditAfter - auditBefore}`);
  console.log(`EXACTLY ONE audit row for the successful request: ${totalAuditAfter - auditBefore === 1 ? 'YES' : 'NO'}`);
  const check =
    latest &&
    latest.user_id === 'seed_user_admin' &&
    latest.school_id === SCHOOL_A &&
    latest.entity === 'attendance_record' &&
    latest.action === 'bulk_create' &&
    (latest.after as Record<string, unknown>).count === res.length &&
    (latest.after as Record<string, unknown>).classId === CLASS_G1;
  console.log(`Audit fields correct (actor, school, count, classId): ${check ? 'YES' : 'NO'}`);
  console.log(`recordId == first inserted attendance id: ${latest.record_id === res[0].id ? 'YES' : 'NO'}`);

  // ── duplicate protection (service level) ──
  console.log('\n=== Duplicate protection (service level) ===');
  try {
    await bulkMarkAttendance(
      {
        schoolId: SCHOOL_A,
        classId: CLASS_G1,
        date: DATE,
        records: validMids.map((mid) => ({ studentMembershipId: mid, status: 'ABSENT' })),
      },
      authCtx, ctx
    );
    console.log('UNEXPECTED: duplicate succeeded');
  } catch (e) {
    console.log(`Duplicate rejected: ${(e as Error).name}: ${(e as Error).message}`);
  }
  const attendanceFinal = await qCount(
    `select count(*) as n from attendance_records where class_id = $1 and date = $2::date and is_deleted = false`, CLASS_G1, dateStr
  );
  console.log(`Attendance rows unchanged after duplicate attempt: ${attendanceFinal === res.length ? 'YES' : 'NO'} (${attendanceFinal})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
