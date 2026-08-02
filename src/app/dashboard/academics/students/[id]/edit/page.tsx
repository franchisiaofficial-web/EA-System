import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { redirect, notFound } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { withRls } from '@/lib/prisma/rls-middleware';
import { StudentEditForm } from '../StudentEditForm';

export default async function StudentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  if (!hasPermission(authCtx.role, 'students', 'update')) redirect('/login');

  const rc = toRequestContext(authCtx);
  const student = await withRls(rc, async (tx) => tx.student.findUnique({
    where: { id, schoolId: authCtx.schoolId },
    include: {
      enrollmentRecords: { where: { status: 'ACTIVE' }, include: { academicYear: true, class: true, section: true }, orderBy: { joinedAt: 'desc' }, take: 1 },
      guardians: { include: { guardian: true }, take: 2 },
    },
  }));
  if (!student) notFound();

  const activeEnrollment = student.enrollmentRecords[0] ?? null;
  const primaryGuardian = student.guardians.find(g => g.isPrimary) ?? student.guardians[0] ?? null;
  const storedSiblings = Array.isArray(student.siblings) ? student.siblings as Array<Record<string, unknown>> : [];
  const firstSibling = storedSiblings[0] ?? null;

  const initialData = {
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    admissionNumber: student.admissionNumber,
    admissionDate: student.admissionDate?.toISOString().split('T')[0] ?? '',
    dateOfBirth: student.dateOfBirth?.toISOString().split('T')[0] ?? '',
    gender: student.gender ?? '',
    phone: student.phone ?? '',
    address: student.address ?? '',
    bloodGroup: student.bloodGroup ?? '',
    studentStatus: student.status ?? '',
    academicYearId: activeEnrollment?.academicYearId ?? student.academicYearId ?? '',
    classId: activeEnrollment?.classId ?? student.classId ?? '',
    sectionId: activeEnrollment?.sectionId ?? student.sectionId ?? '',
    rollNumber: activeEnrollment?.rollNumber ?? '',
    fatherName: '',
    fatherPhone: '',
    fatherOccupation: '',
    fatherEmail: '',
    motherName: '',
    motherPhone: '',
    motherOccupation: '',
    motherEmail: '',
    guardianName: primaryGuardian ? `${primaryGuardian.guardian.firstName} ${primaryGuardian.guardian.lastName}` : '',
    guardianPhone: primaryGuardian?.guardian.phone ?? '',
    guardianRelationship: primaryGuardian?.guardian.relationship ?? '',
    emergencyContactName: '',
    emergencyRelationship: '',
    emergencyPhone: '',
    siblingName: (firstSibling?.name as string) ?? '',
    siblingAdmissionNo: (firstSibling?.admissionNo as string) ?? '',
    siblingAge: firstSibling?.age != null ? String(firstSibling.age) : '',
    siblingGender: (firstSibling?.gender as string) ?? '',
    siblingRelationship: (firstSibling?.relationship as string) ?? '',
    siblingSchoolName: (firstSibling?.schoolName as string) ?? '',
    siblingNotes: (firstSibling?.notes as string) ?? '',
    siblingReason: (firstSibling?.reason as string) ?? '',
  };

  return <StudentEditForm initialData={initialData} />;
}
