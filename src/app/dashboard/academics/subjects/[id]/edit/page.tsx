import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { SubjectEditForm } from './SubjectEditForm';

export default async function SubjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  const allowed = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];
  if (!allowed.includes(authCtx.role)) redirect('/login');

  return (
    <SubjectEditForm
      subjectId={id}
      canUpdate={hasPermission(authCtx.role, 'subjects', 'update')}
      canAssign={hasPermission(authCtx.role, 'subjects', 'update')}
    />
  );
}
