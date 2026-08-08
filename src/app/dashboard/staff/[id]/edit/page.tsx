import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { StaffEditForm } from './StaffEditForm';

export default async function StaffEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  if (!hasPermission(authCtx.role, 'staff', 'update')) redirect('/dashboard/staff');
  return <StaffEditForm memberId={id} />;
}
