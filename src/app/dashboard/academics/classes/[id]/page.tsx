"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Plus, Users, BookOpen, CheckCircle2, XCircle, Clock, UserCircle2, Loader2, Percent } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageHeader, PageCard, SidePanel, FormGrid } from "@/components/ui/ea/layout";
import { EAButton } from "@/components/ui/ea";
import { CardGridSkeleton } from "@/components/ui/skeleton";

interface AttendanceSummary {
  present: number;
  late: number;
  absent: number;
  excused: number;
}

interface SectionItem {
  id: string;
  name: string;
  status: string;
  enrollmentRecords: { id: string }[];
  studentEnrollments: { id: string }[];
}

interface Assignment {
  id: string;
  role: string;
  status: string;
  teacherMembership: { id: string; user: { name: string; email: string } };
}

interface SectionAttendance { present: number; late: number; absent: number; excused: number; total: number }

interface ClassDetail {
  id: string; name: string; status: string;
  description: string | null; sortOrder: number;
  academicYear: { id: string; name: string };
  sections: SectionItem[];
  assignments: Assignment[];
  _count: { sections: number; studentEnrollments: number; attendanceRecords: number };
}

interface ClassStudent {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  status: string;
  enrollmentRecords?: { section?: { name: string } }[];
}

interface Teacher {
  id: string;
  role: string;
  user: { name: string; email: string };
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getLast7Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [heatmap, setHeatmap] = useState<(number | null)[]>(Array(7).fill(null));
  const [monthlyHeatmap, setMonthlyHeatmap] = useState<Record<string, number | null>>({});
  const [sectionAttendance, setSectionAttendance] = useState<Record<string, SectionAttendance>>({});
  const [students, setStudents] = useState<ClassStudent[]>([]);

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/classes/${id}`).then(r => r.json()).then(d => {
      if (d.success) setRecord(d.data);
      else { toast.error("Class not found"); router.push("/dashboard/academics/classes"); }
    }).catch(() => toast.error("Failed to load")).finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/teachers?pageSize=100").then(r => r.json()).then(d => {
      if (d.success) setTeachers(d.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/attendance?classId=${id}&date=${formatDate(new Date())}`).then(r => r.json()).then(d => {
      if (d.success && d.data && d.data.length > 0) {
        const summary: AttendanceSummary = { present: 0, late: 0, absent: 0, excused: 0 };
        for (const r of d.data) {
          if (r.status === "PRESENT") summary.present++;
          else if (r.status === "LATE") summary.late++;
          else if (r.status === "ABSENT") summary.absent++;
          else if (r.status === "EXCUSED") summary.excused++;
        }
        setAttendanceSummary(summary);
        setTotalRecords(d.data.length);
      } else {
        setAttendanceSummary(null);
      }
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    const days = getLast7Days();
    days.forEach((day, idx) => {
      fetch(`/api/attendance?classId=${id}&date=${formatDate(day)}`).then(r => r.json()).then(d => {
        if (d.success && d.data && d.data.length > 0) {
          const present = d.data.filter((r: any) => r.status === "PRESENT" || r.status === "LATE").length;
          setHeatmap(prev => {
            const next = [...prev];
            next[idx] = Math.round((present / d.data.length) * 100);
            return next;
          });
        } else {
          setHeatmap(prev => {
            const next = [...prev];
            next[idx] = null;
            return next;
          });
        }
      }).catch(() => {});
    });
  }, [id]);

  useEffect(() => {
    fetch(`/api/students?pageSize=500&classId=${id}`).then(r => r.json()).then(d => {
      if (d.success) setStudents(d.data.items);
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const from = formatDate(first);
    const to = formatDate(last);
    fetch(`/api/attendance?classId=${id}&summary=true&from=${from}&to=${to}`).then(r => r.json()).then(d => {
      if (d.success && d.data) setSectionAttendance(d.data);
    }).catch(() => {});
    fetch(`/api/attendance?classId=${id}&from=${from}&to=${to}`).then(r => r.json()).then(d => {
      if (!d.success || !d.data) return;
      const byDate: Record<string, { present: number; total: number }> = {};
      for (const r of d.data) {
        const ds = String(r.date).slice(0, 10);
        if (!byDate[ds]) byDate[ds] = { present: 0, total: 0 };
        byDate[ds].total++;
        if (r.status === "PRESENT" || r.status === "LATE") byDate[ds].present++;
      }
      const map: Record<string, number | null> = {};
      for (let day = 1; day <= last.getDate(); day++) {
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const b = byDate[ds];
        map[ds] = b ? Math.round((b.present / b.total) * 100) : null;
      }
      setMonthlyHeatmap(map);
    }).catch(() => {});
  }, [id]);

  const primaryTeacher = record?.assignments.find(a => a.role === "PRIMARY" && a.status === "ACTIVE");
  const previousTeachers = record?.assignments.filter(a => a.role === "PRIMARY" && a.status !== "ACTIVE") ?? [];

  const attendancePct = attendanceSummary && totalRecords > 0
    ? `${Math.round(((attendanceSummary.present + attendanceSummary.late) / totalRecords) * 100)}%`
    : "—";

  const assignTeacher = async () => {
    if (!selectedTeacher) { toast.error("Select a teacher first"); return; }
    setAssigning(true);
    try {
      const res = await fetch("/api/class-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: id, teacherMembershipId: selectedTeacher, role: "PRIMARY" }),
      });
      const r = await res.json();
      if (r.success) { toast.success("Class teacher assigned"); setSelectedTeacher(""); load(); }
      else toast.error(r.error?.message || "Assignment failed");
    } catch { toast.error("Network error"); } finally { setAssigning(false); }
  };

  const removeTeacher = async () => {
    if (!primaryTeacher) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/class-assignments?id=${primaryTeacher.id}`, { method: "DELETE" });
      const r = await res.json();
      if (r.success) { toast.success("Class teacher removed"); load(); }
      else toast.error(r.error?.message || "Remove failed");
    } catch { toast.error("Network error"); } finally { setRemoving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><CardGridSkeleton count={2} /></div>;
  if (!record) return null;

  const last7Days = getLast7Days();

  const heatmapColor = (pct: number | null): string => {
    if (pct === null) return "bg-muted/40 border border-border";
    if (pct >= 90) return "bg-cli-emerald/80";
    if (pct >= 75) return "bg-cli-emerald/40";
    if (pct >= 50) return "bg-cli-amber/50";
    return "bg-cli-rose/50";
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader title={record.name} subtitle={`${record.academicYear.name} · ${record._count.sections} sections · ${record._count.studentEnrollments} students`} back
        actions={
          <div className="flex items-center gap-2">
            <EAButton variant="secondary" onClick={() => router.push(`/dashboard/academics/classes/${id}/edit`)}><Pencil className="h-4 w-4 mr-1.5" />Edit</EAButton>
            <EAButton variant="secondary" onClick={() => router.push(`/dashboard/academics/sections/create?classId=${id}`)}><Plus className="h-4 w-4 mr-1.5" />Add Section</EAButton>
          </div>
        }
      />

      <div className="flex gap-6 flex-col lg:flex-row">
        <div className="flex-1 space-y-6 min-w-0">
          <PageCard>
            <h3 className="text-xs font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.12em] mb-4">Class Information</h3>
            <FormGrid cols={2}>
              <div><p className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider mb-0.5">Class</p><p className="text-sm text-foreground font-medium">{record.name}</p></div>
              <div><p className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider mb-0.5">Academic Year</p><p className="text-sm text-foreground font-medium">{record.academicYear.name}</p></div>
              <div><p className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider mb-0.5">Status</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold ${record.status === "ACTIVE" ? "bg-cli-emerald/10 text-cli-emerald" : "bg-muted/50 text-muted-foreground"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${record.status === "ACTIVE" ? "bg-cli-emerald" : "bg-muted-foreground/30"}`} />{record.status}
                </span>
              </div>
            </FormGrid>
            {record.description && <p className="mt-4 text-sm text-muted-foreground">{record.description}</p>}
          </PageCard>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <PageCard className="!p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-cli-purple/10 flex items-center justify-center"><Users className="h-5 w-5 text-cli-purple" /></div>
              <div><p className="text-2xl font-bold text-foreground">{record._count.sections}</p><p className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider">Sections</p></div>
            </PageCard>
            <PageCard className="!p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-cli-cyan/10 flex items-center justify-center"><BookOpen className="h-5 w-5 text-cli-cyan" /></div>
              <div><p className="text-2xl font-bold text-foreground">{record._count.studentEnrollments}</p><p className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider">Students</p></div>
            </PageCard>
            <PageCard className="!p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-cli-emerald/10 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-cli-emerald" /></div>
              <div><p className="text-2xl font-bold text-foreground">{record._count.attendanceRecords}</p><p className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider">Attendance</p></div>
            </PageCard>
          </div>

          <PageCard>
            <h3 className="text-xs font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.12em] mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <EAButton variant="secondary" onClick={() => router.push(`/dashboard/academics/classes/${id}/edit`)}><Pencil className="h-4 w-4 mr-1.5" />Edit Class</EAButton>
              <EAButton variant="secondary" onClick={() => document.getElementById("class-teacher")?.scrollIntoView({ behavior: "smooth" })}><UserCircle2 className="h-4 w-4 mr-1.5" />Assign Teacher</EAButton>
              <EAButton variant="secondary" onClick={() => router.push("/dashboard/academics/promotion")}><Users className="h-4 w-4 mr-1.5" />Promote Students</EAButton>
              <EAButton variant="secondary" onClick={() => router.push("/dashboard/academics/attendance")}><CheckCircle2 className="h-4 w-4 mr-1.5" />View Attendance</EAButton>
            </div>
          </PageCard>

          <PageCard id="class-teacher">
            <h3 className="text-xs font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.12em] mb-4">Class Teacher</h3>
            {primaryTeacher ? (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-cli-emerald/10 flex items-center justify-center"><UserCircle2 className="h-5 w-5 text-cli-emerald" /></div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{primaryTeacher.teacherMembership.user.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{primaryTeacher.teacherMembership.user.email} · {primaryTeacher.role}</p>
                  </div>
                </div>
                <EAButton variant="secondary" type="button" onClick={removeTeacher} disabled={removing}>
                  {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Remove
                </EAButton>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground font-mono mb-4">No class teacher assigned for {record.academicYear.name}.</p>
            )}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <select
                value={selectedTeacher}
                onChange={e => setSelectedTeacher(e.target.value)}
                className="h-11 rounded-xl bg-card border border-border px-4 text-sm text-foreground focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10 min-w-[240px]">
                <option value="">Select teacher...</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.user.name}{t.role === "CLASS_TEACHER" ? " (Class Teacher)" : ""}</option>
                ))}
              </select>
              <EAButton type="button" onClick={assignTeacher} disabled={assigning}>
                {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Assign as Class Teacher
              </EAButton>
            </div>
          </PageCard>

          {previousTeachers.length > 0 && (
            <PageCard>
              <h3 className="text-xs font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.12em] mb-4">Previous Class Teachers</h3>
              <div className="space-y-2">
                {previousTeachers.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-muted/20">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><UserCircle2 className="h-4 w-4 text-muted-foreground" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium">{a.teacherMembership.user.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{a.teacherMembership.user.email}</p>
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 bg-muted/60 px-2 py-0.5 rounded-md">{a.status}</span>
                  </div>
                ))}
              </div>
            </PageCard>
          )}

          <PageCard>
            <h3 className="text-xs font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.12em] mb-4">Student List ({students.length})</h3>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground font-mono">No students enrolled in this class.</p>
            ) : (
              <div className="space-y-2">
                {students.map(s => (
                  <Link key={s.id} href={`/dashboard/academics/students/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-border bg-muted/20 hover:border-cli-emerald/40 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.firstName} {s.lastName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{s.admissionNumber} · {s.enrollmentRecords?.[0]?.section?.name || "No section"}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border shrink-0 ${s.status === "ACTIVE" ? "bg-cli-emerald/10 text-cli-emerald border-cli-emerald/30" : "bg-muted/50 text-muted-foreground border-border"}`}>
                      <span className={`h-1 w-1 rounded-full ${s.status === "ACTIVE" ? "bg-cli-emerald" : "bg-muted-foreground"}`} />{s.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </PageCard>

          <PageCard>
            <h3 className="text-xs font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.12em] mb-4">Sections</h3>
            {record.sections.length === 0 ? (
              <p className="text-sm text-muted-foreground font-mono">No sections yet. Add one to organize students.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {record.sections.map(s => (
                  <div key={s.id} className="rounded-2xl border border-border bg-card p-5 hover:border-cli-emerald/40 transition-colors h-full flex flex-col">
                    <Link href={`/dashboard/academics/sections/${s.id}`} className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-base font-bold text-foreground">{s.name}</p>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${s.status === "ACTIVE" ? "bg-cli-emerald/10 text-cli-emerald" : "bg-muted/50 text-muted-foreground"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.status === "ACTIVE" ? "bg-cli-emerald" : "bg-muted-foreground/30"}`} />{s.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-cli-purple" />
                        <span className="text-muted-foreground font-mono">{s.enrollmentRecords.length || s.studentEnrollments.length} students</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Percent className="h-4 w-4 text-cli-emerald" />
                        <span className="text-muted-foreground font-mono">{sectionAttendance[s.id] && sectionAttendance[s.id].total > 0 ? `${Math.round(((sectionAttendance[s.id].present + sectionAttendance[s.id].late) / sectionAttendance[s.id].total) * 100)}% attendance` : "No attendance yet"}</span>
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mt-3">{record.name} · {record.academicYear.name}</p>
                    </Link>
                    <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-border/60">
                      <Link href={`/dashboard/academics/timetable?sectionId=${s.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors">Timetable</Link>
                      <Link href={`/dashboard/academics/exams?sectionId=${s.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors">Exam Schedule</Link>
                      <Link href={`/dashboard/academics/exams?sectionId=${s.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground text-[10px] font-mono hover:text-foreground transition-colors">Exam Reports</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PageCard>

          <PageCard>
            <h3 className="text-xs font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.12em] mb-4">Today&apos;s Attendance</h3>
            {attendanceSummary && totalRecords > 0 ? (
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cli-emerald/10">
                  <CheckCircle2 className="h-4 w-4 text-cli-emerald" />
                  <span className="text-sm font-mono text-foreground">{attendanceSummary.present}</span>
                  <span className="text-[11px] text-muted-foreground">Present</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cli-rose/10">
                  <XCircle className="h-4 w-4 text-cli-rose" />
                  <span className="text-sm font-mono text-foreground">{attendanceSummary.absent}</span>
                  <span className="text-[11px] text-muted-foreground">Absent</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cli-amber/10">
                  <Clock className="h-4 w-4 text-cli-amber" />
                  <span className="text-sm font-mono text-foreground">{attendanceSummary.late}</span>
                  <span className="text-[11px] text-muted-foreground">Late</span>
                </div>
                {attendanceSummary.excused > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cli-cyan/10">
                    <span className="text-sm font-mono text-foreground">{attendanceSummary.excused}</span>
                    <span className="text-[11px] text-muted-foreground">Excused</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground font-mono">No attendance recorded yet</p>
            )}
          </PageCard>

          <PageCard>
            <h3 className="text-xs font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.12em] mb-4">Last 7 Days Attendance</h3>
            <div className="flex gap-2">
              {last7Days.map((day, idx) => {
                const pct = heatmap[idx];
                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5 flex-1">
                    <span className={`text-[10px] font-mono uppercase tracking-wider ${isToday(day) ? "text-foreground font-bold" : "text-muted-foreground/60"}`}>
                      {dayNames[day.getDay()]}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/50">{day.getDate()}</span>
                    <div className={`w-full aspect-square rounded-md ${heatmapColor(pct)}`} title={pct === null ? "No records" : `${pct}% present`} />
                    <span className="text-[10px] font-mono text-muted-foreground/70">{pct === null ? "—" : `${pct}%`}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-cli-emerald/80" /><span className="text-[10px] font-mono text-muted-foreground">≥90% present</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-cli-emerald/40" /><span className="text-[10px] font-mono text-muted-foreground">75–89%</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-cli-amber/50" /><span className="text-[10px] font-mono text-muted-foreground">50–74%</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-cli-rose/50" /><span className="text-[10px] font-mono text-muted-foreground">&lt;50%</span></div>
            </div>
          </PageCard>

          <PageCard>
            <h3 className="text-xs font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.12em] mb-4">Monthly Attendance</h3>
            <div className="grid grid-cols-7 gap-1.5">
              {Object.entries(monthlyHeatmap).map(([ds, pct]) => {
                const day = new Date(ds + "T00:00:00");
                const weekend = day.getDay() === 0 || day.getDay() === 6;
                return (
                  <div key={ds} className="flex flex-col items-center gap-1">
                    <span className={`text-[9px] font-mono ${weekend ? "text-muted-foreground/30" : "text-muted-foreground/60"}`}>{day.getDate()}</span>
                    <div
                      className={`w-full aspect-square rounded-md ${weekend ? "bg-muted/20 border border-border/60" : heatmapColor(pct)}`}
                      title={pct === null ? "No records" : `${pct}% present`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-cli-emerald/80" /><span className="text-[10px] font-mono text-muted-foreground">≥90%</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-cli-emerald/40" /><span className="text-[10px] font-mono text-muted-foreground">75–89%</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-cli-amber/50" /><span className="text-[10px] font-mono text-muted-foreground">50–74%</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-cli-rose/50" /><span className="text-[10px] font-mono text-muted-foreground">&lt;50%</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-muted/20 border border-border/60" /><span className="text-[10px] font-mono text-muted-foreground">No records / weekend</span></div>
            </div>
          </PageCard>
        </div>

        <SidePanel title="Quick Summary" items={[
          { label: "Status", value: record.status, accent: "status" },
          ...record.sections.map(s => ({ label: "Section", value: s.name, href: `/dashboard/academics/sections/${s.id}` })),
          { label: "Students", value: record._count.studentEnrollments },
          { label: "Attendance", value: attendancePct },
          { label: "Teacher", value: primaryTeacher ? primaryTeacher.teacherMembership.user.name : "Unassigned" },
        ]} />
      </div>
    </div>
  );
}
