import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { TermList } from './TermList';

export default async function TermsListPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  const allowed = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];
  if (!allowed.includes(authCtx.role)) redirect('/login');
  return (
    <TermList
      canCreate={hasPermission(authCtx.role, 'terms', 'create')}
      canUpdate={hasPermission(authCtx.role, 'terms', 'update')}
      canArchive={hasPermission(authCtx.role, 'terms', 'delete')}
    />
  );
}
