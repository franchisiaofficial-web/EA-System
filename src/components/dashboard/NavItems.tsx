import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, BookOpen, CheckSquare, GraduationCap,
  HeartPulse, AlertCircle, FileText, Building2, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  disabled?: boolean;
  tooltip?: string;
  iconColor?: string;
}

// School-level navigation
const SCHOOL_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: [], iconColor: 'text-cli-blue' },
  { label: 'Attendance', href: '/dashboard/academics/attendance', icon: CheckSquare, roles: ['SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'], iconColor: 'text-muted-foreground' },
  { label: 'Attendance', href: '/dashboard/teacher/attendance', icon: CheckSquare, roles: ['TEACHER', 'CLASS_TEACHER'], iconColor: 'text-muted-foreground' },
  { label: 'Attendance', href: '/dashboard/student/attendance', icon: CheckSquare, roles: ['STUDENT'], iconColor: 'text-muted-foreground' },
  { label: 'Students', href: '/dashboard/academics/students', icon: Users, roles: ['SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'CLASS_TEACHER'], iconColor: 'text-muted-foreground' },
  { label: 'Academics', href: '/dashboard/academics', icon: BookOpen, roles: ['SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'], iconColor: 'text-muted-foreground' },
  { label: 'Staff', href: '/dashboard/staff', icon: GraduationCap, roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'HR'], iconColor: 'text-muted-foreground' },
];

// Platform-operations navigation (Super Admin only)
const SUPER_ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: [], iconColor: 'text-cli-blue' },
  { label: 'School Management', href: '/dashboard/super-admin/schools', icon: Building2, roles: ['SUPER_ADMIN'], iconColor: 'text-muted-foreground' },
  { label: 'Platform Health', href: '/dashboard/super-admin/platform-health', icon: HeartPulse, roles: ['SUPER_ADMIN'], iconColor: 'text-muted-foreground' },
  { label: 'Error Logs', href: '/dashboard/super-admin/error-logs', icon: AlertCircle, roles: ['SUPER_ADMIN'], iconColor: 'text-muted-foreground' },
  { label: 'Audit Logs', href: '/dashboard/super-admin/audit-logs', icon: FileText, roles: ['SUPER_ADMIN'], iconColor: 'text-muted-foreground' },
];

function getNavForRole(role: string): NavItem[] {
  if (role === 'SUPER_ADMIN') return SUPER_ADMIN_NAV;
  return SCHOOL_NAV;
}

export function NavItems({ role, onItemClick }: { role: string; onItemClick?: () => void }) {
  const pathname = usePathname();
  const items = getNavForRole(role);
  const visibleItems = items.filter((item) => item.roles.length === 0 || item.roles.includes(role));

  return (
    <nav className="p-3 space-y-1">
      {visibleItems.map((item) => {
        const isActive = item.disabled ? false : item.href === '/dashboard' ? pathname === '/dashboard' : pathname === item.href || pathname.startsWith(item.href + '/');

        if (item.disabled) {
          return (
            <div key={item.href} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-mono text-muted-foreground/50 cursor-not-allowed" title={item.tooltip || 'In Development'}>
              <item.icon className={cn("h-4 w-4 shrink-0", item.iconColor || "text-muted-foreground")} />
              {item.label}
              <Lock className="h-3 w-3 ml-auto shrink-0" />
            </div>
          );
        }

        return (
          <Link key={item.href} href={item.href} onClick={onItemClick}
            className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-mono transition-all duration-150 border-l-2',
              isActive ? 'bg-muted border-cli-blue text-cli-blue font-semibold' : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted')}>
            <item.icon className={cn("h-4 w-4 shrink-0", item.iconColor || "text-muted-foreground")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
