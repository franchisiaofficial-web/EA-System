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
      enrollments: { where: { isDeleted: false }, include: { academicYear: true, class: true, section: true }, orderBy: { enrolledAt: 'desc' } },
      guardians: { include: { guardian: true } },
    },
  }));
  if (!student) notFound();

  const data = {
    id: student.id, firstName: student.firstName, lastName: student.lastName, admissionNumber: student.admissionNumber,
    dateOfBirth: student.dateOfBirth?.toISOString().split('T')[0] ?? null, gender: student.gender, phone: student.phone, address: student.address,
    status: student.status,
    enrollments: student.enrollments.map(e => ({ id: e.id, rollNumber: e.rollNumber, status: e.status, enrolledAt: e.enrolledAt.toISOString(), academicYear: e.academicYear.name, className: e.class.name, sectionName: e.section.name })),
    guardians: student.guardians.map(g => ({ id: g.guardian.id, firstName: g.guardian.firstName, lastName: g.guardian.lastName, relationship: g.guardian.relationship, phone: g.guardian.phone, isPrimary: g.isPrimary })),
  };

  return <StudentProfile data={data} canEdit={hasPermission(authCtx.role, 'students', 'update')} canArchive={hasPermission(authCtx.role, 'students', 'delete')} />;
}
