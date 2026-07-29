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

const schema = z.object({ name: z.string().min(1), academicYearId: z.string().min(1), startDate: z.string().min(1), endDate: z.string().min(1) });
type FormData = z.infer<typeof schema>;

export function TermForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [years, setYears] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetch('/api/academic-years?pageSize=100').then(r => r.json()).then(d => {
      if (d.success) setYears(d.data.items.map((y: { id: string; name: string }) => ({ value: y.id, label: y.name })));
    }).catch(() => {});
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { name: '', academicYearId: '', startDate: '', endDate: '' } });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/terms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const r = await res.json();
      if (r.success) { toast.success('Created'); router.push('/dashboard/academics/terms'); router.refresh(); }
      else toast.error(r.error?.message);
    } catch { toast.error('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Create Term</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <TextField label="Name" registration={register('name')} error={errors.name} required placeholder="e.g. Semester 1" />
        <SelectField label="Academic Year" registration={register('academicYearId')} error={errors.academicYearId} required options={years} placeholder="Select year..." />
        <DateField label="Start Date" registration={register('startDate')} error={errors.startDate} required />
        <DateField label="End Date" registration={register('endDate')} error={errors.endDate} required />
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading} className="bg-cli-emerald hover:bg-cli-emerald/80 text-foreground font-medium">{loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}Create</Button>
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
