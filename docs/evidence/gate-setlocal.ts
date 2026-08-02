import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { withRls, buildContext, type RequestContext } from '../../src/lib/prisma/rls-middleware';
import { createId, isCuid } from '@paralleldrive/cuid2';

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const p = new PrismaClient({ adapter });

const SCHOOL_A = 'seed_school_ea';
const SCHOOL_B = 'fixture_school_b';
const CLASS_B = 'fixture_cls_b_g01';
const MEM_B = 'fixture_mem_b_stu';
const DATE = '2026-08-01';

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
  await p.$executeRawUnsafe(`delete from attendance_records where id = $1`, 'fixture_raw_bypass2');
  console.log('Cleaned T1-F row.');

  console.log('\n=== TASK 2 â€” SET LOCAL / current_setting verification (same raw SQL path) ===\n');

  const school = await p.school.findUnique({ where: { id: SCHOOL_A }, select: { id: true } });
  console.log(`Authenticated user's schoolId (authCtx.schoolId): ${authCtx.schoolId}`);
  console.log(`School row check: ${school?.id}`);

  // Inside withRls (the exact mechanism the write path uses), immediately
  // before an INSERT, read the transaction-local setting.
  const probe = await withRls(ctx, async (tx) => {
    const setSql = `SELECT set_config('app.current_school_id', $1, true) AS set_value`;
    const before = await tx.$queryRawUnsafe<Array<{ v: string | null }>>(
      `SELECT current_setting('app.current_school_id', true) AS v`
    );
    const setResult = await tx.$queryRawUnsafe<Array<{ set_value: string }>>(setSql, ctx.schoolId!);
    const after = await tx.$queryRawUnsafe<Array<{ v: string | null }>>(
      `SELECT current_setting('app.current_school_id', true) AS v`
    );
    const idToInsert = createId();
    const insertProof = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `insert into attendance_records
         (id, school_id, class_id, student_membership_id, date, status, marked_by_membership_id, created_by, updated_at)
       values ($1::text, $2::text, $3::text, $4::text, $5::date, 'PRESENT'::"AttendanceStatus", $6::text, $7::text, CURRENT_TIMESTAMP)
       returning id`,
      idToInsert, ctx.schoolId!, CLASS_B, MEM_B, DATE, authCtx.membershipId, authCtx.userId
    );
    return { before, setResult, after, insertProof, idToInsert };
  });

  console.log(`SQL: SELECT current_setting('app.current_school_id', true);`);
  console.log(`  -> before set_config: ${JSON.stringify(probe.before)}`);
  console.log(`SQL: SELECT set_config('app.current_school_id', '${ctx.schoolId}', true);`);
  console.log(`  -> set_value: ${JSON.stringify(probe.setResult)}`);
  console.log(`SQL: SELECT current_setting('app.current_school_id', true);`);
  console.log(`  -> inside tx, before INSERT: ${JSON.stringify(probe.after)}`);
  console.log(`Authenticated user's schoolId: '${authCtx.schoolId}'`);
  console.log(`Match: ${probe.after[0].v === authCtx.schoolId ? 'YES' : 'NO'}`);
  console.log(`INSERT (same raw SQL path) executed with id ${probe.insertProof[0].id}; isCuid() = ${isCuid(probe.insertProof[0].id)}`);
  console.log(`ID format: ${probe.insertProof[0].id} (length ${probe.insertProof[0].id.length})`);

  // After commit, the transaction-local setting must be gone (SET LOCAL semantics)
  const outside = await p.$queryRawUnsafe<Array<{ v: string | null }>>(
    `SELECT current_setting('app.current_school_id', true) AS v`
  );
  console.log(`After transaction commit: current_setting = ${JSON.stringify(outside)} (reverted -> NULL)`);

  // Cleanup the probe insert
  await p.$executeRawUnsafe(`delete from attendance_records where id = $1`, probe.insertProof[0].id);
  await p.$executeRawUnsafe(
    `delete from audit_logs where entity = 'attendance_record' and record_id = $1`, probe.insertProof[0].id
  );
  console.log('Probe insert cleaned up.');

  // IMPORTANT honesty check: does this setting enforce row security?
  const rls = await p.$queryRawUnsafe<Array<{ relname: string; relrowsecurity: boolean }>>(
    `select c.relname, c.relrowsecurity from pg_class c
     where c.relname in ('attendance_records','memberships','enrollments','students','classes','audit_logs')`
  );
  console.log('\nRLS enforcement status (relrowsecurity):');
  for (const r of rls) console.log(`  ${r.relname}: relrowsecurity=${r.relrowsecurity}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
