"use client";

import { Users, GraduationCap, CheckSquare, Banknote, UserPlus, Megaphone, Clock, CalendarDays, ShieldCheck, Activity, TrendingUp, AlertCircle } from "lucide-react";
import { EAStatCard, EAButton } from "@/components/ui/ea";

interface DashboardData {
  schoolName: string; userName: string;
  summary: { students: number; staff: number; classes: number; attendance: number };
  todayAttendance: { present: number; absent: number; late: number; excused: number };
  attendanceTrend: { date: string; count: number }[];
  recentAdmissions: { firstName: string; lastName: string; admissionNumber: string; createdAt: string }[];
  recentActivity: { action: string; entity: string; createdAt: string }[];
  fees: { collected: number; pending: number };
}

export function SchoolAdminDashboard({ data }: { data: DashboardData }) {
  const formatDate = (d: string | Date) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const formatTime = (d: string | Date) => {
    const date = new Date(d);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };
  const today = new Date();

  return (
    <div className="space-y-5 p-4 sm:p-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Good Morning, {data.userName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-2">
          <EAButton size="sm" variant="secondary">Notifications</EAButton>
          <EAButton size="sm">Profile</EAButton>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EAStatCard icon={Users} label="Students" value={data.summary.students} color="blue" />
        <EAStatCard icon={GraduationCap} label="Staff" value={data.summary.staff} color="green" />
        <EAStatCard icon={CheckSquare} label="Attendance" value={`${data.summary.attendance}%`} color="green" />
        <EAStatCard icon={Banknote} label="Fees Collected" value={`₹${(data.fees.collected / 100000).toFixed(1)}L`} color="amber" />
      </div>

      {/* Today's Attendance + Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
          <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.1em] mb-4">Today's Attendance</h3>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[["Present", data.todayAttendance.present, "text-foreground"], ["Absent", data.todayAttendance.absent, "text-foreground"], ["Late", data.todayAttendance.late, "text-muted-foreground"], ["Excused", data.todayAttendance.excused, "text-muted-foreground"]].map(([l, v, c]) => (
              <div key={l as string}><p className={c as string + " text-2xl font-bold font-mono"}>{v as number}</p><p className="text-xs text-muted-foreground mt-1">{l as string}</p></div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
          <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.1em] mb-4">Attendance Trend (7 Days)</h3>
          <div className="flex items-end gap-1 h-24">
            {data.attendanceTrend.map((t) => {
              const max = Math.max(...data.attendanceTrend.map(x => x.count), 1);
              return <div key={t.date} className="flex-1 flex flex-col items-center gap-1"><div className="w-full bg-ea-green/60 rounded-t" style={{ height: `${(t.count / max) * 100}%`, minHeight: 4 }} /><span className="text-[9px] text-muted-foreground font-mono">{t.date}</span></div>;
            })}
          </div>
        </div>
      </div>

      {/* Recent Admissions + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
          <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.1em] mb-4">Recent Admissions</h3>
          {data.recentAdmissions.length === 0 ? <p className="text-sm text-muted-foreground/50 text-center py-4">No recent admissions</p> : (
            data.recentAdmissions.map((s, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-t border-border first:border-0">
                <div><p className="text-sm text-foreground">{s.firstName} {s.lastName}</p><p className="text-xs text-muted-foreground font-mono">{s.admissionNumber}</p></div>
                <span className="text-xs text-muted-foreground font-mono">{formatDate(s.createdAt)}</span>
              </div>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
          <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.1em] mb-4">Recent Activity</h3>
          {data.recentActivity.length === 0 ? <p className="text-sm text-muted-foreground/50 text-center py-4">No activity</p> : (
            data.recentActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-t border-border first:border-0">
                <div className="h-1.5 w-1.5 rounded-full bg-ea-green mt-1.5 shrink-0" />
                 <div className="flex-1 min-w-0"><p className="text-sm text-foreground truncate">{a.action.replace(/_/g, " ")} — {a.entity}</p><p className="text-xs text-muted-foreground font-mono">{formatTime(a.createdAt)}</p></div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
        <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.1em] mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[{ icon: UserPlus, label: "Add Student", href: "/dashboard/academics/students/create" }, { icon: CheckSquare, label: "Mark Attendance", href: "/dashboard/teacher/attendance" }, { icon: GraduationCap, label: "Add Staff", href: "/dashboard/staff" }, { icon: Megaphone, label: "Announcement", href: "/dashboard/academics" }].map((a) => (
            <a key={a.label} href={a.href} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border hover:border-ea-green/30 hover:bg-ea-green/[0.03] transition-all"><a.icon className="h-4 w-4 text-foreground" /><span className="text-sm text-foreground">{a.label}</span></a>
          ))}
        </div>
      </div>
    </div>
  );
}
