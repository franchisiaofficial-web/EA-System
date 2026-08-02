import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const p = new PrismaClient({ adapter });

const SCHOOL_B = 'fixture_school_b';

async function main() {
  const schoolA = await p.school.findUnique({ where: { slug: 'ea-public-school' } });
  if (!schoolA) throw new Error('School A not found');
  console.log('School A:', schoolA.id, schoolA.name);

  const day = new Date('2026-08-01T06:00:00.000Z');
  const today = new Date();

  await p.school.upsert({
    where: { id: SCHOOL_B },
    update: {},
    create: {
      id: SCHOOL_B,
      name: 'Meridian Public School',
      slug: 'meridian-public-school',
      address: '1, Test Road, Coimbatore',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      country: 'India',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      status: 'ACTIVE',
    },
  });

  const user = await p.user.upsert({
    where: { id: 'fixture_user_b_stu' },
    update: {},
    create: {
      id: 'fixture_user_b_stu',
      name: 'Bharat Vasan',
      email: 'fixture.student.b1@meridian.test',
      emailVerified: true,
      status: 'active',
    },
  });

  await p.membership.upsert({
    where: { id: 'fixture_mem_b_stu' },
    update: {},
    create: {
      id: 'fixture_mem_b_stu',
      schoolId: SCHOOL_B,
      userId: user.id,
      role: 'STUDENT',
      status: 'ACTIVE',
    },
  });

  await p.academicYear.upsert({
    where: { id: 'fixture_ay_b' },
    update: {},
    create: {
      id: 'fixture_ay_b',
      schoolId: SCHOOL_B,
      name: '2026-2027',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      status: 'ACTIVE',
      createdBy: user.id,
    },
  });

  await p.class.upsert({
    where: { id: 'fixture_cls_b_g01' },
    update: {},
    create: {
      id: 'fixture_cls_b_g01',
      schoolId: SCHOOL_B,
      academicYearId: 'fixture_ay_b',
      name: 'Grade 1',
      displayName: 'Grade 1',
      gradeLevel: 'Grade 1',
      sortOrder: 0,
      status: 'ACTIVE',
      createdBy: user.id,
      updatedBy: user.id,
    },
  });

  await p.section.upsert({
    where: { id: 'fixture_sec_b_g01_a' },
    update: {},
    create: {
      id: 'fixture_sec_b_g01_a',
      schoolId: SCHOOL_B,
      classId: 'fixture_cls_b_g01',
      name: 'A',
      capacity: 40,
      room: '01-A',
      status: 'ACTIVE',
    },
  });

  const student = await p.student.upsert({
    where: { id: 'fixture_stu_b1' },
    update: {},
    create: {
      id: 'fixture_stu_b1',
      schoolId: SCHOOL_B,
      userId: user.id,
      admissionNumber: 'FIXADM0001',
      firstName: 'Bharat',
      lastName: 'Vasan',
      dateOfBirth: new Date('2018-05-15'),
      gender: 'Male',
      bloodGroup: 'O+',
      admissionDate: new Date('2026-05-01'),
      phone: '9000000099',
      address: '1, Test Road',
      siblings: [],
      status: 'ACTIVE',
      isDeleted: false,
    },
  });

  const existingEnr = await p.enrollment.findFirst({
    where: { studentId: student.id, classId: 'fixture_cls_b_g01' },
  });
  if (!existingEnr) {
    await p.enrollment.create({
      data: {
        id: 'fixture_enr_b1',
        schoolId: SCHOOL_B,
        studentId: student.id,
        academicYearId: 'fixture_ay_b',
        classId: 'fixture_cls_b_g01',
        sectionId: 'fixture_sec_b_g01_a',
        rollNumber: '1',
        status: 'ACTIVE',
        joinedAt: day,
      },
    });
  }

  const counts = await p.$queryRawUnsafe(
    `select (select count(*) from schools where id = 'fixture_school_b') as schools,
            (select count(*) from classes where id = 'fixture_cls_b_g01') as classes,
            (select count(*) from memberships where id = 'fixture_mem_b_stu') as memberships,
            (select count(*) from students where id = 'fixture_stu_b1') as students,
            (select count(*) from enrollments where id = 'fixture_enr_b1') as enrollments`
  );
  console.log('Fixture counts:', JSON.stringify(counts, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)));
  console.log('Fixture date:', day.toISOString(), '| today:', today.toISOString());
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
