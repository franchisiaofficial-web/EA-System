import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';

const ALLOWED = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'];

export default async function AcademicsLayout({ children }: { children: React.ReactNode }) {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  if (!ALLOWED.includes(authCtx.role)) redirect('/login');
  return <>{children}</>;
}
