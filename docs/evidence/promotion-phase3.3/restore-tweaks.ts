import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../src/generated/prisma/client';
const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});
(async () => {
  const s = await p.section.findMany({
    where: {
      OR: [{ id: 'seed_sec_2627_g06_c' }, { id: 'seed_sec_2627_g04_b' }],
    },
    select: { id: true, status: true, capacity: true },
  });
  console.log('sections verify:', JSON.stringify(s));
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
