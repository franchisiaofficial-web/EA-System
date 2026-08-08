import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { StaffCreateForm } from './StaffCreateForm';

export default async function StaffCreatePage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  if (!hasPermission(authCtx.role, 'staff', 'create')) redirect('/dashboard/staff');
  return <StaffCreateForm />;
}
