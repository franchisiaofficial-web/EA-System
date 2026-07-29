import { getAuthContext } from '@/lib/auth/context';
import { redirect, notFound } from 'next/navigation';
import { CrudDemoList } from './CrudDemoList';

export default async function CrudDemoListPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(authCtx.role)) notFound();

  return <CrudDemoList />;
}
