import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { StaffList } from './StaffList';

export default async function StaffPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  if (!hasPermission(authCtx.role, 'staff', 'read')) redirect('/login');
  return (
    <StaffList
      canCreate={hasPermission(authCtx.role, 'staff', 'create')}
      canUpdate={hasPermission(authCtx.role, 'staff', 'update')}
      canArchive={hasPermission(authCtx.role, 'staff', 'archive')}
      canRestore={hasPermission(authCtx.role, 'staff', 'restore')}
      canDeactivate={hasPermission(authCtx.role, 'staff', 'deactivate')}
      canReactivate={hasPermission(authCtx.role, 'staff', 'reactivate')}
    />
  );
}
