'use client';

import React, { useState } from 'react';
import type { FieldError } from 'react-hook-form';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Eye, EyeOff, ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ── Base field props — the FIELD_CONTRACT.md contract ──
export interface BaseFieldProps {
  label: string;
  registration: UseFormRegisterReturn;
  error?: FieldError | string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const errorMessage = (error: FieldError | string | undefined): string | null => {
  if (!error) return null;
  if (typeof error === 'string') return error;
  return error.message ?? null;
};

const inputBase = cn(
  'h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground font-sans',
  'placeholder:text-muted-foreground',
  'focus:outline-none focus:ring-2 focus:ring-cli-emerald/50 focus:border-cli-emerald/30',
  'disabled:opacity-50 disabled:cursor-not-allowed'
);

const inputError = 'border-destructive focus-visible:ring-destructive/30 dark:border-destructive/50';

function FieldWrapper({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: FieldError | string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const msg = errorMessage(error);
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {msg && (
        <p className="text-xs text-destructive animate-in fade-in slide-in-from-y-1">{msg}</p>
      )}
    </div>
  );
}

// ── TextField ──
export function TextField({ label, registration, error, required, placeholder, disabled, className }: BaseFieldProps) {
  return (
    <FieldWrapper label={label} error={error} required={required}>
      <input
        type="text"
        className={cn(inputBase, error && inputError, className)}
        placeholder={placeholder}
        disabled={disabled}
        {...registration}
      />
    </FieldWrapper>
  );
}

// ── EmailField ──
export function EmailField({ label, registration, error, required, placeholder, disabled, className }: BaseFieldProps) {
  return (
    <FieldWrapper label={label} error={error} required={required}>
      <input
        type="email"
        className={cn(inputBase, error && inputError, className)}
        placeholder={placeholder}
        disabled={disabled}
        {...registration}
      />
    </FieldWrapper>
  );
}

// ── PasswordField ──
export function PasswordField({
  label, registration, error, required, placeholder, disabled, className,
}: BaseFieldProps & { showToggle?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <FieldWrapper label={label} error={error} required={required}>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          className={cn(inputBase, 'pr-10', error && inputError, className)}
          placeholder={placeholder ?? 'Enter password'}
          disabled={disabled}
          {...registration}
        />
        <button type="button" onClick={() => setVisible(!visible)} tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </FieldWrapper>
  );
}

// ── SelectField ──
export function SelectField({
  label, registration, error, required, placeholder, disabled, className,
  options,
}: BaseFieldProps & { options: { value: string; label: string }[] }) {
  return (
    <FieldWrapper label={label} error={error} required={required}>
      <div className="relative">
        <select
          className={cn(inputBase, 'appearance-none pr-10', error && inputError, className)}
          disabled={disabled}
          {...registration}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </FieldWrapper>
  );
}

// ── DateField ──
export function DateField({ label, registration, error, required, disabled, className }: BaseFieldProps) {
  return (
    <FieldWrapper label={label} error={error} required={required}>
      <input
        type="date"
        className={cn(inputBase, error && inputError, className)}
        disabled={disabled}
        {...registration}
      />
    </FieldWrapper>
  );
}

// ── TextareaField ──
export function TextareaField({
  label, registration, error, required, placeholder, disabled, className, rows = 3,
}: BaseFieldProps & { rows?: number }) {
  return (
    <FieldWrapper label={label} error={error} required={required}>
      <textarea
        rows={rows}
        className={cn(inputBase, 'h-auto py-2 resize-y', error && inputError, className)}
        placeholder={placeholder}
        disabled={disabled}
        {...registration}
      />
    </FieldWrapper>
  );
}

// ── CheckboxField ──
export function CheckboxField({
  label, registration, error, required, disabled, className, description,
}: BaseFieldProps & { description?: string }) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-border accent-cli-emerald"
        disabled={disabled}
        {...registration}
      />
      <div>
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        {errorMessage(error) && <p className="text-xs text-destructive mt-0.5">{errorMessage(error)}</p>}
      </div>
    </div>
  );
}

// ── SwitchField ──
export function SwitchField({
  label, registration, error, required, disabled, className, description,
}: BaseFieldProps & { description?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        {errorMessage(error) && <p className="text-xs text-destructive mt-0.5">{errorMessage(error)}</p>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" className="sr-only peer" disabled={disabled} {...registration} />
        <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-cli-emerald peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all" />
      </label>
    </div>
  );
}
