'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { TextField, TextareaField } from '@/components/crud/fields';
import { Button } from '@/components/ui/button';

const schema = z.object({ name: z.string().min(1), code: z.string().min(1), description: z.string().optional() });
type FormData = z.infer<typeof schema>;

export function SubjectForm() {
  const router = useRouter(); const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { name: '', code: '', description: '' } });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/subjects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const r = await res.json();
      if (r.success) { toast.success('Created'); router.push('/dashboard/academics/subjects'); router.refresh(); }
      else toast.error(r.error?.message);
    } catch { toast.error('Network error'); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Create Subject</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <TextField label="Code" registration={register('code')} error={errors.code} required placeholder="e.g. MATH101" />
        <TextField label="Name" registration={register('name')} error={errors.name} required placeholder="e.g. Mathematics" />
        <TextareaField label="Description" registration={register('description')} error={errors.description} placeholder="Optional description" />
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading} className="bg-cli-emerald hover:bg-cli-emerald/80 text-foreground font-medium">{loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}Create</Button>
          <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
