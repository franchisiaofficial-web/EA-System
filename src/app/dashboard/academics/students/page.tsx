import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { StudentList } from './StudentList';

export default async function StudentListPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  if (!hasPermission(authCtx.role, 'students', 'read')) redirect('/login');
  return <StudentList canCreate={hasPermission(authCtx.role, 'students', 'create')} canUpdate={hasPermission(authCtx.role, 'students', 'update')} canArchive={hasPermission(authCtx.role, 'students', 'delete')} />;
}
