/**
 * EA SYSTEM — Complete Development Seed
 *
 * Idempotent: wipes the seed-managed data (EA Public School + seed.* users) and
 * recreates everything deterministically. Safe to run repeatedly.
 *
 *   npm run prisma:seed
 *
 * Produces: 1 school, 3 academic years, 15 classes (+15 historical), 45 sections
 * (+45 historical), ~83 staff, 1,560 students, one ACTIVE enrollment per student,
 * 30 days of attendance, timetables, subjects, exams, marks, sibling records.
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from 'better-auth/crypto';

const p = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    max: 5,
  }),
});

/* ───────────────────────── helpers ───────────────────────── */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260801);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min;
const pad = (n: number, w: number) => String(n).padStart(w, '0');
// UTC-midnight dates: matches how the app serializes "yyyy-MM-dd" (new Date('yyyy-MM-dd')),
// so equality queries against @db.Date columns round-trip correctly.
const dateOnly = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));

const SCHOOL_ID = 'seed_school_ea';
const ADMIN_EMAIL = 'schooladmin@easystem.dev';

/* ───────────────────────── name / address pools (Tamil Nadu) ───────────────────────── */

const MALE_NAMES = [
  'Karthik',
  'Arjun',
  'Dinesh',
  'Manoj',
  'Suresh',
  'Ravi',
  'Senthil',
  'Vignesh',
  'Kabilan',
  'Muthu',
  'Praveen',
  'Sanjay',
  'Tharun',
  'Yuvaraj',
  'Ajay',
  'Balaji',
  'Chandru',
  'Deepak',
  'Ganesh',
  'Hariharan',
  'Ilango',
  'Jeevan',
  'Kumaravel',
  'Manikandan',
  'Naveen',
  'Prakash',
  'Raghavan',
  'Sathish',
  'Thilak',
  'Uday',
  'Vasanth',
  'Yogesh',
  'Aravind',
  'Bharath',
  'Dharun',
  'Ezhil',
  'Gokul',
  'Harsha',
  'Iniyan',
  'Jayanth',
  'Kishore',
  'Lokesh',
  'Mohan',
  'Nithin',
  'Parthiban',
  'Rajesh',
  'Sakthi',
  'Tamizhselvan',
  'Kumaresan',
  'Vetri',
];
const FEMALE_NAMES = [
  'Priya',
  'Divya',
  'Keerthana',
  'Meena',
  'Lakshmi',
  'Swathi',
  'Anitha',
  'Deepa',
  'Kavitha',
  'Janani',
  'Madhumathi',
  'Nithya',
  'Pavithra',
  'Revathi',
  'Sandhya',
  'Tamilarasi',
  'Uma',
  'Vidhya',
  'Yamuna',
  'Soundarya',
  'Abinaya',
  'Bhuvaneswari',
  'Charulatha',
  'Dharshini',
  'Elakiya',
  'Gayathri',
  'Harini',
  'Indhuja',
  'Jothika',
  'Kaviya',
  'Lavanya',
  'Mahalakshmi',
  'Nandhini',
  'Oviya',
  'Priyadharshini',
  'Ramya',
  'Shalini',
  'Tharani',
  'Vaishnavi',
  'Aishwarya',
  'Bhavana',
  'Chithra',
  'DivyaBharathi',
  'Hema',
  'Iswarya',
  'Kalaiyarasi',
  'Mounika',
  'Nirmala',
  'Ranjitha',
  'Sneha',
];
const SURNAMES = [
  'Kumar',
  'Rajan',
  'Murugan',
  'Selvam',
  'Subramanian',
  'Venkatesan',
  'Raghavan',
  'Ilangovan',
  'Manickam',
  'Pillai',
  'Gopal',
  'Krishnan',
  'Natarajan',
  'Perumal',
  'Raman',
  'Sekar',
  'Thiagarajan',
  'Anandan',
  'Chidambaram',
  'Doraisamy',
  'Eswaran',
  'Ganesan',
  'Hariharan',
  'Jayaraman',
  'Kandasamy',
  'Lingam',
  'Moorthy',
  'Nagarajan',
  'Palanisamy',
  'Ramasamy',
  'Sivakumar',
  'Sundaram',
  'Varadarajan',
  'Viswanathan',
  'Balasubramanian',
  'Chandrasekaran',
  'Duraisamy',
  'Gopalakrishnan',
  'Muthusamy',
  'Kannan',
];
const STREETS = [
  'Gandhi Main Road',
  'Anna Salai',
  'Bazaar Street',
  'School Street',
  'Temple Street',
  'Lake View Road',
  'Bus Stand Road',
  'Market Road',
  'Church Street',
  'Railway Station Road',
  'Kamarajar Salai',
  'VOC Street',
  'Mettu Street',
  'Car Street',
  'Raja Street',
];
const LOCALITIES = [
  'Anna Nagar',
  'Adyar',
  'Velachery',
  'Tambaram',
  'Chromepet',
  'T. Nagar',
  'Porur',
  'Ambattur',
  'Avadi',
  'Poonamallee',
  'Koyambedu',
  'Saidapet',
  'Guindy',
  'Pallavaram',
  'Madipakkam',
  'Kolathur',
  'Perambur',
  'Royapuram',
  'Mylapore',
  'Teynampet',
];
const CITIES = [
  'Chennai',
  'Coimbatore',
  'Madurai',
  'Trichy',
  'Salem',
  'Vellore',
];
const PINS = [
  '600001',
  '600040',
  '600042',
  '600044',
  '600078',
  '600096',
  '600107',
  '600113',
  '600119',
  '620001',
  '625001',
  '641001',
  '636001',
  '632001',
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const genAddress = () =>
  `No. ${randInt(1, 240)}, ${pick(STREETS)}, ${pick(LOCALITIES)}, ${pick(CITIES)} - ${pick(PINS)}`;

/* ───────────────────────── structural constants ───────────────────────── */

const CLASS_NAMES = [
  'Pre-KG',
  'LKG',
  'UKG',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
];
const SECTION_LETTERS = ['A', 'B', 'C'];

const SUBJECTS: { code: string; name: string }[] = [
  { code: 'ENG', name: 'English' },
  { code: 'TAM', name: 'Tamil' },
  { code: 'MAT', name: 'Maths' },
  { code: 'SCI', name: 'Science' },
  { code: 'SS', name: 'Social Science' },
  { code: 'PHY', name: 'Physics' },
  { code: 'CHE', name: 'Chemistry' },
  { code: 'BIO', name: 'Biology' },
  { code: 'CS', name: 'Computer Science' },
  { code: 'COM', name: 'Commerce' },
  { code: 'ECO', name: 'Economics' },
  { code: 'ACC', name: 'Accountancy' },
  { code: 'PE', name: 'Physical Education' },
  { code: 'GK', name: 'General Knowledge' },
  { code: 'DRAW', name: 'Drawing' },
  { code: 'MUS', name: 'Music' },
];

// subjects taught per grade index (0..14)
const GRADE_SUBJECTS: string[][] = [
  ['ENG', 'TAM', 'MAT', 'GK', 'DRAW', 'MUS', 'PE'], // Pre-KG
  ['ENG', 'TAM', 'MAT', 'GK', 'DRAW', 'MUS', 'PE'], // LKG
  ['ENG', 'TAM', 'MAT', 'GK', 'DRAW', 'MUS', 'PE'], // UKG
  ['ENG', 'TAM', 'MAT', 'SCI', 'SS', 'GK', 'PE'], // Grade 1
  ['ENG', 'TAM', 'MAT', 'SCI', 'SS', 'GK', 'PE'], // Grade 2
  ['ENG', 'TAM', 'MAT', 'SCI', 'SS', 'GK', 'PE'], // Grade 3
  ['ENG', 'TAM', 'MAT', 'SCI', 'SS', 'GK', 'PE'], // Grade 4
  ['ENG', 'TAM', 'MAT', 'SCI', 'SS', 'GK', 'PE'], // Grade 5
  ['ENG', 'TAM', 'MAT', 'SCI', 'SS', 'CS', 'PE'], // Grade 6
  ['ENG', 'TAM', 'MAT', 'SCI', 'SS', 'CS', 'PE'], // Grade 7
  ['ENG', 'TAM', 'MAT', 'SCI', 'SS', 'CS', 'PE'], // Grade 8
  ['ENG', 'TAM', 'MAT', 'PHY', 'CHE', 'BIO', 'SS', 'CS', 'PE'], // Grade 9
  ['ENG', 'TAM', 'MAT', 'PHY', 'CHE', 'BIO', 'SS', 'CS', 'PE'], // Grade 10
  ['ENG', 'TAM', 'MAT', 'COM', 'ECO', 'ACC', 'CS', 'PE'], // Grade 11
  ['ENG', 'TAM', 'MAT', 'COM', 'ECO', 'ACC', 'CS', 'PE'], // Grade 12
];

// 30 subject teachers, each with a home subject (t046..t075)
const SUBJECT_TEACHERS: { name: string; subject: string }[] = [
  { name: 'Meenakshi Sundaram', subject: 'ENG' },
  { name: 'Rajalakshmi', subject: 'ENG' },
  { name: 'Shanmugavel', subject: 'ENG' },
  { name: 'Thilagavathi', subject: 'TAM' },
  { name: 'Arumugam', subject: 'TAM' },
  { name: 'Valliammai', subject: 'TAM' },
  { name: 'Sivaprakash', subject: 'MAT' },
  { name: 'Gayathri Devi', subject: 'MAT' },
  { name: 'Muralidharan', subject: 'MAT' },
  { name: 'Padmini', subject: 'SCI' },
  { name: 'Ramesh Babu', subject: 'SS' },
  { name: 'Usha Rani', subject: 'SS' },
  { name: 'Venkataraman', subject: 'PHY' },
  { name: 'Lakshmi Narayanan', subject: 'PHY' },
  { name: 'Srinivasan', subject: 'CHE' },
  { name: 'Kaviarasan', subject: 'CHE' },
  { name: 'Bharathiraja', subject: 'BIO' },
  { name: 'Suganya', subject: 'BIO' },
  { name: 'Praveen Kumar', subject: 'CS' },
  { name: 'Nandakumar', subject: 'CS' },
  { name: 'Selvaganapathy', subject: 'COM' },
  { name: 'Jayalakshmi', subject: 'COM' },
  { name: 'Manoharan', subject: 'ECO' },
  { name: 'Devi Priya', subject: 'ECO' },
  { name: 'Sundarraj', subject: 'ACC' },
  { name: 'Annapoorni', subject: 'ACC' },
  { name: 'Murugesh', subject: 'PE' },
  { name: 'Chithra', subject: 'GK' },
  { name: 'Senthilkumar', subject: 'DRAW' },
  { name: 'Revathy', subject: 'MUS' },
];

const NON_TEACHING: {
  name: string;
  role: string;
  designation: string;
  department: string;
}[] = [
  {
    name: 'Gopalakrishnan',
    role: 'PRINCIPAL',
    designation: 'Principal',
    department: 'Administration',
  },
  {
    name: 'Saraswathi',
    role: 'VICE_PRINCIPAL',
    designation: 'Vice Principal',
    department: 'Administration',
  },
  {
    name: 'Balasubramanian',
    role: 'ACCOUNTANT',
    designation: 'Accountant',
    department: 'Finance',
  },
  {
    name: 'Parvathi',
    role: 'LIBRARIAN',
    designation: 'Librarian',
    department: 'Library',
  },
  {
    name: 'Loganathan',
    role: 'TRANSPORT_MANAGER',
    designation: 'Transport Manager',
    department: 'Transport',
  },
  {
    name: 'Kavya',
    role: 'NON_TEACHING',
    designation: 'Receptionist',
    department: 'Administration',
  },
  {
    name: 'Mohanraj',
    role: 'NON_TEACHING',
    designation: 'Office Staff',
    department: 'Administration',
  },
  {
    name: 'Divya',
    role: 'NON_TEACHING',
    designation: 'Office Staff',
    department: 'Administration',
  },
];

const EXAM_NAMES = [
  'Quarterly Examination',
  'Half Yearly Examination',
  'Annual Examination',
];
const TERM_NAMES = ['Term 1', 'Term 2', 'Term 3'];

/* ───────────────────────── wipe (idempotent reset) ───────────────────────── */

async function wipe() {
  const scoped: string[] = [
    'passedOutRecord',
    'examResult',
    'exam',
    'timetable',
    'subjectAssignment',
    'classAssignment',
    'attendanceCorrection',
    'attendanceRecord',
    'attendanceSession',
    'attendanceReason',
    'classEnrollment',
    'enrollment',
    'parentStudentLink',
    'staffProfile',
    'membership',
    'feePayment',
    'feeInvoice',
    'feeStructure',
    'feeCategory',
    'transportAssignment',
    'transportRoute',
    'vehicle',
    'bookBorrowing',
    'book',
    'term',
    'subject',
    'studentDraft',
    'section',
    'class',
    'academicYear',
    'gradeScale',
    'attendanceSettings',
    'schoolSettings',
    'schoolFeature',
    'subscription',
    'crudDemo',
    'student',
    'guardian',
    'auditLog',
  ];

  // 1) delete any school this seed manages (EA Public School or the legacy Demo School)
  const managed = await p.school.findMany({
    where: {
      OR: [
        { slug: 'ea-public-school' },
        { slug: 'demo-school' },
        { name: 'Demo School' },
      ],
    },
    select: { id: true },
  });
  const managedIds = managed.map((s) => s.id);

  // 2) drop student-linked join rows that have no schoolId, scoped to managed schools
  const stuIds = managedIds.length
    ? (
        await p.student.findMany({
          where: { schoolId: { in: managedIds } },
          select: { id: true },
        })
      ).map((s) => s.id)
    : [];
  if (stuIds.length) {
    await p.studentGuardian.deleteMany({
      where: { studentId: { in: stuIds } },
    });
    await p.studentEnrollment.deleteMany({
      where: { studentId: { in: stuIds } },
    });
  }

  // 3) delete all school-scoped rows for managed schools
  for (const model of scoped) {
    const m = (
      p as unknown as Record<
        string,
        { deleteMany: (args?: unknown) => Promise<unknown> }
      >
    )[model];
    if (!m || typeof m.deleteMany !== 'function') continue;
    await m.deleteMany(
      managedIds.length
        ? { where: { schoolId: { in: managedIds } } }
        : undefined
    );
  }

  // 4) remove the schools themselves
  if (managedIds.length)
    await p.school.deleteMany({ where: { id: { in: managedIds } } });

  // 5) remove seed-managed users + any user left without a membership (orphans)
  await p.user.deleteMany({
    where: {
      OR: [
        { email: { startsWith: 'seed.' } },
        { email: ADMIN_EMAIL },
        { email: 'superadmin@easystem.dev' },
        { memberships: { none: {} } },
      ],
    },
  });
}

/* ───────────────────────── seed body ───────────────────────── */

async function seed() {
  const adminPasswordHash = await hashPassword('password123');

  // ── school ──
  await p.school.create({
    data: {
      id: SCHOOL_ID,
      name: 'EA Public School',
      slug: 'ea-public-school',
      address: 'No. 1, EA Campus, Anna Salai, Chennai - 600002',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      status: 'ACTIVE',
    },
  });

  // ── admin user ──
  const admin = await p.user.create({
    data: {
      id: 'seed_user_admin',
      name: 'School Administrator',
      email: ADMIN_EMAIL,
      emailVerified: true,
      status: 'active',
    },
  });
  await p.account.create({
    data: {
      id: 'seed_acct_admin',
      accountId: admin.id,
      providerId: 'credential',
      userId: admin.id,
      password: adminPasswordHash,
    },
  });
  await p.membership.create({
    data: {
      id: 'seed_mem_admin',
      schoolId: SCHOOL_ID,
      userId: admin.id,
      role: 'SCHOOL_ADMIN',
      status: 'ACTIVE',
    },
  });

  // ── super-admin user (required by /api/test/setup-cross-tenant) ──
  const superAdmin = await p.user.create({
    data: {
      id: 'seed_user_superadmin',
      name: 'Platform Super Admin',
      email: 'superadmin@easystem.dev',
      emailVerified: true,
      status: 'active',
    },
  });
  await p.account.create({
    data: {
      id: 'seed_acct_superadmin',
      accountId: superAdmin.id,
      providerId: 'credential',
      userId: superAdmin.id,
      password: adminPasswordHash,
    },
  });
  await p.membership.create({
    data: {
      id: 'seed_mem_superadmin',
      schoolId: SCHOOL_ID,
      userId: superAdmin.id,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  // ── academic years ──
  const ay2425 = {
    id: 'seed_ay_2425',
    schoolId: SCHOOL_ID,
    name: '2024-2025',
    startDate: dateOnly(2024, 4, 1),
    endDate: dateOnly(2025, 3, 31),
    status: 'COMPLETED' as const,
    createdBy: admin.id,
  };
  const ay2526 = {
    id: 'seed_ay_2526',
    schoolId: SCHOOL_ID,
    name: '2025-2026',
    startDate: dateOnly(2025, 4, 1),
    endDate: dateOnly(2026, 3, 31),
    isActive: true,
    isCurrent: true,
    status: 'ACTIVE' as const,
    createdBy: admin.id,
  };
  const ay2627 = {
    id: 'seed_ay_2627',
    schoolId: SCHOOL_ID,
    name: '2026-2027',
    startDate: dateOnly(2026, 4, 1),
    endDate: dateOnly(2027, 3, 31),
    status: 'INACTIVE' as const,
    createdBy: admin.id,
  };
  await p.academicYear.createMany({
    data: [ay2425, ay2526, ay2627],
    skipDuplicates: true,
  });

  // ── terms (2025-2026) ──
  const terms = [
    {
      id: 'seed_term_2526_1',
      schoolId: SCHOOL_ID,
      academicYearId: ay2526.id,
      name: TERM_NAMES[0],
      startDate: dateOnly(2025, 6, 1),
      endDate: dateOnly(2025, 9, 30),
      status: 'ACTIVE' as const,
    },
    {
      id: 'seed_term_2526_2',
      schoolId: SCHOOL_ID,
      academicYearId: ay2526.id,
      name: TERM_NAMES[1],
      startDate: dateOnly(2025, 10, 1),
      endDate: dateOnly(2025, 12, 31),
      status: 'ACTIVE' as const,
    },
    {
      id: 'seed_term_2526_3',
      schoolId: SCHOOL_ID,
      academicYearId: ay2526.id,
      name: TERM_NAMES[2],
      startDate: dateOnly(2026, 1, 1),
      endDate: dateOnly(2026, 3, 31),
      status: 'ACTIVE' as const,
    },
  ];
  await p.term.createMany({ data: terms, skipDuplicates: true });

  // ── classes + sections (2025-2026 active, 2024-2025 historical) ──
  const classes2526 = CLASS_NAMES.map((name, i) => ({
    id: `seed_cls_2526_g${pad(i, 2)}`,
    schoolId: SCHOOL_ID,
    academicYearId: ay2526.id,
    name,
    displayName: name,
    gradeLevel: name,
    sortOrder: i,
    status: 'ACTIVE' as const,
    createdBy: admin.id,
    updatedBy: admin.id,
  }));
  const classes2425 = CLASS_NAMES.map((name, i) => ({
    id: `seed_cls_2425_g${pad(i, 2)}`,
    schoolId: SCHOOL_ID,
    academicYearId: ay2425.id,
    name,
    displayName: name,
    gradeLevel: name,
    sortOrder: i,
    status: 'INACTIVE' as const,
    createdBy: admin.id,
    updatedBy: admin.id,
  }));
  // Target year for promotion (2026-2027): full class structure, empty of students.
  // Classes are ACTIVE so the promotion pre-check and grades-based next-class
  // resolution work; the AY itself stays INACTIVE until the close-year flow.
  const classes2627 = CLASS_NAMES.map((name, i) => ({
    id: `seed_cls_2627_g${pad(i, 2)}`,
    schoolId: SCHOOL_ID,
    academicYearId: ay2627.id,
    name,
    displayName: name,
    gradeLevel: name,
    sortOrder: i,
    status: 'ACTIVE' as const,
    createdBy: admin.id,
    updatedBy: admin.id,
  }));
  await p.class.createMany({
    data: [...classes2526, ...classes2425, ...classes2627],
    skipDuplicates: true,
  });

  const sections2526: Prisma.SectionCreateManyInput[] = [];
  const sections2425: Prisma.SectionCreateManyInput[] = [];
  const sections2627: Prisma.SectionCreateManyInput[] = [];
  for (let g = 0; g < CLASS_NAMES.length; g++) {
    for (const letter of SECTION_LETTERS) {
      sections2526.push({
        id: `seed_sec_2526_g${pad(g, 2)}_${letter.toLowerCase()}`,
        schoolId: SCHOOL_ID,
        classId: classes2526[g].id,
        name: letter,
        capacity: 40,
        room: `${pad(g + 1, 2)}-${letter}`,
        status: 'ACTIVE',
      });
      sections2425.push({
        id: `seed_sec_2425_g${pad(g, 2)}_${letter.toLowerCase()}`,
        schoolId: SCHOOL_ID,
        classId: classes2425[g].id,
        name: letter,
        capacity: 40,
        room: `${pad(g + 1, 2)}-${letter}`,
        status: 'INACTIVE',
      });
      sections2627.push({
        id: `seed_sec_2627_g${pad(g, 2)}_${letter.toLowerCase()}`,
        schoolId: SCHOOL_ID,
        classId: classes2627[g].id,
        name: letter,
        capacity: 40,
        room: `${pad(g + 1, 2)}-${letter}`,
        status: 'ACTIVE',
      });
    }
  }
  await p.section.createMany({
    data: [...sections2526, ...sections2425, ...sections2627],
    skipDuplicates: true,
  });
  const sectionId = (year: string, g: number, s: number) =>
    `seed_sec_${year}_g${pad(g, 2)}_${SECTION_LETTERS[s].toLowerCase()}`;
  const classId = (year: string, g: number) => `seed_cls_${year}_g${pad(g, 2)}`;

  // ── staff: class teachers (45) + subject teachers (30) + non-teaching (8) ──
  const staffUsers: Prisma.UserCreateManyInput[] = [];
  const staffMems: Prisma.MembershipCreateManyInput[] = [];
  const staffProfiles: Prisma.StaffProfileCreateManyInput[] = [];
  let staffSeq = 0;
  const phoneBase = 9003000000;
  const pushStaff = (
    label: string,
    fullName: string,
    role: string,
    designation: string,
    department: string
  ) => {
    staffSeq++;
    const id = `seed_${label}${pad(staffSeq, 3)}`;
    const memId = `seed_mem_${label}${pad(staffSeq, 3)}`;
    staffUsers.push({
      id: `seed_user_${label}${pad(staffSeq, 3)}`,
      name: fullName,
      email: `seed.${label}${pad(staffSeq, 3)}@easystem.dev`,
      emailVerified: true,
      status: 'active',
      phone: String(phoneBase + staffSeq),
    });
    staffMems.push({
      id: memId,
      schoolId: SCHOOL_ID,
      userId: `seed_user_${label}${pad(staffSeq, 3)}`,
      role: role as Prisma.MembershipCreateManyInput['role'],
      status: 'ACTIVE',
    });
    staffProfiles.push({
      id: `seed_sp_${label}${pad(staffSeq, 3)}`,
      schoolId: SCHOOL_ID,
      membershipId: memId,
      employeeId: `${label.toUpperCase()}${pad(staffSeq, 3)}`,
      designation,
      gender:
        fullName.includes('Kavya') || fullName.includes('Divya')
          ? 'Female'
          : 'Male',
      dateOfBirth: dateOnly(
        1980 + randInt(0, 15),
        randInt(1, 12),
        randInt(1, 28)
      ),
      qualification: pick([
        'M.Sc., B.Ed.',
        'M.A., B.Ed.',
        'B.Sc., B.Ed.',
        'B.Com',
        'MBA',
      ]),
      department,
      address: genAddress(),
      joiningDate: dateOnly(
        2015 + randInt(0, 9),
        randInt(5, 7),
        randInt(1, 28)
      ),
    });
  };
  for (let i = 1; i <= 45; i++) {
    pushStaff(
      'teacher',
      `${pick(i % 2 ? MALE_NAMES : FEMALE_NAMES)} ${pick(SURNAMES)}`,
      'CLASS_TEACHER',
      'Class Teacher',
      'Teaching Staff'
    );
  }
  for (const t of SUBJECT_TEACHERS) {
    pushStaff(
      'subject',
      t.name,
      'TEACHER',
      `${SUBJECTS.find((s) => s.code === t.subject)?.name} Teacher`,
      'Teaching Staff'
    );
  }
  for (const s of NON_TEACHING) {
    pushStaff('staff', s.name, s.role, s.designation, s.department);
  }
  await p.user.createMany({ data: staffUsers, skipDuplicates: true });
  await p.membership.createMany({ data: staffMems, skipDuplicates: true });
  await p.staffProfile.createMany({
    data: staffProfiles,
    skipDuplicates: true,
  });

  // class teacher membership id per (class index, section index): teacher001..teacher045
  const classTeacherMem = (g: number, s: number) =>
    `seed_mem_teacher${pad(g * 3 + s + 1, 3)}`;
  // subject teacher membership per subject code (round-robin over pool);
  // subject teachers occupy global staff seq 46..75, so their ids are subject046..subject075
  const subjectTeacherPool = (code: string) =>
    SUBJECT_TEACHERS.map((t, i) => ({
      code: t.subject,
      memId: `seed_mem_subject${pad(46 + i, 3)}`,
    })).filter((t) => t.code === code);

  // ── class assignments (one class teacher per section, never reused) ──
  const classAssignments: Prisma.ClassAssignmentCreateManyInput[] = [];
  for (let g = 0; g < CLASS_NAMES.length; g++) {
    for (let s = 0; s < 3; s++) {
      classAssignments.push({
        id: `seed_ca_g${pad(g, 2)}_${SECTION_LETTERS[s].toLowerCase()}`,
        schoolId: SCHOOL_ID,
        classId: classes2526[g].id,
        teacherMembershipId: classTeacherMem(g, s),
        role: 'PRIMARY',
        status: 'ACTIVE',
      });
    }
  }
  await p.classAssignment.createMany({
    data: classAssignments,
    skipDuplicates: true,
  });

  // Same class teachers are carried into the 2026-2027 year so the current
  // year's classes have a PRIMARY assignment (student profile shows "—"
  // otherwise). Re-seeding is idempotent (skipDuplicates).
  const classAssignments2627: Prisma.ClassAssignmentCreateManyInput[] = [];
  for (let g = 0; g < CLASS_NAMES.length; g++) {
    for (let s = 0; s < 3; s++) {
      classAssignments2627.push({
        id: `seed_ca_2627_g${pad(g, 2)}_${SECTION_LETTERS[s].toLowerCase()}`,
        schoolId: SCHOOL_ID,
        classId: classes2627[g].id,
        teacherMembershipId: classTeacherMem(g, s),
        role: 'PRIMARY',
        status: 'ACTIVE',
      });
    }
  }
  await p.classAssignment.createMany({
    data: classAssignments2627,
    skipDuplicates: true,
  });

  // ── subjects ──
  const subjects: Prisma.SubjectCreateManyInput[] = SUBJECTS.map((s) => ({
    id: `seed_sub_${s.code.toLowerCase()}`,
    schoolId: SCHOOL_ID,
    name: s.name,
    code: s.code,
    description: `${s.name} subject`,
    isActive: true,
  }));
  await p.subject.createMany({ data: subjects, skipDuplicates: true });
  const subjectId = (code: string) => `seed_sub_${code.toLowerCase()}`;

  // ── students ──
  const studentUsers: Prisma.UserCreateManyInput[] = [];
  const studentMems: Prisma.MembershipCreateManyInput[] = [];
  const students: Prisma.StudentCreateManyInput[] = [];
  const enrollments: Prisma.EnrollmentCreateManyInput[] = [];
  const legacyEnrollments: Prisma.StudentEnrollmentCreateManyInput[] = [];
  const guardians: Prisma.GuardianCreateManyInput[] = [];
  const studentGuardians: Prisma.StudentGuardianCreateManyInput[] = [];
  const historicalEnrollments: Prisma.EnrollmentCreateManyInput[] = [];
  const historicalLegacy: Prisma.StudentEnrollmentCreateManyInput[] = [];
  const siblingUpdates: { id: string; siblings: Prisma.InputJsonValue }[] = [];

  let seq = 0;
  let phone = 9000000000;
  let gPhone = 9001000000;
  const ageForGrade = (g: number) => g + 3; // Pre-KG: 3, Grade 12: 17

  // section student counts: KG 14/13/13, others 40
  const secCount = (g: number, s: number) => (g <= 2 ? [14, 13, 13][s] : 40);
  // gender split per section: KG A 7M/7F, B 7M/6F, C 6M/7F; grades 25M/15F
  const boysInSec = (g: number, s: number) => (g <= 2 ? [7, 7, 6][s] : 25);

  // per-grade student id holders (for sibling pairing)
  const gradeStudentRefs: {
    id: string;
    name: string;
    admission: string;
    gender: string;
    className: string;
    age: number;
  }[][] = CLASS_NAMES.map(() => []);

  for (let g = 0; g < CLASS_NAMES.length; g++) {
    for (let s = 0; s < 3; s++) {
      const total = secCount(g, s);
      const boys = boysInSec(g, s);
      for (let r = 0; r < total; r++) {
        seq++;
        const gender = r < boys ? 'Male' : 'Female';
        const firstName =
          gender === 'Male' ? pick(MALE_NAMES) : pick(FEMALE_NAMES);
        const lastName = pick(SURNAMES);
        const fullName = `${firstName} ${lastName}`;
        const admissionNo = `ADM${pad(seq, 6)}`;
        const stuId = `seed_stu_${pad(seq, 6)}`;
        const userId = `seed_user_s${pad(seq, 6)}`;
        const memId = `seed_mem_s${pad(seq, 6)}`;
        const birthYear = 2025 - ageForGrade(g);
        const age = ageForGrade(g);
        const className = CLASS_NAMES[g];
        const isHistorical = seq % 3 === 0; // ~30% with 2024-2025 history

        phone++;
        studentUsers.push({
          id: userId,
          name: fullName,
          email: `seed.student${pad(seq, 6)}@easystem.dev`,
          emailVerified: true,
          status: 'active',
          phone: String(phone),
        });
        studentMems.push({
          id: memId,
          schoolId: SCHOOL_ID,
          userId,
          role: 'STUDENT',
          status: 'ACTIVE',
        });
        students.push({
          id: stuId,
          schoolId: SCHOOL_ID,
          userId,
          admissionNumber: admissionNo,
          firstName,
          lastName,
          dateOfBirth: dateOnly(birthYear, randInt(1, 12), randInt(1, 28)),
          gender,
          bloodGroup: pick(BLOOD_GROUPS),
          admissionDate: isHistorical
            ? dateOnly(2024, randInt(4, 6), randInt(1, 28))
            : dateOnly(2025, randInt(5, 7), randInt(1, 28)),
          phone: String(phone),
          address: genAddress(),
          siblings: [],
          status: 'ACTIVE',
          isDeleted: false,
        });

        // guardians: father (primary) + mother
        gPhone++;
        const fatherId = `seed_gdn_${pad(seq, 6)}_f`;
        const motherId = `seed_gdn_${pad(seq, 6)}_m`;
        guardians.push({
          id: fatherId,
          schoolId: SCHOOL_ID,
          firstName: pick(MALE_NAMES),
          lastName,
          relationship: 'FATHER',
          phone: String(gPhone),
          email: `father.${pad(seq, 6)}@example.com`,
          address: genAddress(),
          isActive: true,
        });
        gPhone++;
        guardians.push({
          id: motherId,
          schoolId: SCHOOL_ID,
          firstName: pick(FEMALE_NAMES),
          lastName,
          relationship: 'MOTHER',
          phone: String(gPhone),
          email: `mother.${pad(seq, 6)}@example.com`,
          address: genAddress(),
          isActive: true,
        });
        studentGuardians.push({
          id: `seed_sg_${pad(seq, 6)}_f`,
          studentId: stuId,
          guardianId: fatherId,
          isPrimary: true,
        });
        studentGuardians.push({
          id: `seed_sg_${pad(seq, 6)}_m`,
          studentId: stuId,
          guardianId: motherId,
          isPrimary: false,
        });

        // enrollment (2025-2026, ACTIVE) + legacy mirror
        const joinedAt = dateOnly(2025, randInt(6, 7), randInt(1, 31));
        const roll = String(r + 1);
        enrollments.push({
          id: `seed_enr_${pad(seq, 6)}`,
          schoolId: SCHOOL_ID,
          studentId: stuId,
          academicYearId: ay2526.id,
          classId: classes2526[g].id,
          sectionId: sectionId('2526', g, s),
          rollNumber: roll,
          status: 'ACTIVE',
          joinedAt,
        });
        legacyEnrollments.push({
          id: `seed_se_${pad(seq, 6)}`,
          studentId: stuId,
          academicYearId: ay2526.id,
          classId: classes2526[g].id,
          sectionId: sectionId('2526', g, s),
          rollNumber: roll,
          status: 'ACTIVE',
          enrolledAt: joinedAt,
        });

        // historical enrollment (2024-2025) for ~30%
        if (isHistorical) {
          const hJoined = dateOnly(2024, randInt(4, 6), randInt(1, 28));
          const hRoll = String(((seq % 120) % 40) + 1);
          const hClass = classes2425[g].id;
          const hSection = sectionId('2425', g, seq % 3);
          historicalEnrollments.push({
            id: `seed_enr_h_${pad(seq, 6)}`,
            schoolId: SCHOOL_ID,
            studentId: stuId,
            academicYearId: ay2425.id,
            classId: hClass,
            sectionId: hSection,
            rollNumber: hRoll,
            status: 'PROMOTED',
            joinedAt: hJoined,
            leftAt: dateOnly(2025, 3, randInt(20, 31)),
          });
          historicalLegacy.push({
            id: `seed_se_h_${pad(seq, 6)}`,
            studentId: stuId,
            academicYearId: ay2425.id,
            classId: hClass,
            sectionId: hSection,
            rollNumber: hRoll,
            status: 'PROMOTED',
            enrolledAt: hJoined,
            leftAt: dateOnly(2025, 3, randInt(20, 31)),
          });
        }

        gradeStudentRefs[g].push({
          id: stuId,
          name: fullName,
          admission: admissionNo,
          gender,
          className,
          age,
        });
      }
    }
  }
  const totalStudents = seq;

  await p.user.createMany({ data: studentUsers, skipDuplicates: true });
  await p.membership.createMany({ data: studentMems, skipDuplicates: true });
  await p.student.createMany({ data: students, skipDuplicates: true });
  await p.guardian.createMany({ data: guardians, skipDuplicates: true });
  await p.studentGuardian.createMany({
    data: studentGuardians,
    skipDuplicates: true,
  });
  await p.enrollment.createMany({
    data: [...enrollments, ...historicalEnrollments],
    skipDuplicates: true,
  });
  await p.studentEnrollment.createMany({
    data: [...legacyEnrollments, ...historicalLegacy],
    skipDuplicates: true,
  });

  // ── siblings: ~15% of students (pairs across adjacent grades) ──
  const pairCount = Math.round(totalStudents * 0.15) / 2;
  let pairs = 0;
  const used = new Set<string>();
  for (let i = 0; i < pairCount && pairs < 117; i++) {
    const gA = i % 14;
    const gB = gA + 1;
    const a = gradeStudentRefs[gA].find((x) => !used.has(x.id));
    if (!a) continue;
    used.add(a.id);
    const b = gradeStudentRefs[gB].find((x) => !used.has(x.id));
    if (!b) continue;
    used.add(b.id);
    pairs++;
    const relForA = b.gender === 'Male' ? 'Brother' : 'Sister';
    const relForB = a.gender === 'Male' ? 'Brother' : 'Sister';
    siblingUpdates.push({
      id: a.id,
      siblings: [
        {
          name: b.name,
          admissionNo: b.admission,
          age: b.age,
          gender: b.gender,
          className: b.className,
          relationship: relForA,
          schoolName: 'EA Public School',
          notes: 'Same school, different grade',
        },
      ],
    });
    siblingUpdates.push({
      id: b.id,
      siblings: [
        {
          name: a.name,
          admissionNo: a.admission,
          age: a.age,
          gender: a.gender,
          className: a.className,
          relationship: relForB,
          schoolName: 'EA Public School',
          notes: 'Same school, different grade',
        },
      ],
    });
  }
  for (const u of siblingUpdates) {
    await p.student.update({
      where: { id: u.id },
      data: { siblings: u.siblings as Prisma.InputJsonValue },
    });
  }

  // ── attendance: sessions + records for last 30 school days (Mon–Sat) ──
  const now = new Date();
  const todayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const schoolDays: Date[] = [];
  for (let day = todayUTC - 86400000; schoolDays.length < 30; day -= 86400000) {
    const d = new Date(day);
    if (d.getUTCDay() !== 0) schoolDays.push(d);
  }
  schoolDays.reverse();

  const sessions: Prisma.AttendanceSessionCreateManyInput[] = [];
  const attRecords: Prisma.AttendanceRecordCreateManyInput[] = [];
  let attSeq = 0;
  let sessSeq = 0;
  for (let g = 0; g < CLASS_NAMES.length; g++) {
    for (let s = 0; s < 3; s++) {
      const teacherMem = classTeacherMem(g, s);
      for (const day of schoolDays) {
        sessSeq++;
        sessions.push({
          id: `seed_ats_${pad(sessSeq, 6)}`,
          schoolId: SCHOOL_ID,
          classId: classes2526[g].id,
          sectionId: sectionId('2526', g, s),
          teacherId: teacherMem,
          type: 'MORNING',
          status: 'CLOSED',
          openedAt: new Date(day.getTime() + 8 * 3600000 + 45 * 60000),
          closedAt: new Date(day.getTime() + 9 * 3600000 + 30 * 60000),
          createdBy: admin.id,
        });
      }
    }
  }
  // records per student per day
  const studentsBySection: { [key: string]: { id: string; memId: string }[] } =
    {};
  for (let g = 0; g < CLASS_NAMES.length; g++) {
    for (let s = 0; s < 3; s++) {
      studentsBySection[`${g}:${s}`] = [];
    }
  }
  {
    let sq = 0;
    for (let g = 0; g < CLASS_NAMES.length; g++) {
      for (let s = 0; s < 3; s++) {
        const total = secCount(g, s);
        for (let r = 0; r < total; r++) {
          sq++;
          studentsBySection[`${g}:${s}`].push({
            id: `seed_stu_${pad(sq, 6)}`,
            memId: `seed_mem_s${pad(sq, 6)}`,
          });
        }
      }
    }
  }
  for (const day of schoolDays) {
    for (let g = 0; g < CLASS_NAMES.length; g++) {
      for (let s = 0; s < 3; s++) {
        const teacherMem = classTeacherMem(g, s);
        for (const st of studentsBySection[`${g}:${s}`]) {
          const r = rand();
          const status = r < 0.9 ? 'PRESENT' : r < 0.97 ? 'ABSENT' : 'EXCUSED';
          attSeq++;
          attRecords.push({
            id: `seed_att_${pad(attSeq, 6)}`,
            schoolId: SCHOOL_ID,
            classId: classes2526[g].id,
            studentMembershipId: st.memId,
            date: new Date(day),
            status: status as Prisma.AttendanceRecordCreateManyInput['status'],
            markedByMembershipId: teacherMem,
            markedAt: new Date(day.getTime() + 9 * 3600000),
          });
        }
      }
    }
  }
  for (let i = 0; i < sessions.length; i += 2000)
    await p.attendanceSession.createMany({
      data: sessions.slice(i, i + 2000),
      skipDuplicates: true,
    });
  for (let i = 0; i < attRecords.length; i += 2000)
    await p.attendanceRecord.createMany({
      data: attRecords.slice(i, i + 2000),
      skipDuplicates: true,
    });

  // ── subject assignments (per section × grade subjects) ──
  const subjectAssignments: Prisma.SubjectAssignmentCreateManyInput[] = [];
  let saSeq = 0;
  const teacherForSectionSubject: { [key: string]: string } = {}; // `${g}:${s}:${code}` -> membership id
  for (let g = 0; g < CLASS_NAMES.length; g++) {
    for (let s = 0; s < 3; s++) {
      for (const code of GRADE_SUBJECTS[g]) {
        const pool = subjectTeacherPool(code);
        const teacher = pool[s % pool.length].memId;
        saSeq++;
        subjectAssignments.push({
          id: `seed_sa_${pad(saSeq, 6)}`,
          schoolId: SCHOOL_ID,
          subjectId: subjectId(code),
          academicYearId: ay2526.id,
          classId: classes2526[g].id,
          sectionId: sectionId('2526', g, s),
          teacherMembershipId: teacher,
          status: 'ACTIVE',
        });
        teacherForSectionSubject[`${g}:${s}:${code}`] = teacher;
      }
    }
  }
  await p.subjectAssignment.createMany({
    data: subjectAssignments,
    skipDuplicates: true,
  });

  // ── timetables (per section, Mon–Sat, 7 periods) ──
  const timetables: Prisma.TimetableCreateManyInput[] = [];
  let ttSeq = 0;
  const PERIODS: { start: string; end: string }[] = [
    { start: '09:00', end: '09:45' },
    { start: '09:45', end: '10:30' },
    { start: '10:30', end: '11:15' },
    { start: '11:15', end: '12:00' },
    { start: '12:00', end: '12:45' },
    { start: '13:30', end: '14:15' },
    { start: '14:15', end: '15:00' },
  ];
  for (let g = 0; g < CLASS_NAMES.length; g++) {
    for (let s = 0; s < 3; s++) {
      const subjCodes = GRADE_SUBJECTS[g];
      for (let day = 1; day <= 6; day++) {
        for (let period = 0; period < PERIODS.length; period++) {
          const code = subjCodes[(period + day * 3) % subjCodes.length];
          ttSeq++;
          timetables.push({
            id: `seed_tt_${pad(ttSeq, 6)}`,
            schoolId: SCHOOL_ID,
            classId: classes2526[g].id,
            sectionId: sectionId('2526', g, s),
            subjectId: subjectId(code),
            teacherId:
              teacherForSectionSubject[`${g}:${s}:${code}`] ||
              classTeacherMem(g, s),
            dayOfWeek: day,
            startTime: PERIODS[period].start,
            endTime: PERIODS[period].end,
            roomNo: `${pad(g + 1, 2)}-${SECTION_LETTERS[s]}`,
          });
        }
      }
    }
  }
  for (let i = 0; i < timetables.length; i += 2000)
    await p.timetable.createMany({
      data: timetables.slice(i, i + 2000),
      skipDuplicates: true,
    });

  // ── exams ──
  const exams: Prisma.ExamCreateManyInput[] = [];
  const results: Prisma.ExamResultCreateManyInput[] = [];
  let exSeq = 0;
  let resSeq = 0;
  const EXAM_BASES = [
    dateOnly(2025, 9, 15),
    dateOnly(2025, 12, 8),
    dateOnly(2026, 3, 9),
  ];
  for (let g = 0; g < CLASS_NAMES.length; g++) {
    const maxMarks = g <= 2 ? 50 : 100;
    const passMarks = g <= 2 ? 18 : 35;
    for (let s = 0; s < 3; s++) {
      for (const code of GRADE_SUBJECTS[g]) {
        for (let t = 0; t < 3; t++) {
          exSeq++;
          const examDate = new Date(
            EXAM_BASES[t].getTime() + ((g * 3 + s) % 10) * 86400000
          );
          exams.push({
            id: `seed_exm_${pad(exSeq, 6)}`,
            schoolId: SCHOOL_ID,
            name: EXAM_NAMES[t],
            academicYearId: ay2526.id,
            termId: terms[t].id,
            classId: classes2526[g].id,
            sectionId: sectionId('2526', g, s),
            subjectId: subjectId(code),
            maxMarks,
            passMarks,
            examDate,
            status: 'COMPLETED',
          });
        }
      }
    }
  }
  // recompute exact student seq per section for results
  {
    let sq = 0;
    const seqBySection: { [key: string]: number[] } = {};
    for (let g = 0; g < CLASS_NAMES.length; g++) {
      for (let s = 0; s < 3; s++) {
        const total = secCount(g, s);
        seqBySection[`${g}:${s}`] = [];
        for (let r = 0; r < total; r++) {
          sq++;
          seqBySection[`${g}:${s}`].push(sq);
        }
      }
    }
    let ex = 0;
    for (let g = 0; g < CLASS_NAMES.length; g++) {
      const maxMarks = g <= 2 ? 50 : 100;
      const passMarks = g <= 2 ? 18 : 35;
      for (let s = 0; s < 3; s++) {
        for (const code of GRADE_SUBJECTS[g]) {
          for (let t = 0; t < 3; t++) {
            ex++;
            const examId = `seed_exm_${pad(ex, 6)}`;
            for (const sqN of seqBySection[`${g}:${s}`]) {
              const rv = rand();
              const marks =
                rv < 0.06
                  ? randInt(8, passMarks - 1)
                  : randInt(passMarks + 2, maxMarks);
              resSeq++;
              const pct = (marks / maxMarks) * 100;
              const grade =
                pct >= 90
                  ? 'A+'
                  : pct >= 80
                    ? 'A'
                    : pct >= 70
                      ? 'B+'
                      : pct >= 60
                        ? 'B'
                        : pct >= 50
                          ? 'C'
                          : pct >= 35
                            ? 'D'
                            : 'F';
              results.push({
                id: `seed_res_${pad(resSeq, 6)}`,
                schoolId: SCHOOL_ID,
                examId,
                studentId: `seed_stu_${pad(sqN, 6)}`,
                marksObtained: marks,
                grade,
              });
            }
          }
        }
      }
    }
  }
  for (let i = 0; i < exams.length; i += 2000)
    await p.exam.createMany({
      data: exams.slice(i, i + 2000),
      skipDuplicates: true,
    });
  for (let i = 0; i < results.length; i += 2000)
    await p.examResult.createMany({
      data: results.slice(i, i + 2000),
      skipDuplicates: true,
    });

  // ── settings / misc ──
  await p.schoolSettings.create({
    data: {
      id: 'seed_school_settings',
      schoolId: SCHOOL_ID,
      attendanceStart: '09:00',
      attendanceEnd: '15:00',
      language: 'en',
      academicYearStart: dateOnly(2025, 4, 1),
      academicYearEnd: dateOnly(2026, 3, 31),
      gradingSystem: 'CGPA',
      schoolType: 'Private',
      grades: CLASS_NAMES as unknown as Prisma.InputJsonValue,
    },
  });
  await p.attendanceSettings.create({
    data: {
      id: 'seed_att_settings',
      schoolId: SCHOOL_ID,
      allowFutureAttendance: false,
      maxFutureDays: 0,
      correctionAfterClose: true,
      duplicatePolicy: 'idempotent',
      autoCloseSessions: false,
      autoCloseAfterHours: 24,
    },
  });
  const reasons = [
    {
      id: 'seed_reason_leave',
      name: 'Casual Leave',
      category: 'LEAVE' as const,
    },
    {
      id: 'seed_reason_medical',
      name: 'Medical Leave',
      category: 'LEAVE' as const,
    },
    {
      id: 'seed_reason_family',
      name: 'Family Function',
      category: 'OTHER' as const,
    },
  ];
  await p.attendanceReason.createMany({
    data: reasons.map((r) => ({ ...r, schoolId: SCHOOL_ID, isActive: true })),
    skipDuplicates: true,
  });
  const scales = [
    { name: 'A+', minPercent: 90, maxPercent: 100, grade: 'A+', gpa: 9.0 },
    { name: 'A', minPercent: 80, maxPercent: 89.99, grade: 'A', gpa: 8.0 },
    { name: 'B+', minPercent: 70, maxPercent: 79.99, grade: 'B+', gpa: 7.0 },
    { name: 'B', minPercent: 60, maxPercent: 69.99, grade: 'B', gpa: 6.0 },
    { name: 'C', minPercent: 50, maxPercent: 59.99, grade: 'C', gpa: 5.0 },
    { name: 'D', minPercent: 35, maxPercent: 49.99, grade: 'D', gpa: 4.0 },
    { name: 'F', minPercent: 0, maxPercent: 34.99, grade: 'F', gpa: 0.0 },
  ];
  await p.gradeScale.createMany({
    data: scales.map((s, i) => ({
      id: `seed_scale_${i + 1}`,
      schoolId: SCHOOL_ID,
      name: s.name,
      minPercent: s.minPercent,
      maxPercent: s.maxPercent,
      grade: s.grade,
      gpa: s.gpa,
    })),
    skipDuplicates: true,
  });
  let plan = await p.plan.findUnique({ where: { name: 'School' } });
  if (!plan) {
    plan = await p.plan.create({
      data: {
        id: 'seed_plan',
        name: 'School',
        studentLimit: 5000,
        staffLimit: 500,
        priceMonthly: 0,
        modules: ['all'],
      },
    });
  }
  await p.subscription.upsert({
    where: { schoolId: SCHOOL_ID },
    create: {
      id: 'seed_subscription',
      schoolId: SCHOOL_ID,
      planId: plan.id,
      status: 'ACTIVE',
      studentLimit: 5000,
      staffLimit: 500,
      expiresAt: dateOnly(2027, 3, 31),
    },
    update: { status: 'ACTIVE', planId: plan.id },
  });

  /* ───────────────────────── summary ───────────────────────── */
  const counts = {
    schools: await p.school.count({ where: { id: SCHOOL_ID } }),
    academicYears: await p.academicYear.count({
      where: { schoolId: SCHOOL_ID },
    }),
    classes: await p.class.count({ where: { schoolId: SCHOOL_ID } }),
    sections: await p.section.count({ where: { schoolId: SCHOOL_ID } }),
    students: await p.student.count({
      where: { schoolId: SCHOOL_ID, isDeleted: false },
    }),
    activeEnrollments: await p.enrollment.count({
      where: { schoolId: SCHOOL_ID, status: 'ACTIVE' },
    }),
    historicalEnrollments: await p.enrollment.count({
      where: { schoolId: SCHOOL_ID, status: 'PROMOTED' },
    }),
    staff: await p.staffProfile.count({ where: { schoolId: SCHOOL_ID } }),
    classAssignments: await p.classAssignment.count({
      where: { schoolId: SCHOOL_ID, status: 'ACTIVE' },
    }),
    subjects: await p.subject.count({ where: { schoolId: SCHOOL_ID } }),
    subjectAssignments: await p.subjectAssignment.count({
      where: { schoolId: SCHOOL_ID },
    }),
    timetables: await p.timetable.count({ where: { schoolId: SCHOOL_ID } }),
    attendanceSessions: await p.attendanceSession.count({
      where: { schoolId: SCHOOL_ID },
    }),
    attendanceRecords: await p.attendanceRecord.count({
      where: { schoolId: SCHOOL_ID },
    }),
    exams: await p.exam.count({ where: { schoolId: SCHOOL_ID } }),
    examResults: await p.examResult.count({ where: { schoolId: SCHOOL_ID } }),
    guardians: await p.guardian.count({ where: { schoolId: SCHOOL_ID } }),
  };

  const withoutEnrollment = await p.student.count({
    where: {
      schoolId: SCHOOL_ID,
      isDeleted: false,
      enrollmentRecords: { none: { status: 'ACTIVE' } },
    },
  });
  const sectionsWithoutTeacher = await p.section.count({
    where: {
      schoolId: SCHOOL_ID,
      status: 'ACTIVE',
      class: {
        academicYearId: 'seed_ay_2526',
        assignments: { none: { status: 'ACTIVE' } },
      },
    },
  });

  const rows = Object.entries(counts).map(
    ([k, v]) => `│ ${k.padEnd(24)} ${String(v).padStart(9)}  │`
  );
  const width = rows[0]?.length ?? 0;
  const bar = '─'.repeat(width - 2);
  console.log(`┌${bar}┐`);
  console.log(`│${'EA Public School — development seed'.padEnd(width - 2)}│`);
  console.log(`├${bar}┤`);
  for (const r of rows) console.log(r);
  console.log(`├${bar}┤`);
  const check = (ok: boolean, label: string) =>
    `│ ${label.padEnd(35)} ${ok ? 'PASS' : 'FAIL'}  │`;
  console.log(
    check(withoutEnrollment === 0, 'students WITHOUT active enrollment')
  );
  console.log(
    check(sectionsWithoutTeacher === 0, 'ACTIVE sections WITHOUT class teacher')
  );
  console.log(
    check(
      pairs * 2 === Math.round(totalStudents * 0.15),
      `sibling students (${pairs * 2} ≈ 15%)`
    )
  );
  console.log(`└${bar}┘`);

  if (withoutEnrollment > 0 || sectionsWithoutTeacher > 0) {
    throw new Error('Seed integrity check failed');
  }
}

async function main() {
  console.log('Seeding EA System development database...');
  await wipe();
  console.log('Wiped previous seed-managed data.');
  await seed();
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
