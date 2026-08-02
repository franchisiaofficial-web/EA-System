"use client";
import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PageHeader, PageCard, FormGrid, FormField, EAInput, FooterActions } from "@/components/ui/ea/layout";
import { EAButton } from "@/components/ui/ea";
import { toTitleCase } from "@/lib/format-input";

const schema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  role: z.string().min(1, "Role is required"),
  employeeId: z.string().optional(),
  designation: z.string().optional(),
  gender: z.string().optional(),
  department: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const ROLES = [
  { value: "PRINCIPAL", label: "Principal" },
  { value: "VICE_PRINCIPAL", label: "Vice Principal" },
  { value: "HR", label: "HR" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "TEACHER", label: "Teacher" },
  { value: "CLASS_TEACHER", label: "Class Teacher" },
  { value: "NON_TEACHING", label: "Non-Teaching" },
  { value: "LIBRARIAN", label: "Librarian" },
  { value: "TRANSPORT_MANAGER", label: "Transport Manager" },
  { value: "DRIVER", label: "Driver" },
  { value: "CAFETERIA_STAFF", label: "Cafeteria Staff" },
];

const GENDERS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];

export function StaffCreateForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const methods = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", role: "", employeeId: "", designation: "", gender: "", department: "" },
  });
  const { register, handleSubmit, formState: { errors } } = methods;

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const body: any = { name: data.name, email: data.email, role: data.role };
      if (data.phone) body.phone = data.phone;
      if (data.employeeId) body.employeeId = data.employeeId;
      if (data.designation) body.designation = data.designation;
      if (data.gender) body.gender = data.gender;
      if (data.department) body.department = data.department;
      const res = await fetch("/api/staff/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const r = await res.json();
      if (r.success) { toast.success("Staff member created"); router.push("/dashboard/staff"); router.refresh(); }
      else toast.error(r.error?.message);
    } catch { toast.error("Network error"); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Add Staff Member" subtitle="Create a staff member account and assign their role." backHref="/dashboard/staff" />
      <FormProvider {...methods}>
        <PageCard>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FormGrid cols={2}>
              <FormField label="Full Name" required>
                <EAInput placeholder="e.g. John Doe" format={toTitleCase} {...register("name")} />
              </FormField>
              <FormField label="Email" required>
                <EAInput type="email" placeholder="e.g. john@school.edu" {...register("email")} />
              </FormField>
              <FormField label="Phone">
                <EAInput placeholder="e.g. +91 98765 43210" {...register("phone")} />
              </FormField>
              <FormField label="Employee ID">
                <EAInput placeholder="Auto-generated if left blank" {...register("employeeId")} />
              </FormField>
              <FormField label="Role" required>
                <select className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cli-blue/30" {...register("role")}>
                  <option value="">Select role...</option>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </FormField>
              <FormField label="Designation">
                <EAInput placeholder="e.g. Senior Maths Teacher" {...register("designation")} />
              </FormField>
              <FormField label="Department">
                <EAInput placeholder="e.g. Mathematics" {...register("department")} />
              </FormField>
              <FormField label="Gender">
                <select className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cli-blue/30" {...register("gender")}>
                  <option value="">Select...</option>
                  {GENDERS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </FormField>
            </FormGrid>
            <FooterActions>
              <EAButton variant="secondary" type="button" onClick={() => router.back()}>Cancel</EAButton>
              <EAButton type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create Staff Member</EAButton>
            </FooterActions>
          </form>
        </PageCard>
      </FormProvider>
    </div>
  );
}
