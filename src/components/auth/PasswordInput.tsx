'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PasswordInputProps {
  id: string;
  name: string;
  placeholder?: string;
  error?: string;
  register: ReturnType<
    typeof import('react-hook-form').useForm<Record<string, unknown>>
  >['register'];
  className?: string;
}

export function PasswordInput({
  id,
  name,
  placeholder = 'Enter your password',
  error,
  register,
  className,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        autoComplete="current-password"
        className={cn(
          'h-11 pr-10',
          error && 'border-destructive/50 focus-visible:ring-destructive/20',
          className
        )}
        {...register(name)}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-muted-foreground transition-colors"
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
