import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');
  return <DashboardShell authCtx={ctx}>{children}</DashboardShell>;
}
