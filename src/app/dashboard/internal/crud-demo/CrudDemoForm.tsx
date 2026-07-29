'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { TextField, SelectField, TextareaField } from '@/components/crud/fields';
import { Button } from '@/components/ui/button';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  category: z.enum(['general', 'academic', 'admin', 'operations']),
});

type FormData = z.infer<typeof schema>;

export function CrudDemoForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', category: 'general' },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch('/api/crud-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        toast.success('Item created');
        router.push('/dashboard/internal/crud-demo');
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
        <h1 className="text-2xl font-bold text-foreground">Create Demo Item</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">_internal &bull; form field reference</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-border bg-card p-6">
        <TextField
          label="Title"
          registration={register('title')}
          error={errors.title}
          required
          placeholder="Enter demo item title"
        />

        <SelectField
          label="Category"
          registration={register('category')}
          error={errors.category}
          options={[
            { value: 'general', label: 'General' },
            { value: 'academic', label: 'Academic' },
            { value: 'admin', label: 'Admin' },
            { value: 'operations', label: 'Operations' },
          ]}
        />

        <TextareaField
          label="Description"
          registration={register('description')}
          error={errors.description}
          placeholder="Optional description"
          rows={3}
        />

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading} className="bg-cli-emerald hover:bg-cli-emerald/80 text-foreground font-medium">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Create Item
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
