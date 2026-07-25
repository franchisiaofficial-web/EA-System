'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CheckSquare,
  Menu,
  GraduationCap,
} from 'lucide-react';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { cn } from '@/lib/utils';
import type { AuthContext } from '@/lib/auth/context';

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

export function DashboardShell({
  children,
  authCtx,
}: {
  children: React.ReactNode;
  authCtx: AuthContext;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.roles.length === 0 || item.roles.includes(authCtx.role)
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#09090B]">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-60 border-r border-[#E5E7EB] dark:border-[#2A2F36] bg-white dark:bg-[#14161A] transform transition-transform duration-200 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center gap-2 px-4 border-b border-[#E5E7EB] dark:border-[#2A2F36]">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 font-mono text-base font-bold text-[#111827] dark:text-[#FAFAFA]"
          >
            <span className="text-[#8EF24A]">{'\u276F'}</span> EA System
          </Link>
        </div>

        <nav className="p-3 space-y-1">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-mono transition-colors',
                  isActive
                    ? 'bg-[#8EF24A]/10 text-[#111827] dark:text-[#8EF24A] font-semibold'
                    : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#FAFAFA] hover:bg-[#F8FAFC] dark:hover:bg-[#09090B]/50'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-[#E5E7EB] dark:border-[#2A2F36] p-3">
          <div className="flex items-center gap-2 px-3 py-2 mb-2">
            <div className="h-7 w-7 rounded-full bg-[#8EF24A]/20 flex items-center justify-center text-xs font-mono font-bold text-[#111827] dark:text-[#FAFAFA]">
              {authCtx.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#111827] dark:text-[#FAFAFA] truncate">
                {authCtx.email}
              </p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-mono uppercase">
                {authCtx.role.replace(/_/g, ' ')}
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-[#E5E7EB] dark:border-[#2A2F36] bg-white/80 dark:bg-[#14161A]/80 backdrop-blur-md px-4 lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-[#F8FAFC] dark:hover:bg-[#09090B]/50"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono">
            {authCtx.role.replace(/_/g, ' ')}
          </span>
          <ThemeToggle />
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
