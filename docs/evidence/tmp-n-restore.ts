import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });
(async () => {
  await p.term.update({ where: { id: 'fixture_term_b1' }, data: { name: 'Fixture Term B1', status: 'ACTIVE' } });
  await p.class.update({ where: { id: 'fixture_cls_b_g01' }, data: { name: 'Grade 1', status: 'ACTIVE', isDeleted: false } });
  await p.class.update({ where: { id: 'fixture_cls_b_g02' }, data: { status: 'ACTIVE', isDeleted: false } });
  await p.section.update({ where: { id: 'fixture_sec_b_g01_a' }, data: { name: 'A', status: 'ACTIVE' } });
  await p.subject.update({ where: { id: 'fixture_sub_b_math' }, data: { name: 'Mathematics', isActive: true } });
  await p.academicYear.update({ where: { id: 'fixture_ay_b' }, data: { name: '2026-2027', status: 'ACTIVE', isActive: false } });
  await p.academicYear.update({ where: { id: 'fixture_ay_b2' }, data: { status: 'ACTIVE', isActive: false } });
  await p.student.update({ where: { id: 'fixture_stu_b1' }, data: { status: 'ACTIVE', isDeleted: false } });
  await p.enrollment.deleteMany({ where: { studentId: 'cmsbvhllo000l1gu8wmee9v77' } });
  await p.student.deleteMany({ where: { id: 'cmsbvhllo000l1gu8wmee9v77' } });
  await p.subjectAssignment.deleteMany({ where: { id: 'cmsbvhr7l000p1gu8hxf77a9u' } });
  await p.section.deleteMany({ where: { id: 'cmsbvhkc4000j1gu8kimbrazz' } });
  await p.term.deleteMany({ where: { id: 'cmsbvhjdz000h1gu8z8w2s7xp' } });
  await p.class.deleteMany({ where: { id: 'cmsbvhia6000f1gu8nirwfaim' } });

  const verify: any = {};
  const [t, c1, c2, s, su, y, y2, st] = await Promise.all([
    p.term.findUnique({ where: { id: 'fixture_term_b1' }, select: { name: true, status: true } }),
    p.class.findUnique({ where: { id: 'fixture_cls_b_g01' }, select: { name: true, status: true, isDeleted: true } }),
    p.class.findUnique({ where: { id: 'fixture_cls_b_g02' }, select: { status: true, isDeleted: true } }),
    p.section.findUnique({ where: { id: 'fixture_sec_b_g01_a' }, select: { name: true, status: true } }),
    p.subject.findUnique({ where: { id: 'fixture_sub_b_math' }, select: { name: true, isActive: true } }),
    p.academicYear.findUnique({ where: { id: 'fixture_ay_b' }, select: { name: true, status: true, isActive: true } }),
    p.academicYear.findUnique({ where: { id: 'fixture_ay_b2' }, select: { status: true, isActive: true } }),
    p.student.findUnique({ where: { id: 'fixture_stu_b1' }, select: { status: true, isDeleted: true } }),
  ]);
  verify.term = t; verify.classG01 = c1; verify.classG02 = c2; verify.section = s; verify.subject = su; verify.ayB = y; verify.ayB2 = y2; verify.student = st;
  const leftovers: any = {};
  leftovers.classN10 = await p.class.count({ where: { id: 'cmsbvhia6000f1gu8nirwfaim' } });
  leftovers.termN10 = await p.term.count({ where: { id: 'cmsbvhjdz000h1gu8z8w2s7xp' } });
  leftovers.sectionN11 = await p.section.count({ where: { id: 'cmsbvhkc4000j1gu8kimbrazz' } });
  leftovers.studentN12 = await p.student.count({ where: { id: 'cmsbvhllo000l1gu8wmee9v77' } });
  leftovers.enrollmentN12 = await p.enrollment.count({ where: { studentId: 'cmsbvhllo000l1gu8wmee9v77' } });
  leftovers.assignmentN13 = await p.subjectAssignment.count({ where: { id: 'cmsbvhr7l000p1gu8hxf77a9u' } });
  console.log('RESTORED:', JSON.stringify(verify));
  console.log('LEFTOVERS:', JSON.stringify(leftovers));
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
