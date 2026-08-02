"use client";
import { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PageHeader, PageCard, FormGrid, FormField, EAInput, EATextarea, FooterActions, FormSelect } from "@/components/ui/ea/layout";
import { EAButton } from "@/components/ui/ea";
import { toSectionLetter } from "@/lib/format-input";

const schema = z.object({
  classId: z.string().min(1, "Class is required"),
  name: z.string().min(1, "Section name is required"),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function SectionForm() {
  const router = useRouter(); const searchParams = useSearchParams();
  const preselectedClassId = searchParams.get("classId") || "";
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetch("/api/classes?pageSize=100").then(r => r.json()).then(d => {
      if (d.success) setClasses(d.data.items.map((c: any) => ({ value: c.id, label: c.name })));
    }).catch(() => {});
  }, []);

  const methods = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { classId: preselectedClassId, name: "", description: "" },
  });
  const { register, handleSubmit, formState: { errors } } = methods;

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch("/api/sections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const r = await res.json();
      if (r.success) { toast.success("Section created"); router.push("/dashboard/academics/sections"); router.refresh(); }
      else toast.error(r.error?.message);
    } catch { toast.error("Network error"); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Create Section" subtitle="Create a new section within a class." backHref="/dashboard/academics/sections" />
      <FormProvider {...methods}>
        <PageCard>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FormGrid cols={2}>
              <FormField label="Class" required>
                <FormSelect name="classId" options={classes} placeholder="Select class..." />
              </FormField>
              <FormField label="Section Name" required>
                <EAInput placeholder="e.g. Section A" format={toSectionLetter} maxLength={1} {...register("name")} />
              </FormField>
            </FormGrid>
            <div className="h-4" />
            <FormField label="Description">
              <EATextarea placeholder="Optional description" {...register("description")} />
            </FormField>
            <FooterActions>
              <EAButton variant="secondary" type="button" onClick={() => router.back()}>Cancel</EAButton>
              <EAButton type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create Section</EAButton>
            </FooterActions>
          </form>
        </PageCard>
      </FormProvider>
    </div>
  );
}
