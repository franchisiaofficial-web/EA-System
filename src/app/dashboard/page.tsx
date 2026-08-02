import { getAuthContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');

  const role = authCtx.role;

  // Role-specific dashboards that exist
  const rolePages: Record<string, string> = {
    SUPER_ADMIN: '/dashboard/super-admin',
    SCHOOL_ADMIN: '/dashboard/admin',
    PRINCIPAL: '/dashboard/principal',
    VICE_PRINCIPAL: '/dashboard/vice-principal',
    TEACHER: '/dashboard/teacher',
    CLASS_TEACHER: '/dashboard/teacher',
    STUDENT: '/dashboard/student',
    PARENT: '/dashboard/parent',
    ACCOUNTANT: '/dashboard/accountant',
    HR: '/dashboard/hr',
    TRANSPORT_MANAGER: '/dashboard/transport',
    DRIVER: '/dashboard/driver',
    LIBRARIAN: '/dashboard/library',
    NON_TEACHING: '/dashboard/staff',
    CAFETERIA_STAFF: '/dashboard/staff',
  };

  const target = rolePages[role] || '/dashboard/academics/students';
  redirect(target);
}
