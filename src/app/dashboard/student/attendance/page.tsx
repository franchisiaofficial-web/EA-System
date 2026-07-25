import { getAuthContext, toRequestContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';
import {
  getStudentAttendance,
  getAttendanceSummary,
} from '@/services/attendance/attendance-service';
import { Check, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

function getDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

export default async function StudentAttendancePage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect('/login');
  if (authCtx.role !== 'STUDENT') redirect('/login');

  const ctx = toRequestContext(authCtx);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const records = await getStudentAttendance(
    authCtx.membershipId,
    ctx,
    monthStart,
    today
  );
  const summary = await getAttendanceSummary(
    authCtx.membershipId,
    monthStart,
    today,
    ctx
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#FAFAFA]">
          My Attendance
        </h1>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1 font-mono">
          student &bull; {authCtx.email}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2F36] bg-white dark:bg-[#14161A] p-4">
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono uppercase">
            Attendance
          </p>
          <p className="text-2xl font-bold text-[#8EF24A] mt-1">
            {summary.percentage}%
          </p>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
            This month
          </p>
        </div>

        {[
          {
            label: 'Present',
            value: summary.present,
            icon: Check,
            color: 'text-[#8EF24A]',
          },
          {
            label: 'Late',
            value: summary.late,
            icon: Clock,
            color: 'text-amber-500',
          },
          {
            label: 'Absent',
            value: summary.absent,
            icon: X,
            color: 'text-rose-500',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2F36] bg-white dark:bg-[#14161A] p-4"
          >
            <div className="flex items-center gap-2">
              <s.icon className={cn('h-3 w-3', s.color)} />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono uppercase">
                {s.label}
              </p>
            </div>
            <p className="text-2xl font-bold text-[#111827] dark:text-[#FAFAFA] mt-1">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2F36] bg-white dark:bg-[#14161A] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB] dark:border-[#2A2F36]">
          <h2 className="text-sm font-mono text-[#6B7280] dark:text-[#9CA3AF] uppercase">
            Attendance History — This Month
          </h2>
        </div>
        {records.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF] font-mono">
            No attendance records yet this month.
          </div>
        ) : (
          records.map((r) => {
            return (
              <div
                key={r.id}
                className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] dark:border-[#2A2F36] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full',
                      r.status === 'PRESENT'
                        ? 'bg-[#8EF24A]'
                        : r.status === 'LATE'
                          ? 'bg-amber-500'
                          : r.status === 'ABSENT'
                            ? 'bg-rose-500'
                            : 'bg-slate-400'
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium text-[#111827] dark:text-[#FAFAFA]">
                      {getDateStr(new Date(r.date))}
                    </p>
                    {r.class?.name && (
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono">
                        {r.class.name}
                      </p>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    'text-sm font-mono',
                    r.status === 'PRESENT'
                      ? 'text-[#8EF24A]'
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
            );
          })
        )}
      </div>
    </div>
  );
}
