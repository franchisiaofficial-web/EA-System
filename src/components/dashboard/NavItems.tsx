import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CheckSquare,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: [] },
  {
    label: 'Attendance',
    href: '/dashboard/teacher/attendance',
    icon: CheckSquare,
    roles: ['TEACHER', 'CLASS_TEACHER'],
  },
  {
    label: 'Attendance',
    href: '/dashboard/principal/attendance',
    icon: CheckSquare,
    roles: ['PRINCIPAL', 'VICE_PRINCIPAL', 'SCHOOL_ADMIN', 'SUPER_ADMIN'],
  },
  {
    label: 'Attendance',
    href: '/dashboard/student/attendance',
    icon: CheckSquare,
    roles: ['STUDENT'],
  },
  {
    label: 'Attendance',
    href: '/dashboard/parent/attendance',
    icon: CheckSquare,
    roles: ['PARENT'],
  },
  { label: 'Students', href: '/dashboard/students', icon: Users, roles: [] },
  {
    label: 'Academics',
    href: '/dashboard/academics',
    icon: BookOpen,
    roles: [],
  },
  { label: 'Staff', href: '/dashboard/staff', icon: GraduationCap, roles: [] },
];

export function NavItems({
  role,
  onItemClick,
}: {
  role: string;
  onItemClick?: () => void;
}) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles.length === 0 || item.roles.includes(role)
  );

  return (
    <nav className="p-3 space-y-1">
      {visibleItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-mono transition-colors',
              isActive
                ? 'bg-cli-emerald/10 text-foreground dark:text-cli-emerald font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-hover-surface'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
