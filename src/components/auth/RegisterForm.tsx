'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { registerUser } from '@/actions/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true);
    try {
      const result = await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
      });

      if (result.error) {
        toast.error(result.error);
        setLoading(false);
        return;
      }

      setRegistered(true);
    } catch {
      toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cli-emerald/10">
          <CheckCircle2 className="h-10 w-10 text-cli-emerald" />
        </div>
        <h2 className="text-xl font-bold">Check Your Email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to your email. Please check your inbox and
          click the link to activate your account.
        </p>
        <Button
          onClick={() => router.push('/login')}
          variant="outline"
          className="mt-4 w-full"
        >
          Go to Sign In
        </Button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">
          Full Name
        </Label>
        <Input
          id="name"
          type="text"
          placeholder="John Doe"
          autoFocus
          className={`h-11 ${errors.name ? 'border-destructive' : ''}`}
          {...register('name')}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="you@school.edu"
          autoComplete="email"
          className={`h-11 ${errors.email ? 'border-destructive' : ''}`}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          className={`h-11 ${errors.password ? 'border-destructive' : ''}`}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirm Password
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Re-enter your password"
          autoComplete="new-password"
          className={`h-11 ${errors.confirmPassword ? 'border-destructive' : ''}`}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">
            {errors.confirmPassword.message}
          </p>
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
            Creating Account...
          </>
        ) : (
          'Create Account'
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-cli-blue hover:underline font-medium"
        >
          Sign In
        </Link>
      </p>
    </form>
  );
}
