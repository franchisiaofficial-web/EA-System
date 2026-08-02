'use client';

import { useEffect, useState } from 'react';
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
  create: 'Create',
  edit: 'Edit',
  promotion: 'Bulk Promotion',
  timetable: 'Timetable',
  exams: 'Exams',
  sections: 'Sections',
  classes: 'Classes',
  subjects: 'Subjects',
  terms: 'Terms',
  'academic-years': 'Academic Years',
};

const ENTITY_API: Record<string, { path: (id: string) => string; label: (data: any, id: string) => string | null }> = {
  students: {
    path: (id) => `/api/students/${id}`,
    label: (d) => d?.firstName ? `${d.firstName} ${d.lastName}` : d?.name || null,
  },
  classes: { path: (id) => `/api/classes/${id}`, label: (d) => d?.name || null },
  sections: {
    path: (id) => `/api/sections/${id}`,
    label: (d) => d?.name ? (d?.class?.name ? `${d.class.name} · ${d.name}` : d.name) : null,
  },
  'academic-years': { path: (id) => `/api/academic-years/${id}`, label: (d) => d?.name || null },
  exams: {
    path: () => `/api/exams`,
    label: (d, id) => (Array.isArray(d) ? d.find((x: any) => x.id === id)?.name : null) || null,
  },
};

const labelCache = new Map<string, string>();

function isEntityId(segment: string): boolean {
  return segment.length > 8 && /^[a-z0-9_-]+$/i.test(segment);
}

function segmentLabel(segment: string): string {
  return (
    LABEL_MAP[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1)
  );
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const [resolved, setResolved] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const segments = pathname.split('/').filter(Boolean);
    let cancelled = false;

    const resolve = async () => {
      const next = new Map<string, string>();
      for (let i = 1; i < segments.length; i++) {
        const seg = segments[i];
        const entity = ENTITY_API[segments[i - 1]];
        if (!entity || !isEntityId(seg)) continue;
        const cached = labelCache.get(seg);
        if (cached) { next.set(seg, cached); continue; }
        try {
          const res = await fetch(entity.path(seg));
          const r = await res.json();
          const label = r?.success ? entity.label(r.data, seg) : null;
          if (label) {
            labelCache.set(seg, label);
            next.set(seg, label);
          }
        } catch { /* fall back to raw segment */ }
      }
      if (!cancelled) setResolved(next);
    };
    void resolve();
    return () => { cancelled = true; };
  }, [pathname]);

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
        const resolvedLabel = resolved.get(segment);

        if (isLast) {
          return (
            <span key={href} className="text-xs font-mono text-foreground/80 truncate max-w-32">
              {resolvedLabel ?? label}
            </span>
          );
        }

        return (
          <span key={href} className="flex items-center gap-1.5">
            <Link href={href} className="text-xs font-mono text-muted-foreground hover:text-foreground/80 transition-colors truncate max-w-32">{resolvedLabel ?? label}</Link>
            <span className="text-xs text-muted-foreground/60 font-mono select-none">/</span>
          </span>
        );
      })}
    </nav>
  );
}
