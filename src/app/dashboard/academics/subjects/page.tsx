import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { SubjectList } from './SubjectList';

export default async function SubjectListPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  const allowed = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];
  if (!allowed.includes(authCtx.role)) redirect('/login');
  return (
    <SubjectList
      canCreate={hasPermission(authCtx.role, 'subjects', 'create')}
      canUpdate={hasPermission(authCtx.role, 'subjects', 'update')}
      canArchive={hasPermission(authCtx.role, 'subjects', 'delete')}
    />
  );
}
