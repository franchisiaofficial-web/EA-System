'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { requestPasswordReset } from '@/actions/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const forgotSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email'),
});

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: { email: string }) => {
    setLoading(true);
    try {
      await requestPasswordReset(data.email);
      setSent(true);
    } catch {
      toast.error('Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cli-emerald/10">
          <Mail className="h-10 w-10 text-cli-emerald" />
        </div>
        <h2 className="text-xl font-bold">Check Your Email</h2>
        <p className="text-sm text-muted-foreground">
          If an account exists with that email, we have sent a password reset
          link.
        </p>
        <Button
          onClick={() => setSent(false)}
          variant="outline"
          className="mt-4 w-full"
        >
          Try another email
        </Button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">
          Email Address
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="you@school.edu"
          autoComplete="email"
          autoFocus
          className={`h-11 ${errors.email ? 'border-destructive' : ''}`}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="h-11 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          'Send Reset Link'
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="text-cli-blue hover:underline font-medium inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Sign In
        </Link>
      </p>
    </form>
  );
}
