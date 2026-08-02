import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });
(async () => {
  const y1 = 'cmsbw8xne000r1gu83qyn9gva';
  const c1 = 'cmsbw8yzl000t1gu8rwwnszht';
  const t1 = 'cmsbw9093000v1gu8qb699prb';
  const s1 = 'cmsbw91fr000x1gu8t99omsha';
  const st1 = 'cmsbw92jl000z1gu858rizr93';
  const c2 = 'cmsbw9f10001a1gu852rrse5h';
  const y2 = 'cmsbw9ich001e1gu8gd7qrcvf';
  const sub1 = 'cmsbw9ofj001k1gu8vl5m09wy';
  const ass1 = 'cmsbw9s7z001o1gu8mxu1h14p';

  await p.subjectAssignment.deleteMany({ where: { id: ass1 } });
  await p.subjectAssignment.deleteMany({ where: { OR: [{ academicYearId: y1 }, { classId: c1 }, { classId: c2 }, { sectionId: s1 }] } });
  await p.enrollment.deleteMany({ where: { studentId: st1 } });
  await p.term.deleteMany({ where: { id: t1 } });
  await p.section.deleteMany({ where: { id: s1 } });
  await p.student.deleteMany({ where: { id: st1 } });
  await p.class.deleteMany({ where: { id: { in: [c1, c2] } } });
  await p.subject.deleteMany({ where: { id: sub1 } });
  await p.academicYear.deleteMany({ where: { id: { in: [y1, y2] } } });

  const verify: any = {};
  verify.pcRowsGone = {
    y1: await p.academicYear.count({ where: { id: y1 } }),
    y2: await p.academicYear.count({ where: { id: y2 } }),
    c1: await p.class.count({ where: { id: c1 } }),
    c2: await p.class.count({ where: { id: c2 } }),
    t1: await p.term.count({ where: { id: t1 } }),
    s1: await p.section.count({ where: { id: s1 } }),
    st1: await p.student.count({ where: { id: st1 } }),
    sub1: await p.subject.count({ where: { id: sub1 } }),
    ass1: await p.subjectAssignment.count({ where: { id: ass1 } }),
  };
  verify.noOrphans = {
    enrollForST1: await p.enrollment.count({ where: { studentId: st1 } }),
    assignToPC: await p.subjectAssignment.count({ where: { OR: [{ academicYearId: y1 }, { classId: c1 }, { classId: c2 }, { sectionId: s1 }] } }),
  };
  verify.seedUntouched = {
    subMat: await p.subject.findUnique({ where: { id: 'seed_sub_mat' }, select: { name: true, code: true, isActive: true } }),
    subSci: await p.subject.findUnique({ where: { id: 'seed_sub_sci' }, select: { name: true, code: true, isActive: true } }),
    ay2627: await p.academicYear.findUnique({ where: { id: 'seed_ay_2627' }, select: { name: true, status: true, isActive: true } }),
    admin: await p.user.findUnique({ where: { id: 'seed_user_admin' }, select: { email: true, status: true } }),
  };
  verify.schoolB = {
    cls: await p.class.count({ where: { schoolId: 'fixture_school_b' } }),
    sec: await p.section.count({ where: { schoolId: 'fixture_school_b' } }),
    sub: await p.subject.count({ where: { schoolId: 'fixture_school_b' } }),
    ay: await p.academicYear.count({ where: { schoolId: 'fixture_school_b' } }),
    stu: await p.student.count({ where: { schoolId: 'fixture_school_b' } }),
    term: await p.term.count({ where: { schoolId: 'fixture_school_b' } }),
  };
  console.log('PC CLEANUP:', JSON.stringify(verify));
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
