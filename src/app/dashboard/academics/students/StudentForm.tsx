"use client";
import { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, User } from "lucide-react";
import { PageHeader, PageCard, FormGrid, FormField, EAInput, EATextarea, FooterActions, FormSelect } from "@/components/ui/ea/layout";
import { EAButton } from "@/components/ui/ea";
import { toUpperCase, toTitleCase, toLowerCase } from "@/lib/format-input";

const phoneRegex = /^[6-9]\d{9}$/;
const phoneSchema = z.string().regex(phoneRegex, "Enter valid 10-digit mobile").or(z.literal("")).optional();

const schema = z.object({
  firstName: z.string().min(1), lastName: z.string().min(1),
  admissionNumber: z.string().min(1), admissionDate: z.string().optional(),
  dateOfBirth: z.string().optional(), gender: z.string().optional(),
  phone: phoneSchema, address: z.string().optional(), bloodGroup: z.string().optional(), studentStatus: z.string().optional(),
  academicYearId: z.string().optional(), classId: z.string().optional(), sectionId: z.string().optional(), rollNumber: z.string().optional(),
  fatherName: z.string().optional(), fatherPhone: phoneSchema, fatherOccupation: z.string().optional(), fatherEmail: z.string().optional(),
  motherName: z.string().optional(), motherPhone: phoneSchema, motherOccupation: z.string().optional(), motherEmail: z.string().optional(),
  guardianName: z.string().optional(), guardianPhone: phoneSchema, guardianRelationship: z.string().optional(),
  emergencyContactName: z.string().optional(), emergencyRelationship: z.string().optional(), emergencyPhone: phoneSchema,
  siblingName: z.string().optional(), siblingAdmissionNo: z.string().optional(), siblingAge: z.string().optional(),
  siblingGender: z.string().optional(), siblingRelationship: z.string().optional(), siblingSchoolName: z.string().optional(), siblingNotes: z.string().optional(), siblingReason: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const genderOpts = [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }];
const bloodOpts = [...["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(v => ({ value: v, label: v })), { value: "Other", label: "Other" }];
const relationOpts = [{ value: "Father", label: "Father" }, { value: "Mother", label: "Mother" }, { value: "Guardian", label: "Guardian" }];
const siblingRelationOpts = [{ value: "Brother", label: "Brother" }, { value: "Sister", label: "Sister" }, { value: "Other", label: "Other" }];

export function StudentForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [years, setYears] = useState<{ value: string; label: string }[]>([]);
  const [classes, setClasses] = useState<{ value: string; label: string }[]>([]);
  const [sections, setSections] = useState<{ value: string; label: string }[]>([]);
  const [hasSibling, setHasSibling] = useState(false);
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draftId");
  const [draftRecordId, setDraftRecordId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/academic-years?pageSize=100").then(r => r.json()).then(d => { if (d.success) setYears(d.data.items.map((y: any) => ({ value: y.id, label: y.name }))); }).catch(() => {});
    fetch("/api/classes?pageSize=100").then(r => r.json()).then(d => { if (d.success) setClasses(d.data.items.map((c: any) => ({ value: c.id, label: c.name }))); }).catch(() => {});
  }, []);

  const methods = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { firstName: "", lastName: "", admissionNumber: "", admissionDate: "", dateOfBirth: "", gender: "", phone: "", address: "", bloodGroup: "", studentStatus: "", academicYearId: "", classId: "", sectionId: "", rollNumber: "", fatherName: "", fatherPhone: "", fatherOccupation: "", fatherEmail: "", motherName: "", motherPhone: "", motherOccupation: "", motherEmail: "", guardianName: "", guardianPhone: "", guardianRelationship: "", emergencyContactName: "", emergencyRelationship: "", emergencyPhone: "", siblingName: "", siblingAdmissionNo: "", siblingAge: "", siblingGender: "", siblingRelationship: "", siblingSchoolName: "", siblingNotes: "", siblingReason: "" } });

  useEffect(() => {
    if (draftId) {
      fetch(`/api/students/drafts?id=${draftId}`).then(r => r.json()).then(d => {
        if (d.success && d.data) {
          setDraftRecordId(d.data.id);
          methods.reset(d.data.data);
        }
      }).catch(() => {});
    }
  }, [draftId, methods]);
  const { register, handleSubmit, watch, formState: { errors } } = methods;
  const watchedClassId = watch("classId");
  const watchedBloodGroup = watch("bloodGroup");
  const watchedFirstName = watch("firstName");
  const watchedLastName = watch("lastName");
  const watchedAdmission = watch("admissionNumber");
  const watchedYear = watch("academicYearId");
  const watchedSection = watch("sectionId");
  const watchedRoll = watch("rollNumber");
  const watchedStatus = watch("studentStatus");
  const watchedAddress = watch("address");
  const [customBlood, setCustomBlood] = useState("");

  const yearLabel = (id?: string) => years.find(y => y.value === id)?.label || "—";
  const classLabel = (id?: string) => classes.find(c => c.value === id)?.label || "—";
  const sectionLabel = (id?: string) => sections.find(s => s.value === id)?.label || "—";

  useEffect(() => {
    if (!watchedClassId) { setSections([]); return; }
    fetch(`/api/sections?pageSize=100&classId=${watchedClassId}`).then(r => r.json()).then(d => {
      if (d.success) setSections(d.data.items.map((s: any) => ({ value: s.id, label: s.name })));
    }).catch(() => {});
  }, [watchedClassId]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        bloodGroup: data.bloodGroup === "Other" ? (customBlood || "Other") : data.bloodGroup,
        siblings: hasSibling && data.siblingName ? [{
          name: data.siblingName,
          admissionNo: data.siblingAdmissionNo || undefined,
          age: data.siblingAge ? Number(data.siblingAge) : undefined,
          gender: data.siblingGender || undefined,
          relationship: data.siblingRelationship || undefined,
          schoolName: data.siblingSchoolName || undefined,
          notes: data.siblingNotes || undefined,
          reason: data.siblingReason || undefined,
        }] : [],
      };
      const res = await fetch("/api/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const r = await res.json();
      if (r.success) {
        toast.success("Student created");
        if (draftRecordId) {
          fetch(`/api/students/drafts?id=${draftRecordId}`, { method: "DELETE" }).catch(() => {});
        }
        router.push("/dashboard/academics/students"); router.refresh();
      }
      else toast.error(r.error?.message || "Failed");
    } catch { toast.error("Network error"); } finally { setLoading(false); }
  };

  const saveDraft = async () => {
    const data = methods.getValues();
    const progress = calculateProgress(data);
    try {
      const res = await fetch("/api/students/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftRecordId || undefined, data, progress, lastStep: "form" }),
      });
      const r = await res.json();
      if (r.success) {
        if (r.data?.id) setDraftRecordId(r.data.id);
        toast.success("Draft saved");
      } else toast.error("Failed to save draft");
    } catch { toast.error("Network error"); }
  };

  const calculateProgress = (data: FormData): number => {
    let filled = 0;
    const total = 22;
    if (data.firstName) filled++;
    if (data.lastName) filled++;
    if (data.admissionNumber) filled++;
    if (data.admissionDate) filled++;
    if (data.dateOfBirth) filled++;
    if (data.gender) filled++;
    if (data.phone) filled++;
    if (data.address) filled++;
    if (data.bloodGroup) filled++;
    if (data.studentStatus) filled++;
    if (data.academicYearId) filled++;
    if (data.classId) filled++;
    if (data.sectionId) filled++;
    if (data.rollNumber) filled++;
    if (data.fatherName) filled++;
    if (data.fatherPhone) filled++;
    if (data.motherName) filled++;
    if (data.motherPhone) filled++;
    if (data.guardianName) filled++;
    if (data.emergencyContactName) filled++;
    if (data.emergencyRelationship) filled++;
    if (data.emergencyPhone) filled++;
    return Math.round((filled / total) * 100);
  };

  const ph = (errors: any, field: string) => errors[field] ? <p className="text-xs text-foreground mb-1">{errors[field]?.message}</p> : null;

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Add Student" subtitle="Register a new student with complete details." backHref="/dashboard/academics/students" />
      <FormProvider {...methods}>
        <PageCard>
          <form onSubmit={handleSubmit(onSubmit)}>
            <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">1. Personal Information</h3>
            <FormGrid cols={2}>
              <FormField label="Admission No" required><EAInput placeholder="e.g. ADM-2025-001" {...register("admissionNumber")} /></FormField>
              <FormField label="Admission Date"><EAInput type="date" {...register("admissionDate")} /></FormField>
              <FormField label="First Name" required><EAInput placeholder="First name" format={toUpperCase} {...register("firstName")} /></FormField>
              <FormField label="Last Name" required><EAInput placeholder="Last name" format={toUpperCase} {...register("lastName")} /></FormField>
              <FormField label="Gender"><FormSelect name="gender" options={genderOpts} placeholder="Select..." /></FormField>
              <FormField label="Date of Birth"><EAInput type="date" {...register("dateOfBirth")} /></FormField>
              <FormField label="Blood Group"><FormSelect name="bloodGroup" options={bloodOpts} placeholder="Select..." /></FormField>
              {watchedBloodGroup === "Other" && (
                <FormField label="Specify Blood Group"><EAInput placeholder="e.g. Bombay Blood" value={customBlood} onChange={e => setCustomBlood(e.target.value)} /></FormField>
              )}
              <FormField label="Phone">{ph(errors, "phone")}<EAInput placeholder="10-digit mobile" {...register("phone")} /></FormField>
            </FormGrid>
            <div className="mt-3"><FormField label="Address"><EATextarea rows={3} placeholder="Full address" {...register("address")} /></FormField></div>
            <div className="mt-3"><FormField label="Status"><FormSelect name="studentStatus" options={[{value:"ACTIVE",label:"Active"},{value:"INACTIVE",label:"Inactive"},{value:"SUSPENDED",label:"Suspended"},{value:"TRANSFERRED",label:"Transferred"},{value:"GRADUATED",label:"Graduated"},{value:"WITHDRAWN",label:"Withdrawn"}]} placeholder="Select status..." /></FormField></div>

            <div className="mt-8 mb-4 border-t border-border" />
            <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">2. Academic Information</h3>
            <FormGrid cols={2}>
              <FormField label="Academic Year"><FormSelect name="academicYearId" options={years} placeholder="Select year..." /></FormField>
              <FormField label="Class"><FormSelect name="classId" options={classes} placeholder="Select class..." /></FormField>
              <FormField label="Section">
                {watchedClassId ? <FormSelect name="sectionId" options={sections} placeholder="Select section..." /> : <div className="h-11 flex items-center px-4 rounded-xl border border-border bg-muted/50"><span className="text-xs text-muted-foreground/70 font-mono">Select a class first</span></div>}
              </FormField>
              <FormField label="Roll Number"><EAInput placeholder="e.g. 01" {...register("rollNumber")} /></FormField>
            </FormGrid>

            <div className="mt-8 mb-4 border-t border-border" />
            <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">6. Preview</h3>
            <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cli-blue/10"><User className="h-5 w-5 text-cli-blue" /></div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{[watchedFirstName, watchedLastName].filter(Boolean).join(" ") || "Student Name"}</p>
                  <p className="text-xs font-mono text-muted-foreground">{watchedAdmission || "Admission #"}</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[["Academic Year", yearLabel(watchedYear)], ["Class", classLabel(watchedClassId)], ["Section", sectionLabel(watchedSection)], ["Roll Number", watchedRoll || "—"]].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-xs font-mono text-foreground text-right">{value}</dd></div>
                ))}
              </dl>
              <div className="flex justify-between gap-2"><dt className="text-xs text-muted-foreground">Status</dt><dd className="text-xs font-mono text-cli-emerald">{watchedStatus || "ACTIVE"}</dd></div>
              {watchedAddress && <p className="text-xs text-muted-foreground whitespace-pre-line border-t border-border pt-3">{watchedAddress}</p>}
            </div>

            <div className="mt-8 mb-4 border-t border-border" />
            <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">3. Parent Information</h3>

            <h4 className="text-[11px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3">Father Details</h4>
            <FormGrid cols={2}>
              <FormField label="Father Name"><EAInput placeholder="Full name" format={toTitleCase} {...register("fatherName")} /></FormField>
              <FormField label="Mobile Number">{ph(errors, "fatherPhone")}<EAInput placeholder="10-digit mobile" {...register("fatherPhone")} /></FormField>
              <FormField label="Occupation"><EAInput placeholder="Occupation" {...register("fatherOccupation")} /></FormField>
              <FormField label="Email"><EAInput type="email" placeholder="email@example.com" format={toLowerCase} {...register("fatherEmail")} /></FormField>
            </FormGrid>

            <h4 className="text-[11px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-5">Mother Details</h4>
            <FormGrid cols={2}>
              <FormField label="Mother Name"><EAInput placeholder="Full name" format={toTitleCase} {...register("motherName")} /></FormField>
              <FormField label="Mobile Number">{ph(errors, "motherPhone")}<EAInput placeholder="10-digit mobile" {...register("motherPhone")} /></FormField>
              <FormField label="Occupation"><EAInput placeholder="Occupation" {...register("motherOccupation")} /></FormField>
              <FormField label="Email"><EAInput type="email" placeholder="email@example.com" format={toLowerCase} {...register("motherEmail")} /></FormField>
            </FormGrid>

            <h4 className="text-[11px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-5">Guardian (Optional)</h4>
            <FormGrid cols={2}>
              <FormField label="Guardian Name"><EAInput placeholder="Full name" format={toTitleCase} {...register("guardianName")} /></FormField>
              <FormField label="Relationship"><FormSelect name="guardianRelationship" options={relationOpts} placeholder="Select..." /></FormField>
              <FormField label="Mobile Number">{ph(errors, "guardianPhone")}<EAInput placeholder="10-digit mobile" {...register("guardianPhone")} /></FormField>
            </FormGrid>

            <div className="mt-8 mb-4 border-t border-border" />
            <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">4. Sibling Information</h3>
            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input type="checkbox" checked={hasSibling} onChange={e => { setHasSibling(e.target.checked); if (!e.target.checked) { ["siblingName", "siblingAdmissionNo", "siblingAge", "siblingGender", "siblingRelationship", "siblingSchoolName", "siblingNotes", "siblingReason"].forEach(f => methods.setValue(f as any, "")); } }} className="rounded border-muted-foreground/30 bg-muted/50 accent-ea-green scale-110" />
              <span className="text-sm text-muted-foreground">Has a sibling?</span>
            </label>
            {hasSibling && (
              <FormGrid cols={2}>
                <FormField label="Sibling Name" required><EAInput placeholder="Full name" format={toTitleCase} {...register("siblingName")} /></FormField>
                <FormField label="Relationship"><FormSelect name="siblingRelationship" options={siblingRelationOpts} placeholder="Select..." /></FormField>
                <FormField label="Age (optional)"><EAInput type="number" min={1} max={30} placeholder="e.g. 12" {...register("siblingAge")} /></FormField>
                <FormField label="Gender"><FormSelect name="siblingGender" options={genderOpts} placeholder="Select..." /></FormField>
                <FormField label="Admission Number (optional)"><EAInput placeholder="e.g. ADM-2025-002" {...register("siblingAdmissionNo")} /></FormField>
                <FormField label="School Name (optional)"><EAInput placeholder="e.g. EA Public School" {...register("siblingSchoolName")} /></FormField>
                <FormField label="Notes (optional)"><EAInput placeholder="e.g. Studying in Grade 3, same school" {...register("siblingNotes")} /></FormField>
                <FormField label="Reason (optional)"><EAInput placeholder="e.g. Will join next term" {...register("siblingReason")} /></FormField>
              </FormGrid>
            )}

            <div className="mt-8 mb-4 border-t border-border" />
            <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-[0.12em] mb-4">5. Emergency Contact</h3>
            <FormGrid cols={2}>
              <FormField label="Contact Name"><EAInput placeholder="Emergency contact name" format={toTitleCase} {...register("emergencyContactName")} /></FormField>
              <FormField label="Relationship"><EAInput placeholder="e.g. Parent" {...register("emergencyRelationship")} /></FormField>
              <FormField label="Phone">{ph(errors, "emergencyPhone")}<EAInput placeholder="10-digit mobile" {...register("emergencyPhone")} /></FormField>
            </FormGrid>

            <FooterActions>
              <EAButton variant="secondary" type="button" onClick={() => router.back()}>Cancel</EAButton>
              <EAButton variant="secondary" type="button" onClick={saveDraft}>Save Draft</EAButton>
              <EAButton type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create Student</EAButton>
            </FooterActions>
          </form>
        </PageCard>
      </FormProvider>
    </div>
  );
}
