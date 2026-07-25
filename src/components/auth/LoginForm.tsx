'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { authClient } from '@/lib/auth/client';
import { loginSchema, type LoginFormData } from '@/lib/validators/auth';
import { getAuthRedirect } from '@/actions/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PasswordInput } from './PasswordInput';
import { GoogleButton } from './GoogleButton';

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    try {
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
      });

      if (result.error) {
        const message = result.error.message || result.error.code || '';

        if (message.includes('Invalid') || message.includes('credentials')) {
          toast.error('Invalid email or password');
        } else if (message.includes('not verified')) {
          toast.error('Please verify your email address');
        } else if (message.includes('disabled')) {
          toast.error('Your account has been disabled');
        } else if (message.includes('suspended')) {
          toast.error('Your school account has been suspended');
        } else if (message.includes('expired')) {
          toast.error('Session expired. Please sign in again');
        } else {
          toast.error('Unable to sign in. Please try again');
        }
        setLoading(false);
        return;
      }

      const { redirect, error } = await getAuthRedirect();

      if (error) {
        toast.error(error);
        setLoading(false);
        return;
      }

      setRedirectUrl(redirect);
      setShowSuccess(true);
      setLoading(false);
    } catch {
      toast.error('Network error. Please check your connection');
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@school.edu"
              autoComplete="email"
              autoFocus
              className={`h-11 ${errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              {...register('email')}
            />
            {errors.email && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-destructive"
              >
                {errors.email.message}
              </motion.p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <PasswordInput
              id="password"
              name="password"
              register={register as never}
              error={errors.password?.message}
            />
            {errors.password && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-destructive"
              >
                {errors.password.message}
              </motion.p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-[var(--cli-blue)]"
              />
              Remember me
            </label>
            <a
              href="/forgot-password"
              className="text-sm font-medium text-[var(--cli-blue)] hover:underline"
            >
              Forgot password?
            </a>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full bg-[var(--cli-blue)] hover:bg-[var(--cli-blue)]/80 text-white font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">OR</span>
          </div>
        </div>

        <GoogleButton />
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowSuccess(false);
              router.push(redirectUrl);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cli-emerald/10"
              >
                <CheckCircle2 className="h-10 w-10 text-cli-emerald" />
              </motion.div>
              <h2 className="mb-2 text-xl font-bold text-foreground">
                Login Successful
              </h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Welcome back! Redirecting to your dashboard...
              </p>
              <Button
                onClick={() => {
                  setShowSuccess(false);
                  router.push(redirectUrl);
                }}
                className="w-full bg-cli-blue hover:bg-cli-blue/80 text-white"
              >
                Continue to Dashboard
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
