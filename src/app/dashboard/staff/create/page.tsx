import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { StaffCreateForm } from './StaffCreateForm';

export default async function StaffCreatePage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  const allowed = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HR'];
  if (!allowed.includes(authCtx.role)) redirect('/login');
  if (!hasPermission(authCtx.role, 'teachers', 'create')) redirect('/dashboard/staff');
  return <StaffCreateForm />;
}
