import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { redirect, notFound } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { withRls } from '@/lib/prisma/rls-middleware';
import { StudentProfile } from './StudentProfile';

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  if (!hasPermission(authCtx.role, 'students', 'read')) redirect('/login');

  const rc = toRequestContext(authCtx);
  const student = await withRls(rc, async (tx) => tx.student.findUnique({
    where: { id, schoolId: authCtx.schoolId },
    include: {
      enrollmentRecords: {
        include: {
          academicYear: true,
          class: { include: { assignments: { where: { status: 'ACTIVE', role: 'PRIMARY' }, include: { teacherMembership: { include: { user: { select: { name: true } } } } }, take: 1 } } },
          section: true,
        },
        orderBy: { joinedAt: 'desc' },
      },
      passedOutRecords: {
        include: { finalAcademicYear: true, finalClass: true, finalSection: true },
        orderBy: { passedOutDate: 'desc' },
      },
      guardians: { include: { guardian: true } },
    },
  }));
  if (!student) notFound();

  const data = {
    id: student.id, firstName: student.firstName, lastName: student.lastName, admissionNumber: student.admissionNumber,
    dateOfBirth: student.dateOfBirth?.toISOString().split('T')[0] ?? null, gender: student.gender, phone: student.phone, address: student.address,
    bloodGroup: student.bloodGroup, admissionDate: student.admissionDate?.toISOString().split('T')[0] ?? null,
    status: student.status,
    siblings: Array.isArray(student.siblings) ? (student.siblings as Array<{ name: string; admissionNo?: string; age?: number; gender?: string; className?: string; relationship?: string; schoolName?: string; notes?: string; reason?: string }>) : [],
    enrollments: student.enrollmentRecords.map(e => ({
      id: e.id, rollNumber: e.rollNumber, status: e.status, enrolledAt: e.joinedAt.toISOString(),
      academicYear: e.academicYear.name, className: e.class.name, sectionName: e.section.name,
      classTeacher: e.class.assignments?.[0]?.teacherMembership?.user?.name ?? null,
    })),
    passedOut: student.passedOutRecords.map(p => ({
      id: p.id, batch: p.batch, passedOutDate: p.passedOutDate.toISOString(),
      graduationReason: p.graduationReason, finalAcademicYear: p.finalAcademicYear.name,
      finalClassName: p.finalClass?.name ?? null, finalSectionName: p.finalSection?.name ?? null,
      finalRollNumber: p.finalRollNumber,
    })),
    guardians: student.guardians.map(g => ({ id: g.guardian.id, firstName: g.guardian.firstName, lastName: g.guardian.lastName, relationship: g.guardian.relationship, phone: g.guardian.phone, isPrimary: g.isPrimary })),
  };

  return <StudentProfile data={data} canEdit={hasPermission(authCtx.role, 'students', 'update')} canArchive={hasPermission(authCtx.role, 'students', 'delete')} />;
}
