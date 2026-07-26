import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await hashPassword('password123');

  const school = await prisma.school.upsert({
    where: { slug: 'demo-school' },
    update: {},
    create: {
      name: 'Demo School',
      slug: 'demo-school',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    },
  });
  console.log('Created school:', school.name);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@easystem.dev' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@easystem.dev',
      emailVerified: true,
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: {
      accountId_providerId: {
        accountId: superAdmin.id,
        providerId: 'credential',
      },
    },
    update: {},
    create: {
      accountId: superAdmin.id,
      providerId: 'credential',
      userId: superAdmin.id,
      password: hashedPassword,
    },
  });
  await prisma.membership.upsert({
    where: {
      schoolId_userId_role: {
        schoolId: school.id,
        userId: superAdmin.id,
        role: 'SUPER_ADMIN',
      },
    },
    update: {},
    create: {
      schoolId: school.id,
      userId: superAdmin.id,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('Created super admin:', superAdmin.email);

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@easystem.dev' },
    update: {},
    create: {
      name: 'John Teacher',
      email: 'teacher@easystem.dev',
      emailVerified: true,
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: {
      accountId_providerId: {
        accountId: teacher.id,
        providerId: 'credential',
      },
    },
    update: {},
    create: {
      accountId: teacher.id,
      providerId: 'credential',
      userId: teacher.id,
      password: hashedPassword,
    },
  });
  await prisma.membership.upsert({
    where: {
      schoolId_userId_role: {
        schoolId: school.id,
        userId: teacher.id,
        role: 'TEACHER',
      },
    },
    update: {},
    create: {
      schoolId: school.id,
      userId: teacher.id,
      role: 'TEACHER',
      status: 'ACTIVE',
    },
  });
  console.log('Created teacher:', teacher.email);

  const student = await prisma.user.upsert({
    where: { email: 'student@easystem.dev' },
    update: {},
    create: {
      name: 'Jane Student',
      email: 'student@easystem.dev',
      emailVerified: true,
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: {
      accountId_providerId: {
        accountId: student.id,
        providerId: 'credential',
      },
    },
    update: {},
    create: {
      accountId: student.id,
      providerId: 'credential',
      userId: student.id,
      password: hashedPassword,
    },
  });
  await prisma.membership.upsert({
    where: {
      schoolId_userId_role: {
        schoolId: school.id,
        userId: student.id,
        role: 'STUDENT',
      },
    },
    update: {},
    create: {
      schoolId: school.id,
      userId: student.id,
      role: 'STUDENT',
      status: 'ACTIVE',
    },
  });
  console.log('Created student:', student.email);

  await prisma.schoolSettings.upsert({
    where: { schoolId: school.id },
    update: {},
    create: {
      schoolId: school.id,
      attendanceStart: '08:00',
      attendanceEnd: '15:00',
      language: 'en',
      gradingSystem: 'percentage',
    },
  });
  console.log('Created school settings');

  const starterPlan = await prisma.plan.upsert({
    where: { name: 'starter' },
    update: {},
    create: {
      name: 'starter',
      studentLimit: 500,
      staffLimit: 50,
      priceMonthly: 9900,
      modules: ['admissions', 'academics', 'attendance'],
    },
  });
  const growthPlan = await prisma.plan.upsert({
    where: { name: 'growth' },
    update: {},
    create: {
      name: 'growth',
      studentLimit: 2000,
      staffLimit: 200,
      priceMonthly: 24900,
      modules: [
        'admissions',
        'academics',
        'attendance',
        'examinations',
        'finance',
        'hr',
        'transport',
        'communication',
        'library',
        'hostel',
        'inventory',
        'analytics',
      ],
    },
  });
  const enterprisePlan = await prisma.plan.upsert({
    where: { name: 'enterprise' },
    update: {},
    create: {
      name: 'enterprise',
      studentLimit: 999999,
      staffLimit: 999999,
      priceMonthly: 0,
      modules: [
        'admissions',
        'academics',
        'attendance',
        'examinations',
        'finance',
        'hr',
        'transport',
        'communication',
        'library',
        'hostel',
        'inventory',
        'analytics',
      ],
    },
  });
  console.log(
    'Created plans:',
    starterPlan.name,
    growthPlan.name,
    enterprisePlan.name
  );

  await prisma.subscription.upsert({
    where: { schoolId: school.id },
    update: {},
    create: {
      schoolId: school.id,
      planId: starterPlan.id,
      status: 'TRIALING',
      studentLimit: 500,
      staffLimit: 50,
    },
  });
  console.log('Created subscription for demo school');

  const featureDefs = [
    { key: 'admissions', name: 'Admissions', module: 'core' },
    { key: 'academics', name: 'Academics', module: 'core' },
    { key: 'attendance', name: 'Attendance', module: 'core' },
    { key: 'examinations', name: 'Examinations', module: 'academic' },
    { key: 'finance', name: 'Finance', module: 'admin' },
    { key: 'hr', name: 'Human Resources', module: 'admin' },
    { key: 'transport', name: 'Transport', module: 'operations' },
    { key: 'communication', name: 'Communication', module: 'core' },
    { key: 'library', name: 'Library', module: 'operations' },
    { key: 'hostel', name: 'Hostel', module: 'operations' },
    { key: 'inventory', name: 'Inventory', module: 'operations' },
    { key: 'analytics', name: 'Analytics', module: 'admin' },
  ];

  for (const f of featureDefs) {
    await prisma.feature.upsert({
      where: { key: f.key },
      update: {},
      create: f,
    });
  }
  console.log('Created', featureDefs.length, 'feature definitions');

  const features = await prisma.feature.findMany();
  for (const feature of features) {
    await prisma.schoolFeature.upsert({
      where: {
        schoolId_featureId: {
          schoolId: school.id,
          featureId: feature.id,
        },
      },
      update: {},
      create: {
        schoolId: school.id,
        featureId: feature.id,
        enabled: [
          'admissions',
          'academics',
          'attendance',
          'communication',
        ].includes(feature.key),
      },
    });
  }
  console.log('Created school feature flags');

  const parent = await prisma.user.upsert({
    where: { email: 'parent@easystem.dev' },
    update: {},
    create: {
      name: 'Mary Parent',
      email: 'parent@easystem.dev',
      emailVerified: true,
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: {
      accountId_providerId: { accountId: parent.id, providerId: 'credential' },
    },
    update: {},
    create: {
      accountId: parent.id,
      providerId: 'credential',
      userId: parent.id,
      password: hashedPassword,
    },
  });
  const parentMembership = await prisma.membership.upsert({
    where: {
      schoolId_userId_role: {
        schoolId: school.id,
        userId: parent.id,
        role: 'PARENT',
      },
    },
    update: {},
    create: {
      schoolId: school.id,
      userId: parent.id,
      role: 'PARENT',
      status: 'ACTIVE',
    },
  });
  const studentMembership = await prisma.membership.findFirst({
    where: { userId: student.id, schoolId: school.id, role: 'STUDENT' },
  });
  if (parentMembership && studentMembership) {
    await prisma.parentStudentLink.upsert({
      where: { id: 'seed-parent-link' },
      update: {},
      create: {
        id: 'seed-parent-link',
        schoolId: school.id,
        parentMembershipId: parentMembership.id,
        studentMembershipId: studentMembership.id,
        relationship: 'MOTHER',
      },
    });
    console.log('Created parent-student link');
  }
  console.log('Created parent:', parent.email);

  // ============================================
  // School B — for cross-tenant testing
  // ============================================
  const schoolB = await prisma.school.upsert({
    where: { slug: 'school-b' },
    update: {},
    create: {
      name: 'School B',
      slug: 'school-b',
      status: 'ACTIVE',
      timezone: 'UTC',
      currency: 'USD',
    },
  });
  console.log('Created school:', schoolB.name);

  const teacherB = await prisma.user.upsert({
    where: { email: 'teacher-b@easystem.dev' },
    update: {},
    create: {
      name: 'Jane Teacher B',
      email: 'teacher-b@easystem.dev',
      emailVerified: true,
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: {
      accountId_providerId: {
        accountId: teacherB.id,
        providerId: 'credential',
      },
    },
    update: {},
    create: {
      accountId: teacherB.id,
      providerId: 'credential',
      userId: teacherB.id,
      password: hashedPassword,
    },
  });
  await prisma.membership.upsert({
    where: {
      schoolId_userId_role: {
        schoolId: schoolB.id,
        userId: teacherB.id,
        role: 'TEACHER',
      },
    },
    update: {},
    create: {
      schoolId: schoolB.id,
      userId: teacherB.id,
      role: 'TEACHER',
      status: 'ACTIVE',
    },
  });
  console.log('Created teacher:', teacherB.email);

  const studentB = await prisma.user.upsert({
    where: { email: 'student-b@easystem.dev' },
    update: {},
    create: {
      name: 'Bob Student B',
      email: 'student-b@easystem.dev',
      emailVerified: true,
      status: 'active',
    },
  });
  await prisma.account.upsert({
    where: {
      accountId_providerId: {
        accountId: studentB.id,
        providerId: 'credential',
      },
    },
    update: {},
    create: {
      accountId: studentB.id,
      providerId: 'credential',
      userId: studentB.id,
      password: hashedPassword,
    },
  });
  await prisma.membership.upsert({
    where: {
      schoolId_userId_role: {
        schoolId: schoolB.id,
        userId: studentB.id,
        role: 'STUDENT',
      },
    },
    update: {},
    create: {
      schoolId: schoolB.id,
      userId: studentB.id,
      role: 'STUDENT',
      status: 'ACTIVE',
    },
  });
  console.log('Created student:', studentB.email);

  await prisma.schoolSettings.upsert({
    where: { schoolId: schoolB.id },
    update: {},
    create: {
      schoolId: schoolB.id,
      attendanceStart: '09:00',
      attendanceEnd: '16:00',
      language: 'en',
      gradingSystem: 'letter',
    },
  });
  console.log('Created school settings for School B');

  console.log('\nSeed complete!');
  console.log('\nTest accounts:');
  console.log('  Super Admin: admin@easystem.dev / password123');
  console.log('  Teacher:     teacher@easystem.dev / password123');
  console.log('  Student:     student@easystem.dev / password123');
  console.log('  Parent:      parent@easystem.dev / password123');
  console.log('  Teacher B:   teacher-b@easystem.dev / password123');
  console.log('  Student B:   student-b@easystem.dev / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
