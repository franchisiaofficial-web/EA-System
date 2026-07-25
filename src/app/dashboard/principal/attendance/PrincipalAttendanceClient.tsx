'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Check, Clock, X, Minus } from 'lucide-react';

interface ClassSummary {
  name: string;
  percentage: number;
  total: number;
}

export function PrincipalAttendanceClient({
  schoolPercentage,
  todayPresent,
  todayAbsent,
  todayLate,
  todayExcused,
  classSummaries,
}: {
  schoolPercentage: number;
  todayPresent: number;
  todayAbsent: number;
  todayLate: number;
  todayExcused: number;
  totalStudents?: number;
  classSummaries: ClassSummary[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#FAFAFA]">
          Attendance Dashboard
        </h1>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1 font-mono">
          overview &bull; school-wide &bull; read-only
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2F36] bg-white dark:bg-[#14161A] p-4">
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono uppercase">
            Attendance
          </p>
          <p className="text-2xl font-bold text-[#8EF24A] mt-1">
            {schoolPercentage}%
          </p>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
            This month
          </p>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2F36] bg-white dark:bg-[#14161A] p-4">
          <div className="flex items-center gap-2">
            <Check className="h-3 w-3 text-[#8EF24A]" />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono uppercase">
              Present
            </p>
          </div>
          <p className="text-2xl font-bold text-[#111827] dark:text-[#FAFAFA] mt-1">
            {todayPresent}
          </p>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2F36] bg-white dark:bg-[#14161A] p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-amber-500" />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono uppercase">
              Late
            </p>
          </div>
          <p className="text-2xl font-bold text-[#111827] dark:text-[#FAFAFA] mt-1">
            {todayLate}
          </p>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2F36] bg-white dark:bg-[#14161A] p-4">
          <div className="flex items-center gap-2">
            <X className="h-3 w-3 text-rose-500" />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono uppercase">
              Absent
            </p>
          </div>
          <p className="text-2xl font-bold text-[#111827] dark:text-[#FAFAFA] mt-1">
            {todayAbsent}
          </p>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2F36] bg-white dark:bg-[#14161A] p-4">
          <div className="flex items-center gap-2">
            <Minus className="h-3 w-3 text-slate-400" />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono uppercase">
              Excused
            </p>
          </div>
          <p className="text-2xl font-bold text-[#111827] dark:text-[#FAFAFA] mt-1">
            {todayExcused}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2F36] bg-white dark:bg-[#14161A] p-6">
        <h2 className="text-sm font-mono text-[#6B7280] dark:text-[#9CA3AF] uppercase mb-4">
          Class Comparison — This Month
        </h2>
        {classSummaries.length === 0 ? (
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] font-mono">
            No attendance data yet this month.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={classSummaries}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E5E7EB"
                className="dark:stroke-[#2A2F36]"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fontFamily: 'JetBrains Mono' }}
                stroke="#6B7280"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fontFamily: 'JetBrains Mono' }}
                stroke="#6B7280"
                unit="%"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  background: '#FFFFFF',
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono',
                }}
              />
              <Bar dataKey="percentage" fill="#8EF24A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2A2F36] bg-white dark:bg-[#14161A] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB] dark:border-[#2A2F36]">
          <h2 className="text-sm font-mono text-[#6B7280] dark:text-[#9CA3AF] uppercase">
            Class Details
          </h2>
        </div>
        {classSummaries.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF] font-mono">
            No classes found.
          </div>
        ) : (
          classSummaries.map((c) => (
            <div
              key={c.name}
              className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] dark:border-[#2A2F36] last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-[#111827] dark:text-[#FAFAFA]">
                  {c.name}
                </p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-mono">
                  {c.total} students
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-[#E5E7EB] dark:bg-[#2A2F36] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#8EF24A] rounded-full transition-all"
                    style={{ width: `${c.percentage}%` }}
                  />
                </div>
                <span className="text-sm font-mono font-bold text-[#111827] dark:text-[#FAFAFA] w-10 text-right">
                  {c.percentage}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
