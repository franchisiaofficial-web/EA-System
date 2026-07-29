'use client';

import { useState } from 'react';
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
  admissionNumber: z.string().min(1),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function StudentEditForm({ data }: { data: FormData & { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: data,
  });

  const onSubmit = async (formData: FormData) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/students/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const r = await res.json();
      if (r.success) {
        toast.success('Student updated');
        router.push(`/dashboard/academics/students/${data.id}`);
        router.refresh();
      } else {
        toast.error(r.error?.message || 'Failed to update');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Edit Student</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-mono text-muted-foreground uppercase">Personal Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="First Name" registration={register('firstName')} error={errors.firstName} required />
          <TextField label="Last Name" registration={register('lastName')} error={errors.lastName} required />
          <TextField label="Admission Number" registration={register('admissionNumber')} error={errors.admissionNumber} required />
          <DateField label="Date of Birth" registration={register('dateOfBirth')} error={errors.dateOfBirth} />
          <SelectField label="Gender" registration={register('gender')} error={errors.gender} options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]} placeholder="Select..." />
          <TextField label="Phone" registration={register('phone')} error={errors.phone} />
        </div>
        <TextField label="Address" registration={register('address')} error={errors.address} />

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading} className="bg-cli-emerald hover:bg-cli-emerald/80 text-foreground font-medium">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}Save Changes
          </Button>
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
