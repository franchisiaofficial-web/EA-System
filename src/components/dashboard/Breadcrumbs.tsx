'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const LABEL_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  teacher: 'Teacher',
  student: 'Student',
  principal: 'Principal',
  parent: 'Parent',
  'super-admin': 'Super Admin',
  admin: 'School Admin',
  'vice-principal': 'Vice Principal',
  accountant: 'Accountant',
  hr: 'Human Resources',
  transport: 'Transport',
  driver: 'Driver',
  library: 'Library',
  staff: 'Staff',
  students: 'Students',
  academics: 'Academics',
  attendance: 'Attendance',
};

function segmentLabel(segment: string): string {
  return (
    LABEL_MAP[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1)
  );
}

export function Breadcrumbs() {
  const pathname = usePathname();

  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden md:flex items-center gap-1.5"
    >
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        const href = '/' + segments.slice(0, i + 1).join('/');
        const label = segmentLabel(segment);

        if (isLast) {
          return (
            <span
              key={href}
              className="text-xs font-mono text-foreground truncate max-w-32"
            >
              {label}
            </span>
          );
        }

        return (
          <span key={href} className="flex items-center gap-1.5">
            <Link
              href={href}
              className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors truncate max-w-32"
            >
              {label}
            </Link>
            <span className="text-xs text-border font-mono select-none">/</span>
          </span>
        );
      })}
    </nav>
  );
}
