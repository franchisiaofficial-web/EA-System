import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });
(async () => {
  await p.term.deleteMany({ where: { id: 'fixture_term_b1' } });
  await p.crudDemo.deleteMany({ where: { id: 'fixture_crud_b1' } });
  await p.class.deleteMany({ where: { id: 'fixture_cls_b_g02' } });
  await p.academicYear.deleteMany({ where: { id: 'fixture_ay_b2' } });

  const verify: any = {};
  verify.termGone = await p.term.count({ where: { id: 'fixture_term_b1' } });
  verify.crudGone = await p.crudDemo.count({ where: { id: 'fixture_crud_b1' } });
  verify.clsG02Gone = await p.class.count({ where: { id: 'fixture_cls_b_g02' } });
  verify.ayB2Gone = await p.academicYear.count({ where: { id: 'fixture_ay_b2' } });

  const [cls, sec, sub, ay, stu, term, crud] = await Promise.all([
    p.class.findUnique({ where: { id: 'fixture_cls_b_g01' }, select: { name: true, status: true, isDeleted: true } }),
    p.section.findUnique({ where: { id: 'fixture_sec_b_g01_a' }, select: { name: true, status: true } }),
    p.subject.findUnique({ where: { id: 'fixture_sub_b_math' }, select: { name: true, isActive: true } }),
    p.academicYear.findUnique({ where: { id: 'fixture_ay_b' }, select: { name: true, status: true, isActive: true } }),
    p.student.findUnique({ where: { id: 'fixture_stu_b1' }, select: { status: true, isDeleted: true } }),
    p.term.count({ where: { schoolId: 'fixture_school_b' } }),
    p.crudDemo.count({ where: { schoolId: 'fixture_school_b' } }),
  ]);
  verify.schoolB = { cls, sec, sub, ay, stu, termCount: term, crudCount: crud };

  verify.auditEntries = await p.auditLog.count({
    where: { schoolId: 'seed_school_ea', entity: { in: ['terms', 'classes', 'sections', 'subjects', 'academic_years', 'students'] }, createdAt: { gte: new Date('2026-08-02T13:40:00Z') } },
  });
  console.log('CLEANUP:', JSON.stringify(verify));
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
