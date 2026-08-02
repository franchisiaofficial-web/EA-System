import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { StaffList } from './StaffList';

export default async function StaffPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  const allowed = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HR'];
  if (!allowed.includes(authCtx.role)) redirect('/login');
  return (
    <StaffList
      canCreate={hasPermission(authCtx.role, 'teachers', 'create')}
      canUpdate={hasPermission(authCtx.role, 'teachers', 'update')}
    />
  );
}
