import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { AcademicYearForm } from '../AcademicYearForm';

export default async function CreateAcademicYearPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');

  const allowed = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];
  if (!allowed.includes(authCtx.role)) redirect('/login');

  return <AcademicYearForm />;
}
