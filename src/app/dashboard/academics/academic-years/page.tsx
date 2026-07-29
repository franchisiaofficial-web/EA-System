import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions/permissions';
import { AcademicYearList } from './AcademicYearList';

export default async function AcademicYearsPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');

  const allowed = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];
  if (!allowed.includes(authCtx.role)) redirect('/login');

  return (
    <AcademicYearList
      canCreate={hasPermission(authCtx.role, 'academic_years', 'create')}
      canUpdate={hasPermission(authCtx.role, 'academic_years', 'update')}
      canArchive={hasPermission(authCtx.role, 'academic_years', 'delete')}
    />
  );
}
