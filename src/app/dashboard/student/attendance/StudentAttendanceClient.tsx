"use client";

import { CheckCircle2, XCircle, Clock, HelpCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendanceData {
  totalDays: number; present: number; absent: number; late: number; excused: number; percentage: number;
  records: { date: string; status: string; notes: string | null }[];
}

const STATUS: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  PRESENT: { icon: CheckCircle2, color: "text-cli-emerald", bg: "bg-cli-emerald/10", label: "Present" },
  ABSENT: { icon: XCircle, color: "text-muted-foreground", bg: "bg-foreground/10", label: "Absent" },
  LATE: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted/60", label: "Late" },
  EXCUSED: { icon: HelpCircle, color: "text-cli-blue", bg: "bg-cli-blue/10", label: "Excused" },
};

export function StudentAttendanceClient({ data }: { data: AttendanceData }) {
  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <a href="/dashboard/student" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></a>
        <div><h1 className="text-xl font-bold text-foreground">My Attendance</h1><p className="text-xs text-muted-foreground">View your attendance record</p></div>
      </div>

      {/* Stats */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Summary</h2>
        <div className="flex items-center justify-center mb-4">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/20" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={`${data.percentage * 0.9739} 97.39`} className={data.percentage >= 75 ? "text-cli-emerald" : data.percentage >= 50 ? "text-muted-foreground" : "text-muted-foreground"} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-bold font-mono">{data.percentage}%</span></div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[["Present", data.present, "text-cli-emerald"], ["Absent", data.absent, "text-muted-foreground"], ["Late", data.late, "text-muted-foreground"], ["Excused", data.excused, "text-cli-blue"]].map(([label, val, color]) => (
            <div key={label as string} className="text-center"><p className={cn("text-xl font-bold font-mono", color)}>{val as number}</p><p className="text-xs text-muted-foreground">{label as string}</p></div>
          ))}
        </div>
      </div>

      {/* Records */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Recent Records</h2>
        {data.records.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No attendance records yet.</p>
        ) : (
          <div className="space-y-1">
            {data.records.slice(0, 30).map((r, i) => {
              const s = STATUS[r.status] || STATUS.ABSENT;
              return (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2">
                    <s.icon className={cn("h-4 w-4", s.color)} />
                    <span className="text-sm text-foreground">{s.label}</span>
                    {r.notes && <span className="text-xs text-muted-foreground">— {r.notes}</span>}
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">{r.date}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
