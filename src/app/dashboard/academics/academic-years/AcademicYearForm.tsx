"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PageHeader, PageCard, FormGrid, FormField, EAInput, FooterActions } from "@/components/ui/ea/layout";
import { EAButton } from "@/components/ui/ea";

const schema = z.object({ name: z.string().min(1), startDate: z.string().min(1), endDate: z.string().min(1), isActive: z.boolean() });
type FormData = z.infer<typeof schema>;

interface AcademicYearFormProps {
  initialData?: FormData & { id?: string };
  isEdit?: boolean;
}

export function AcademicYearForm({ initialData, isEdit }: AcademicYearFormProps = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const defaultValues = initialData || { name: "", startDate: "", endDate: "", isActive: false };
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => { if (initialData) reset(initialData); }, [initialData, reset]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const url = isEdit && initialData?.id ? `/api/academic-years/${initialData.id}` : "/api/academic-years";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const r = await res.json();
      if (r.success) { toast.success(isEdit ? "Academic year updated" : "Academic year created"); router.push("/dashboard/academics/academic-years"); router.refresh(); }
      else toast.error(r.error?.message || "Failed");
    } catch { toast.error("Network error"); } finally { setLoading(false); }
  };

  const title = isEdit ? "Edit Academic Year" : "Create Academic Year";
  const subtitle = isEdit ? "Update academic year details." : "Define a new academic year with start and end dates.";

  return (
    <div className="space-y-6 w-full">
      <PageHeader title={title} subtitle={subtitle} backHref="/dashboard/academics/academic-years" />
      <PageCard>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormGrid cols={2}>
            <FormField label="Name" required><EAInput placeholder="e.g. 2025-2026" {...register("name")} /></FormField>
            <FormField label="Start Date" required><EAInput type="date" {...register("startDate")} /></FormField>
            <FormField label="End Date" required><EAInput type="date" {...register("endDate")} /></FormField>
            <FormField label="Active">
              <label className="flex items-center gap-3 h-11 px-4 rounded-xl border border-border bg-card cursor-pointer">
                <input type="checkbox" {...register("isActive")} className="rounded border-muted-foreground/30 bg-muted/50  scale-110" />
                <span className="text-sm text-muted-foreground">Set as current active academic year</span>
              </label>
            </FormField>
          </FormGrid>
          <FooterActions>
            <EAButton variant="secondary" type="button" onClick={() => router.back()}>Cancel</EAButton>
            
            <EAButton type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{isEdit ? "Save Changes" : "Create Academic Year"}</EAButton>
          </FooterActions>
        </form>
      </PageCard>
    </div>
  );
}
