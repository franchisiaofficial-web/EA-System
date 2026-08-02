"use client";
import { useState, useEffect, useCallback } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, UserPlus, Trash2, GraduationCap } from "lucide-react";
import { PageHeader, PageCard, FormGrid, FormField, EAInput, FooterActions, EASelectCustom } from "@/components/ui/ea/layout";
import { EAButton } from "@/components/ui/ea";
import { toTitleCase } from "@/lib/format-input";

const schema = z.object({
  name: z.string().min(1, "Subject name is required"),
  code: z.string().min(1, "Subject code is required"),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Assignment {
  id: string;
  subjectId: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  teacherMembershipId: string;
  status: string;
  academicYear?: { id: string; name: string };
  class?: { id: string; name: string };
  section?: { id: string; name: string } | null;
  teacherMembership?: { id: string; user: { name: string; email: string } };
}

export function SubjectEditForm({ subjectId, canUpdate, canAssign }: { subjectId: string; canUpdate: boolean; canAssign: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [subject, setSubject] = useState<{ id: string; name: string; code: string; description: string | null; isActive: boolean } | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [years, setYears] = useState<{ value: string; label: string }[]>([]);
  const [classes, setClasses] = useState<{ value: string; label: string }[]>([]);
  const [sections, setSections] = useState<{ value: string; label: string }[]>([]);
  const [teachers, setTeachers] = useState<{ value: string; label: string }[]>([]);
  const [assignYear, setAssignYear] = useState("");
  const [assignClass, setAssignClass] = useState("");
  const [assignSection, setAssignSection] = useState("");
  const [assignTeacher, setAssignTeacher] = useState("");

  const loadSubject = useCallback(async () => {
    const res = await fetch(`/api/subjects/${subjectId}`);
    const data = await res.json();
    if (data.success) {
      setSubject(data.data);
      setAssignments(data.data.assignments || []);
    } else {
      toast.error(data.error?.message || "Failed to load subject");
      router.push("/dashboard/academics/subjects");
    }
  }, [subjectId, router]);

  useEffect(() => { void loadSubject(); }, [loadSubject]);

  useEffect(() => {
    fetch("/api/academic-years?pageSize=100").then(r => r.json()).then(d => { if (d.success) setYears(d.data.items.map((y: any) => ({ value: y.id, label: y.name }))); }).catch(() => {});
    fetch("/api/classes?pageSize=100").then(r => r.json()).then(d => { if (d.success) setClasses(d.data.items.map((c: any) => ({ value: c.id, label: c.name }))); }).catch(() => {});
    fetch("/api/sections?pageSize=500").then(r => r.json()).then(d => { if (d.success) setSections(d.data.items.map((s: any) => ({ value: s.id, label: s.name }))); }).catch(() => {});
    fetch("/api/staff/members?pageSize=200&role=TEACHER").then(r => r.json()).then(d => {
      if (d.success) setTeachers(d.data.items.map((m: any) => ({ value: m.id, label: m.fullName || m.email })));
    }).catch(() => {});
  }, []);

  const methods = useForm<FormData>({
    resolver: zodResolver(schema),
    values: subject ? { name: subject.name, code: subject.code, description: subject.description ?? "" } : undefined,
  });
  const { register, handleSubmit, formState: { errors } } = methods;

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/subjects/${subjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, code: data.code, description: data.description || null }),
      });
      const r = await res.json();
      if (r.success) { toast.success("Subject updated"); void loadSubject(); }
      else toast.error(r.error?.message);
    } catch { toast.error("Network error"); } finally { setLoading(false); }
  };

  const handleAssign = async () => {
    if (!assignYear || !assignClass || !assignTeacher) { toast.error("Academic Year, Class, and Teacher are required"); return; }
    setAssigning(true);
    try {
      const res = await fetch(`/api/subjects/${subjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", academicYearId: assignYear, classId: assignClass, sectionId: assignSection || null, teacherMembershipId: assignTeacher }),
      });
      const r = await res.json();
      if (r.success) {
        toast.success("Assigned");
        setAssignYear(""); setAssignClass(""); setAssignSection(""); setAssignTeacher("");
        void loadSubject();
      } else toast.error(r.error?.message);
    } catch { toast.error("Network error"); } finally { setAssigning(false); }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    const res = await fetch(`/api/subject-assignments/${assignmentId}`, { method: "DELETE" });
    const r = await res.json();
    if (r.success) { toast.success("Assignment removed"); void loadSubject(); }
    else toast.error(r.error?.message || "Failed to remove assignment");
  };

  const teacherName = (teacherMembershipId: string) => {
    const a = assignments.find(x => x.teacherMembershipId === teacherMembershipId);
    return a?.teacherMembership?.user?.name || "Unknown";
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Edit Subject" subtitle={subject ? `${subject.name} (${subject.code})` : "Loading..."} backHref="/dashboard/academics/subjects" />
      <FormProvider {...methods}>
        <PageCard>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FormGrid cols={2}>
              <FormField label="Subject Name" required><EAInput placeholder="e.g. Mathematics" format={toTitleCase} {...register("name")} /></FormField>
              <FormField label="Subject Code" required><EAInput placeholder="e.g. MATHS" {...register("code")} /></FormField>
              <FormField label="Description"><EAInput placeholder="Optional notes" {...register("description")} /></FormField>
            </FormGrid>
            <FooterActions>
              <EAButton variant="secondary" type="button" onClick={() => router.push("/dashboard/academics/subjects")}>Cancel</EAButton>
              {canUpdate && <EAButton type="submit" disabled={loading || !subject}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save Changes</EAButton>}
            </FooterActions>
          </form>
        </PageCard>
      </FormProvider>

      <PageCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em]">Assignments</h3>
          <span className="text-xs font-mono text-muted-foreground/70">{assignments.length} active</span>
        </div>
        {assignments.length === 0 && (
          <p className="text-sm text-muted-foreground/70 py-4 text-center">No assignments yet — assign this subject to a class and teacher below.</p>
        )}
        <div className="space-y-2">
          {assignments.map(a => (
            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-muted/40">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-cli-purple" /><span className="font-mono text-xs">{a.academicYear?.name || "—"}</span></span>
                <span className="text-foreground/80">{a.class?.name || "—"}{a.section?.name ? ` / ${a.section.name}` : ""}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-foreground/80">{teacherName(a.teacherMembershipId)}</span>
              </div>
              {canAssign && (
                <button type="button" onClick={() => handleRemoveAssignment(a.id)} className="text-muted-foreground/60 hover:text-cli-rose transition-colors" title="Remove assignment">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </PageCard>

      {canAssign && (
        <PageCard>
          <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">Assign to Class</h3>
          <FormGrid cols={2}>
            <FormField label="Academic Year"><EASelectCustom options={years} placeholder="Select year..." value={assignYear} onChange={setAssignYear} /></FormField>
            <FormField label="Class"><EASelectCustom options={classes} placeholder="Select class..." value={assignClass} onChange={setAssignClass} /></FormField>
            <FormField label="Section (optional)"><EASelectCustom options={sections} placeholder="Select section..." value={assignSection} onChange={setAssignSection} /></FormField>
            <FormField label="Teacher"><EASelectCustom options={teachers} placeholder="Select teacher..." value={assignTeacher} onChange={setAssignTeacher} /></FormField>
          </FormGrid>
          <div className="mt-4 flex justify-end">
            <EAButton variant="secondary" size="sm" onClick={handleAssign} disabled={assigning}>
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-3.5 w-3.5 mr-1" />}Assign
            </EAButton>
          </div>
        </PageCard>
      )}
    </div>
  );
}
