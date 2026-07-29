import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { SectionList } from './SectionList';

export default async function SectionListPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  const allowed = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];
  if (!allowed.includes(authCtx.role)) redirect('/login');
  return (
    <SectionList
      canCreate={hasPermission(authCtx.role, 'sections', 'create')}
      canUpdate={hasPermission(authCtx.role, 'sections', 'update')}
      canArchive={hasPermission(authCtx.role, 'sections', 'delete')}
    />
  );
}
