import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });

async function main() {
  for (const cls of ['seed_cls_2627_g01', 'seed_cls_2627_g02']) {
    const rows = await p.$queryRawUnsafe<Array<{ mid: string; name: string; roll: string }>>(
      `select m.id as mid, u.name, e.roll_number as roll
       from enrollments e
       join students s on s.id = e.student_id
       join users u on u.id = s.user_id
       join memberships m on m.user_id = s.user_id and m.school_id = e.school_id and m.role = 'STUDENT' and m.status = 'ACTIVE'
       where e.class_id = $1 and e.status = 'ACTIVE'
       order by e.roll_number`,
      cls
    );
    console.log(`${cls}: ${rows.length} students`);
    console.log(JSON.stringify(rows.slice(0, 8), null, 1));
  }
}

main().finally(() => p.$disconnect());
