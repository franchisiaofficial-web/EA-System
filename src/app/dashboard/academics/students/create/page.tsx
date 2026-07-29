import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { StudentForm } from '../StudentForm';

export default async function StudentCreatePage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  if (!hasPermission(authCtx.role, 'students', 'create')) redirect('/login');
  return <StudentForm />;
}
