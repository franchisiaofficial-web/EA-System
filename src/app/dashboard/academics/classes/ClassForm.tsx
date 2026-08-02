"use client";
import { useState, useEffect } from "react";
import { useForm, FormProvider, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { PageHeader, PageCard, FormGrid, FormField, EAInput, FooterActions, FormSelect } from "@/components/ui/ea/layout";
import { EAButton } from "@/components/ui/ea";
import { toTitleCase, toSectionLetter } from "@/lib/format-input";

const sectionSchema = z.object({ name: z.string().min(1, "Section name required") });

const schema = z.object({
  name: z.string().min(1, "Class name is required"),
  academicYearId: z.string().min(1, "Academic year is required"),
  status: z.string().optional(),
  sections: z.array(sectionSchema).optional(),
});
type FormData = z.infer<typeof schema>;

interface ClassFormProps { initialData?: FormData & { id?: string }; isEdit?: boolean; }

export function ClassForm({ initialData, isEdit }: ClassFormProps = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [years, setYears] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetch("/api/academic-years?pageSize=100").then(r => r.json()).then(d => {
      if (d.success) setYears(d.data.items.map((y: any) => ({ value: y.id, label: y.name })));
    }).catch(() => {});
  }, []);

  const methods = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData || { name: "", academicYearId: "", status: "ACTIVE", sections: [{ name: "" }] },
  });
  const { register, handleSubmit, control, formState: { errors } } = methods;
  const { fields, append, remove } = useFieldArray({ control, name: "sections" });

  useEffect(() => { if (initialData) methods.reset(initialData); }, [initialData, methods]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const url = isEdit && initialData?.id ? `/api/classes/${initialData.id}` : "/api/classes";
      const method = isEdit ? "PATCH" : "POST";
      const body: any = { name: data.name, academicYearId: data.academicYearId, ...(data.status ? { status: data.status } : {}) };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const r = await res.json();
      if (r.success) {
        const classId = r.data?.id || initialData?.id;
        if (!isEdit && data.sections?.length && classId) {
          const validSections = data.sections.filter(s => s.name.trim());
          for (const s of validSections) {
            await fetch("/api/sections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classId, name: s.name.trim() }) });
          }
        }
        toast.success(isEdit ? "Class updated" : "Class created");
        router.push("/dashboard/academics/classes");
        router.refresh();
      }
      else toast.error(r.error?.message || "Failed");
    } catch { toast.error("Network error"); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader title={isEdit ? "Edit Class" : "Create Class"} subtitle={isEdit ? "Update class details." : "Create a new class with sections."} backHref="/dashboard/academics/classes" />
      <FormProvider {...methods}>
        <PageCard>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FormGrid cols={2}>
              <FormField label="Academic Year" required>
                <FormSelect name="academicYearId" options={years} placeholder="Select year..." />
              </FormField>
              <FormField label="Class Name" required>
                <EAInput placeholder="e.g. Grade 7" format={toTitleCase} {...register("name")} />
              </FormField>
              {isEdit && (
                <FormField label="Status">
                  <FormSelect name="status" options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }, { value: "ARCHIVED", label: "Archived" }]} />
                </FormField>
              )}
            </FormGrid>

            {!isEdit && (
              <>
                <div className="mt-8 mb-4 border-t border-border" />
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em]">Sections</h3>
                  <button type="button" onClick={() => append({ name: "" })} className="flex items-center gap-1 text-xs text-foreground hover:text-foreground/70 font-mono transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add Section
                  </button>
                </div>
                <div className="space-y-2">
                  {fields.map((field, idx) => (
                    <div key={field.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <EAInput placeholder={`Section ${String.fromCharCode(65 + idx)}`} format={toSectionLetter} {...register(`sections.${idx}.name`)} />
                      </div>
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(idx)} className="p-2 text-muted-foreground/70 hover:text-foreground transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            <FooterActions>
              <EAButton variant="secondary" type="button" onClick={() => router.back()}>Cancel</EAButton>
              <EAButton type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{isEdit ? "Save Changes" : "Create Class"}</EAButton>
            </FooterActions>
          </form>
        </PageCard>
      </FormProvider>
    </div>
  );
}
