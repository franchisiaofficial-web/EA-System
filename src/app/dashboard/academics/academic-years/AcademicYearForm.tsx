'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { TextField, DateField, SwitchField } from '@/components/crud/fields';
import { Button } from '@/components/ui/button';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export function AcademicYearForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', startDate: '', endDate: '', isActive: false },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/academic-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Academic year created');
        router.push('/dashboard/academics/academic-years');
        router.refresh();
      } else {
        toast.error(result.error?.message || 'Failed to create');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Create Academic Year</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">academics &bull; add a new school year</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <TextField
          label="Name"
          registration={register('name')}
          error={errors.name}
          required
          placeholder="e.g. 2025-2026"
        />

        <DateField
          label="Start Date"
          registration={register('startDate')}
          error={errors.startDate}
          required
        />

        <DateField
          label="End Date"
          registration={register('endDate')}
          error={errors.endDate}
          required
        />

        <SwitchField
          label="Set as Active"
          registration={register('isActive')}
          error={errors.isActive}
          description="Mark this as the current active academic year"
        />

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading} className="bg-cli-emerald hover:bg-cli-emerald/80 text-foreground font-medium">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Create Academic Year
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
