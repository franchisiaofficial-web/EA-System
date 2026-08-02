"use client";
import { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { PageHeader, PageCard, FormGrid, FormField, EAInput, FooterActions, FormSelect } from "@/components/ui/ea/layout";
import { EAButton } from "@/components/ui/ea";
import { toTitleCase } from "@/lib/format-input";

const schema = z.object({
  name: z.string().min(1, "Subject name is required"),
  academicYearId: z.string().optional(),
  teacherMemberId: z.string().optional(),
  selectedClasses: z.array(z.string()).optional(),
  selectedSections: z.array(z.string()).optional(),
});
type FormData = z.infer<typeof schema>;

export function SubjectForm() {
  const router = useRouter(); const [loading, setLoading] = useState(false);
  const [years, setYears] = useState<{ value: string; label: string }[]>([]);
  const [classes, setClasses] = useState<{ value: string; label: string }[]>([]);
  const [teachers, setTeachers] = useState<{ value: string; label: string }[]>([]);
  const [allSections, setAllSections] = useState<{ value: string; label: string; classId: string; className: string }[]>([]);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showSectionPicker, setShowSectionPicker] = useState(false);

  useEffect(() => {
    fetch("/api/academic-years?pageSize=100").then(r => r.json()).then(d => { if (d.success) setYears(d.data.items.map((y: any) => ({ value: y.id, label: y.name }))); }).catch(() => {});
    fetch("/api/classes?pageSize=100").then(r => r.json()).then(d => { if (d.success) setClasses(d.data.items.map((c: any) => ({ value: c.id, label: c.name }))); }).catch(() => {});
    fetch("/api/sections?pageSize=500").then(r => r.json()).then(d => {
      if (d.success) setAllSections(d.data.items.map((s: any) => ({ value: s.id, label: s.name, classId: s.class?.id || "", className: s.class?.name || "" })));
    }).catch(() => {});
    fetch("/api/staff/members?pageSize=200&role=TEACHER").then(r => r.json()).then(d => {
      if (d.success) setTeachers(d.data.items.map((m: any) => ({ value: m.id, label: m.fullName || m.email })));
    }).catch(() => {});
  }, []);

  const methods = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", academicYearId: "", teacherMemberId: "", selectedClasses: [], selectedSections: [] },
  });
  const { register, handleSubmit, watch, setValue, formState: { errors } } = methods;
  const selectedClasses = watch("selectedClasses") || [];
  const selectedSections = watch("selectedSections") || [];

  const toggleClass = (classId: string) => {
    const cur = selectedClasses || [];
    const next = cur.includes(classId) ? cur.filter(c => c !== classId) : [...cur, classId];
    setValue("selectedClasses", next);
  };

  const toggleSection = (sectionId: string) => {
    const cur = selectedSections || [];
    const next = cur.includes(sectionId) ? cur.filter(s => s !== sectionId) : [...cur, sectionId];
    setValue("selectedSections", next);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const body = {
        name: data.name,
        code: data.name.replace(/\s+/g, "").toUpperCase().substring(0, 8),
        description: JSON.stringify({ academicYearId: data.academicYearId, teacherMemberId: data.teacherMemberId, classIds: data.selectedClasses, sectionIds: data.selectedSections }),
      };
      const res = await fetch("/api/subjects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const r = await res.json();
      if (r.success) { toast.success("Subject created"); router.push("/dashboard/academics/subjects"); router.refresh(); }
      else toast.error(r.error?.message);
    } catch { toast.error("Network error"); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Create Subject" subtitle="Assign a subject to classes, sections, and a teacher." backHref="/dashboard/academics/subjects" />
      <FormProvider {...methods}>
        <PageCard>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FormGrid cols={2}>
              <FormField label="Academic Year"><FormSelect name="academicYearId" options={years} placeholder="Select year..." /></FormField>
              <FormField label="Subject Name" required><EAInput placeholder="e.g. Mathematics" format={toTitleCase} {...register("name")} /></FormField>
              <FormField label="Assigned Teacher"><FormSelect name="teacherMemberId" options={teachers} placeholder="Select teacher..." /></FormField>
            </FormGrid>

            <div className="mt-8 mb-4 border-t border-border" />
            <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">Class & Section Assignments</h3>

            <div className="mb-4">
              <button type="button" onClick={() => setShowClassPicker(!showClassPicker)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/50 text-sm text-foreground/80 hover:border-border/70 hover:bg-muted/30 transition-all">
                <Plus className="h-4 w-4 text-foreground" /> Assign to Classes
              </button>
              {showClassPicker && (
                <div className="mt-2 rounded-xl border border-border bg-card p-3 max-h-48 overflow-y-auto grid grid-cols-2 gap-1">
                  {classes.map(c => (
                    <label key={c.value} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors", (selectedClasses || []).includes(c.value) ? "bg-muted/60 text-foreground" : "text-muted-foreground hover:bg-muted/50")}>
                      <input type="checkbox" checked={(selectedClasses || []).includes(c.value)} onChange={() => toggleClass(c.value)} className="rounded " />
                      {c.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selectedClasses.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {classes.filter(c => (selectedClasses || []).includes(c.value)).map(c => (
                  <span key={c.value} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/60 text-foreground text-xs font-mono">
                    {c.label}
                    <button type="button" onClick={() => toggleClass(c.value)}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}

            {selectedClasses.length > 0 && (
              <div className="mb-4">
                <button type="button" onClick={() => setShowSectionPicker(!showSectionPicker)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-muted/50 text-sm text-foreground/80 hover:border-border/70 hover:bg-muted/30 transition-all">
                  <Plus className="h-4 w-4 text-foreground" /> Assign to Sections
                </button>
                {showSectionPicker && (
                  <div className="mt-2 rounded-xl border border-border bg-card p-3 max-h-48 overflow-y-auto space-y-0.5">
                    {allSections.filter(s => (selectedClasses || []).includes(s.classId)).map(s => (
                      <label key={s.value} className={cn("flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors", (selectedSections || []).includes(s.value) ? "bg-muted/60 text-foreground" : "text-muted-foreground hover:bg-muted/50")}>
                        <span>{s.label} <span className="text-muted-foreground/70 font-mono text-xs ml-1">({s.className})</span></span>
                        <input type="checkbox" checked={(selectedSections || []).includes(s.value)} onChange={() => toggleSection(s.value)} className="rounded " />
                      </label>
                    ))}
                    {allSections.filter(s => (selectedClasses || []).includes(s.classId)).length === 0 && (
                      <p className="text-xs text-muted-foreground/70 py-2 text-center">No sections found for selected classes</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedSections.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allSections.filter(s => (selectedSections || []).includes(s.value)).map(s => (
                  <span key={s.value} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cli-cyan/10 text-cli-cyan text-xs font-mono">
                    {s.label} <span className="opacity-50">({s.className})</span>
                    <button type="button" onClick={() => toggleSection(s.value)}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}

            <FooterActions>
              <EAButton variant="secondary" type="button" onClick={() => router.back()}>Cancel</EAButton>
              <EAButton type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create Subject</EAButton>
            </FooterActions>
          </form>
        </PageCard>
      </FormProvider>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) { return classes.filter(Boolean).join(" "); }
