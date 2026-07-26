'use client';

import { useState } from 'react';
import { Check, Clock, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChildData {
  membershipId: string;
  name: string;
  records: Array<{
    id: string;
    date: string;
    status: string;
    className: string;
  }>;
  summary: {
    percentage: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    total: number;
  };
}

export function ParentAttendanceClient({
  linkedChildren,
}: {
  linkedChildren: ChildData[];
}) {
  const [selectedChildIdx, setSelectedChildIdx] = useState(0);

  if (linkedChildren.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Child Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">
            parent &bull; no linked children
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground font-mono">
            No children are linked to your account. Contact the school
            administrator.
          </p>
        </div>
      </div>
    );
  }

  const child = linkedChildren[selectedChildIdx];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Child Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">
          parent &bull; {linkedChildren.length} child
          {linkedChildren.length > 1 ? 'ren' : ''} linked
        </p>
      </div>

      {linkedChildren.length > 1 && (
        <div className="relative inline-block">
          <select
            value={selectedChildIdx}
            onChange={(e) => setSelectedChildIdx(Number(e.target.value))}
            className="appearance-none h-10 pl-4 pr-10 rounded-lg border border-border bg-card text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-cli-emerald/50"
          >
            {linkedChildren.map((c, i) => (
              <option key={c.membershipId} value={i}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground font-mono uppercase">
            {child.name}
          </p>
          <p className="text-2xl font-bold text-cli-emerald mt-1">
            {child.summary.percentage}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Attendance this month
          </p>
        </div>

        {[
          {
            label: 'Present',
            value: child.summary.present,
            icon: Check,
            color: 'text-cli-emerald',
          },
          {
            label: 'Late',
            value: child.summary.late,
            icon: Clock,
            color: 'text-amber-500',
          },
          {
            label: 'Absent',
            value: child.summary.absent,
            icon: X,
            color: 'text-rose-500',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2">
              <s.icon className={cn('h-3 w-3', s.color)} />
              <p className="text-xs text-muted-foreground font-mono uppercase">
                {s.label}
              </p>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-mono text-muted-foreground uppercase">
            Recent Attendance — {child.name}
          </h2>
        </div>
        {child.records.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground font-mono">
            No attendance records yet this month.
          </div>
        ) : (
          child.records.slice(0, 20).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'h-2 w-2 rounded-full',
                    r.status === 'PRESENT'
                      ? 'bg-cli-emerald'
                      : r.status === 'LATE'
                        ? 'bg-amber-500'
                        : r.status === 'ABSENT'
                          ? 'bg-rose-500'
                          : 'bg-slate-400'
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {r.date}
                  </p>
                  {r.className && (
                    <p className="text-xs text-muted-foreground font-mono">
                      {r.className}
                    </p>
                  )}
                </div>
              </div>
              <span
                className={cn(
                  'text-sm font-mono',
                  r.status === 'PRESENT'
                    ? 'text-cli-emerald'
                    : r.status === 'LATE'
                      ? 'text-amber-500'
                      : r.status === 'ABSENT'
                        ? 'text-rose-500'
                        : 'text-slate-400'
                )}
              >
                {r.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
