'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { TextField, SelectField, DateField } from '@/components/crud/fields';
import { Button } from '@/components/ui/button';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  admissionNumber: z.string().min(1, 'Admission number is required'),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  academicYearId: z.string().optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  rollNumber: z.string().optional(),
  guardianFirstName: z.string().optional(),
  guardianLastName: z.string().optional(),
  guardianRelationship: z.string().optional(),
  guardianPhone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function StudentForm() {
  const router = useRouter(); const [loading, setLoading] = useState(false);
  const [years, setYears] = useState<{ value: string; label: string }[]>([]);
  const [classes, setClasses] = useState<{ value: string; label: string }[]>([]);
  const [sections, setSections] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetch('/api/academic-years?pageSize=100').then(r => r.json()).then(d => { if (d.success) setYears(d.data.items.map((y: { id: string; name: string }) => ({ value: y.id, label: y.name }))); }).catch(() => {});
    fetch('/api/classes?pageSize=100').then(r => r.json()).then(d => { if (d.success) setClasses(d.data.items.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name }))); }).catch(() => {});
    fetch('/api/sections?pageSize=100').then(r => r.json()).then(d => { if (d.success) setSections(d.data.items.map((s: { id: string; name: string }) => ({ value: s.id, label: s.name }))); }).catch(() => {});
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { firstName: '', lastName: '', admissionNumber: '', dateOfBirth: '', gender: '', phone: '', address: '', academicYearId: '', classId: '', sectionId: '', rollNumber: '', guardianFirstName: '', guardianLastName: '', guardianRelationship: '', guardianPhone: '' } });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: data.firstName, lastName: data.lastName, admissionNumber: data.admissionNumber, dateOfBirth: data.dateOfBirth || undefined, gender: data.gender || undefined, phone: data.phone || undefined, address: data.address || undefined }) });
      const r = await res.json();
      if (r.success) {
        toast.success('Student created');
        if (data.academicYearId && data.classId && data.sectionId && data.rollNumber) {
          toast.info('Enrollment and guardian linking available on the student profile page');
        }
        router.push('/dashboard/academics/students');
        router.refresh();
      } else toast.error(r.error?.message || 'Failed');
    } catch { toast.error('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Add Student</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-mono text-muted-foreground uppercase">Personal Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="First Name" registration={register('firstName')} error={errors.firstName} required placeholder="First name" />
          <TextField label="Last Name" registration={register('lastName')} error={errors.lastName} required placeholder="Last name" />
          <TextField label="Admission Number" registration={register('admissionNumber')} error={errors.admissionNumber} required placeholder="e.g. ADM-2025-001" />
          <DateField label="Date of Birth" registration={register('dateOfBirth')} error={errors.dateOfBirth} />
          <SelectField label="Gender" registration={register('gender')} error={errors.gender} options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]} placeholder="Select..." />
          <TextField label="Phone" registration={register('phone')} error={errors.phone} placeholder="Phone number" />
        </div>
        <TextField label="Address" registration={register('address')} error={errors.address} placeholder="Address" />

        <h2 className="text-sm font-mono text-muted-foreground uppercase pt-4">Enrollment (Optional)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField label="Academic Year" registration={register('academicYearId')} error={errors.academicYearId} options={years} placeholder="Select..." />
          <SelectField label="Class" registration={register('classId')} error={errors.classId} options={classes} placeholder="Select..." />
          <SelectField label="Section" registration={register('sectionId')} error={errors.sectionId} options={sections} placeholder="Select..." />
          <TextField label="Roll Number" registration={register('rollNumber')} error={errors.rollNumber} placeholder="e.g. 01" />
        </div>

        <h2 className="text-sm font-mono text-muted-foreground uppercase pt-4">Guardian (Optional)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Guardian First Name" registration={register('guardianFirstName')} error={errors.guardianFirstName} placeholder="Guardian's first name" />
          <TextField label="Guardian Last Name" registration={register('guardianLastName')} error={errors.guardianLastName} placeholder="Guardian's last name" />
          <SelectField label="Relationship" registration={register('guardianRelationship')} error={errors.guardianRelationship} options={[{ value: 'Father', label: 'Father' }, { value: 'Mother', label: 'Mother' }, { value: 'Guardian', label: 'Guardian' }]} placeholder="Select..." />
          <TextField label="Guardian Phone" registration={register('guardianPhone')} error={errors.guardianPhone} placeholder="Phone number" />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading} className="bg-cli-emerald hover:bg-cli-emerald/80 text-foreground font-medium">{loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}Create Student</Button>
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
