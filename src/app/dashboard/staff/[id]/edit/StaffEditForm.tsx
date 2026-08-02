"use client";
import { useState, useEffect, useCallback } from "react";
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
  phone: z.string().optional(),
  role: z.string().min(1, "Role is required"),
  employeeId: z.string().min(1, "Employee ID is required"),
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

interface MemberData {
  id: string;
  employeeId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  profile: { designation: string | null; gender: string | null; department: string | null } | null;
}

export function StaffEditForm({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [member, setMember] = useState<MemberData | null>(null);

  const loadMember = useCallback(async () => {
    const res = await fetch(`/api/staff/members/${memberId}`);
    const data = await res.json();
    if (data.success) setMember(data.data);
    else {
      toast.error(data.error?.message || "Failed to load member");
      router.push("/dashboard/staff");
    }
  }, [memberId, router]);

  useEffect(() => { void loadMember(); }, [loadMember]);

  const methods = useForm<FormData>({
    resolver: zodResolver(schema),
    values: member ? {
      name: member.fullName,
      phone: member.phone ?? "",
      role: member.role,
      employeeId: member.employeeId ?? "",
      designation: member.profile?.designation ?? "",
      gender: member.profile?.gender ?? "",
      department: member.profile?.department ?? "",
    } : undefined,
  });
  const { register, handleSubmit, formState: { errors } } = methods;

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const body: any = { name: data.name, role: data.role, employeeId: data.employeeId };
      if (data.phone) body.phone = data.phone;
      if (data.designation) body.designation = data.designation;
      if (data.gender) body.gender = data.gender;
      if (data.department) body.department = data.department;
      const res = await fetch(`/api/staff/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const r = await res.json();
      if (r.success) { toast.success("Staff member updated"); router.push("/dashboard/staff"); router.refresh(); }
      else toast.error(r.error?.message);
    } catch { toast.error("Network error"); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Edit Staff Member" subtitle={member ? member.fullName : "Loading..."} backHref="/dashboard/staff" />
      <FormProvider {...methods}>
        <PageCard>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FormGrid cols={2}>
              <FormField label="Full Name" required>
                <EAInput format={toTitleCase} {...register("name")} />
              </FormField>
              <FormField label="Email">
                <EAInput value={member?.email ?? ""} disabled className="opacity-60" />
              </FormField>
              <FormField label="Phone">
                <EAInput placeholder="e.g. +91 98765 43210" {...register("phone")} />
              </FormField>
              <FormField label="Employee ID" required>
                <EAInput {...register("employeeId")} />
              </FormField>
              <FormField label="Role" required>
                <select className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cli-blue/30" {...register("role")}>
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
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </FormField>
            </FormGrid>
            <FooterActions>
              <EAButton variant="secondary" type="button" onClick={() => router.back()}>Cancel</EAButton>
              <EAButton type="submit" disabled={loading || !member}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save Changes</EAButton>
            </FooterActions>
          </form>
        </PageCard>
      </FormProvider>
    </div>
  );
}
