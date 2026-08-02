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
import { toTitleCase } from "@/lib/format-input";

const schema = z.object({ name: z.string().min(1), academicYearId: z.string().min(1), startDate: z.string().min(1), endDate: z.string().min(1) });
type FormData = z.infer<typeof schema>;

export function TermForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [years, setYears] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetch("/api/academic-years?pageSize=100").then(r => r.json()).then(d => {
      if (d.success) setYears(d.data.items.map((y: any) => ({ value: y.id, label: y.name })));
    }).catch(() => {});
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { name: "", academicYearId: "", startDate: "", endDate: "" } });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch("/api/terms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const r = await res.json();
      if (r.success) { toast.success("Term created"); router.push("/dashboard/academics/terms"); router.refresh(); }
      else toast.error(r.error?.message);
    } catch { toast.error("Network error"); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Create Term" subtitle="Define a new academic term within a year." backHref="/dashboard/academics/terms" />
      <PageCard>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormGrid cols={2}>
            <FormField label="Name" required><EAInput placeholder="e.g. Semester 1" format={toTitleCase} {...register("name")} /></FormField>
            <FormField label="Academic Year" required>
              <select {...register("academicYearId")} className="h-11 w-full rounded-xl bg-card border border-input px-4 text-sm text-foreground focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10 transition-all duration-200 appearance-none">
                <option value="">Select year...</option>{years.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
            </FormField>
            <FormField label="Start Date" required><EAInput type="date" {...register("startDate")} /></FormField>
            <FormField label="End Date" required><EAInput type="date" {...register("endDate")} /></FormField>
          </FormGrid>
          <FooterActions>
            <EAButton variant="secondary" type="button" onClick={() => router.back()}>Cancel</EAButton>
            <EAButton type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create Term</EAButton>
          </FooterActions>
        </form>
      </PageCard>
    </div>
  );
}
