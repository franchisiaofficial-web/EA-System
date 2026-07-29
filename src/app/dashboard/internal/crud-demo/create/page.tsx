import { getAuthContext } from '@/lib/auth/context';
import { redirect, notFound } from 'next/navigation';
import { CrudDemoForm } from '../CrudDemoForm';

export default async function CrudDemoCreatePage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(authCtx.role)) notFound();

  return <CrudDemoForm />;
}
