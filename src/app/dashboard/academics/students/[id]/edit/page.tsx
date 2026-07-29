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
  }));
  if (!student) notFound();

  const data = {
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    admissionNumber: student.admissionNumber,
    dateOfBirth: student.dateOfBirth?.toISOString().split('T')[0] ?? '',
    gender: student.gender ?? '',
    phone: student.phone ?? '',
    address: student.address ?? '',
  };

  return <StudentEditForm data={data} />;
}
