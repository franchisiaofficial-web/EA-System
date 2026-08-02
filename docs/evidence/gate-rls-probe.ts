import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const p = new PrismaClient({ adapter });

async function main() {
  const out: Record<string, unknown> = {};

  out.currentUser = await p.$queryRawUnsafe(
    `select current_user, current_setting('app.current_school_id', true) as school_setting`
  );

  out.rolePrivs = await p.$queryRawUnsafe(
    `select usename, usesuper, usebypassrls from pg_user where usename = current_user`
  );

  out.rlsStatus = await p.$queryRawUnsafe(
    `select c.relname, c.relrowsecurity, c.relforcerowsecurity
     from pg_class c
     where c.relname in ('attendance_records', 'memberships', 'students', 'enrollments', 'classes', 'audit_logs')`
  );

  out.policyCount = await p.$queryRawUnsafe(
    `select tablename, count(*) as policies
     from pg_policies
     where tablename in ('attendance_records', 'memberships', 'students', 'enrollments', 'classes', 'audit_logs')
     group by tablename order by tablename`
  );

  out.tableOwner = await p.$queryRawUnsafe(
    `select t.tablename, tableowner
     from pg_tables t
     where t.tablename in ('attendance_records', 'memberships', 'students', 'enrollments', 'classes', 'audit_logs')`
  );

  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
