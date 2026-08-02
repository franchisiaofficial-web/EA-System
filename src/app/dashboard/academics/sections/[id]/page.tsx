"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Users, CheckCircle2, XCircle, Clock, UserCircle2, Table2, CalendarClock, FileText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { EAButton } from "@/components/ui/ea";
import { PageHeader, PageCard, SidePanel, FormGrid } from "@/components/ui/ea/layout";
import { CardGridSkeleton } from "@/components/ui/skeleton";

interface TeacherAssignment {
  id: string;
  role: string;
  status: string;
  teacherMembership: { id: string; user: { name: string; email: string } };
}

interface StudentEnrollment {
  id: string;
  rollNumber: string;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string; status: string };
}

interface SectionDetail {
  id: string; name: string; description: string | null; status: string;
  class: {
    id: string; name: string; status: string;
    academicYear: { id: string; name: string };
    assignments: TeacherAssignment[];
  };
  studentEnrollments: StudentEnrollment[];
  _count: { studentEnrollments: number };
}

interface AttendanceSummary { present: number; late: number; absent: number; excused: number }

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<SectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);

  useEffect(() => {
    fetch(`/api/sections/${id}`).then(r => r.json()).then(d => {
      if (d.success) setRecord(d.data);
      else { toast.error("Section not found"); router.push("/dashboard/academics/sections"); }
    }).catch(() => toast.error("Failed to load")).finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    if (!record) return;
    fetch(`/api/attendance?classId=${record.class.id}&date=${formatDate(new Date())}`).then(r => r.json()).then(d => {
      if (d.success && d.data && d.data.length > 0) {
        const summary: AttendanceSummary = { present: 0, late: 0, absent: 0, excused: 0 };
        for (const r of d.data) {
          if (r.status === "PRESENT") summary.present++;
          else if (r.status === "LATE") summary.late++;
          else if (r.status === "ABSENT") summary.absent++;
          else if (r.status === "EXCUSED") summary.excused++;
        }
        setAttendanceSummary(summary);
      } else setAttendanceSummary(null);
    }).catch(() => {});
  }, [id, record]);

  if (loading) return <div className="flex items-center justify-center h-64"><CardGridSkeleton count={2} /></div>;
  if (!record) return null;

  const primaryTeacher = record.class.assignments.find(a => a.role === "PRIMARY" && a.status === "ACTIVE");
  const enrolled = record.studentEnrollments.length;
  const sectionHrefs = {
    timetable: `/dashboard/academics/timetable?sectionId=${id}`,
    exams: `/dashboard/academics/exams?sectionId=${id}`,
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader title={`${record.class.name} — ${record.name}`} subtitle={`${record.class.academicYear.name} · ${enrolled} students`} back />

      <div className="flex gap-6 flex-col lg:flex-row">
        <div className="flex-1 space-y-6 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PageCard className="!p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-cli-purple/10 flex items-center justify-center"><Users className="h-5 w-5 text-cli-purple" /></div>
              <div><p className="text-2xl font-bold text-foreground">{enrolled}</p><p className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider">Total Students</p></div>
            </PageCard>
            <PageCard className="!p-4 flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-cli-emerald/10 flex items-center justify-center"><UserCircle2 className="h-5 w-5 text-cli-emerald" /></div>
              <div>
                <p className="text-lg font-bold text-foreground leading-tight">{primaryTeacher ? primaryTeacher.teacherMembership.user.name : "Unassigned"}</p>
                <p className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider">Class Teacher</p>
              </div>
            </PageCard>
          </div>

          <PageCard>
            <h3 className="text-xs font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.12em] mb-4">Section Information</h3>
            <FormGrid cols={2}>
              <div><p className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider mb-0.5">Section</p><p className="text-sm text-foreground font-medium">{record.name}</p></div>
              <div><p className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider mb-0.5">Class</p><Link href={`/dashboard/academics/classes/${record.class.id}`} className="text-sm text-foreground font-medium hover:text-ea-green transition-colors">{record.class.name}</Link></div>
              <div><p className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider mb-0.5">Academic Year</p><p className="text-sm text-foreground font-medium">{record.class.academicYear.name}</p></div>
              <div><p className="text-[11px] font-mono text-muted-foreground/70 uppercase tracking-wider mb-0.5">Status</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold ${record.status === "ACTIVE" ? "bg-cli-emerald/10 text-cli-emerald" : "bg-muted/50 text-muted-foreground"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${record.status === "ACTIVE" ? "bg-cli-emerald" : "bg-muted-foreground/30"}`} />{record.status}
                </span>
              </div>
            </FormGrid>
            {record.description && <p className="mt-4 text-sm text-muted-foreground">{record.description}</p>}
          </PageCard>

          <PageCard>
            <h3 className="text-xs font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.12em] mb-4">Class Routines</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link href={sectionHrefs.timetable}><EAButton variant="secondary" className="w-full"><Table2 className="h-4 w-4 mr-1.5" />View Timetable</EAButton></Link>
              <Link href={sectionHrefs.exams}><EAButton variant="secondary" className="w-full"><CalendarClock className="h-4 w-4 mr-1.5" />Exam Schedule</EAButton></Link>
              <Link href={sectionHrefs.exams}><EAButton variant="secondary" className="w-full"><FileText className="h-4 w-4 mr-1.5" />Exam Reports</EAButton></Link>
            </div>
          </PageCard>

          <PageCard>
            <h3 className="text-xs font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.12em] mb-4">Today&apos;s Attendance</h3>
            {attendanceSummary ? (
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
              <p className="text-sm text-muted-foreground font-mono">No attendance recorded for today</p>
            )}
          </PageCard>

          <PageCard>
            <h3 className="text-xs font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.12em] mb-4">Student List ({enrolled})</h3>
            {record.studentEnrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground font-mono">No students assigned to this section yet.</p>
            ) : (
              <div className="space-y-2">
                {record.studentEnrollments.map(e => (
                  <Link key={e.id} href={`/dashboard/academics/students/${e.student.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-border bg-muted/20 hover:border-cli-emerald/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-muted-foreground/60 w-10">{e.rollNumber || "—"}</span>
                      <p className="text-sm font-medium text-foreground truncate">{e.student.firstName} {e.student.lastName}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground font-mono">{e.student.admissionNumber}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border ${e.student.status === "ACTIVE" ? "bg-cli-emerald/10 text-cli-emerald border-cli-emerald/30" : "bg-muted/50 text-muted-foreground border-border"}`}>
                        <span className={`h-1 w-1 rounded-full ${e.student.status === "ACTIVE" ? "bg-cli-emerald" : "bg-muted-foreground"}`} />{e.student.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </PageCard>
        </div>

        <SidePanel title="Quick Summary" items={[
          { label: "Status", value: record.status, accent: "status" },
          { label: "Class", value: record.class.name },
          { label: "Academic Year", value: record.class.academicYear.name },
          { label: "Class Teacher", value: primaryTeacher ? primaryTeacher.teacherMembership.user.name : "Unassigned" },
          { label: "Students", value: enrolled },
        ]} />
      </div>
    </div>
  );
}
