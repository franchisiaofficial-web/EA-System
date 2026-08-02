"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, ChevronRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormContext, Controller } from "react-hook-form";
import { cn } from "@/lib/utils";
import { preserve, type InputFormatter } from "@/lib/format-input";

export function PageHeader({ title, subtitle, backHref, back, actions }: { title: string; subtitle?: string; backHref?: string; back?: boolean; actions?: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="mb-6">
      {backHref && (
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ArrowLeft className="h-4 w-4" />Back
        </Link>
      )}
      {back && (
        <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3 cursor-pointer">
          <ArrowLeft className="h-4 w-4" />Back
        </button>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export function PageCard({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <div id={id} className={cn("rounded-2xl border border-border bg-card p-5 sm:p-6 w-full max-w-[1280px] shadow-[0_4px_16px_rgba(15,23,42,0.05)]", className)}>{children}</div>;
}

export function FormGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  return <div className={cn("grid gap-4", cols === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>{children}</div>;
}

export function FormField({ label, children, required, span }: { label: string; children: React.ReactNode; required?: boolean; span?: boolean }) {
  return (
    <div className={cn("space-y-1.5", span && "sm:col-span-2")}>
      <label className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
        {label}{required && <span className="text-foreground ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export function EAInput({ className, format, onChange, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { format?: InputFormatter }) {
  const fmt = format ?? preserve;
  return (
    <input
      {...props}
      onChange={(e) => {
        if (format) {
          const next = fmt(e.target.value);
          if (next !== e.target.value) {
            e.target.value = next;
            onChange?.(e);
          } else {
            onChange?.(e);
          }
        } else {
          onChange?.(e);
        }
      }}
      className={cn("h-11 w-full rounded-xl bg-card border border-input px-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10 transition-all duration-200", className)}
    />
  );
}

export function EATextarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("w-full rounded-xl bg-card border border-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10 transition-all duration-200 resize-y min-h-[100px]", className)} />;
}

export function FooterActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-3 pt-2">{children}</div>;
}

export function PageSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-mono font-bold text-muted-foreground/70 uppercase tracking-[0.12em] mb-3">{title}</h3>
      {children}
    </div>
  );
}

export function EASelectCustom({
  value, onChange, options, placeholder = "Select...", className,
}: {
  value: string; onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button type="button" onClick={() => setOpen(!open)}
        className="h-11 w-full rounded-xl bg-card border border-input px-4 text-sm text-foreground text-left flex items-center justify-between gap-2 focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10 transition-all duration-200"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>{selected?.label || placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-xl max-h-60 overflow-y-auto py-1">
          {options.map(opt => (
            <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn("w-full text-left px-4 py-2.5 text-sm transition-colors",
                opt.value === value ? "bg-ea-green/10 text-foreground font-medium" : "text-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FormSelect({
  name, options, placeholder, className,
}: {
  name: string; options: { value: string; label: string }[];
  placeholder?: string; className?: string;
}) {
  const { control } = useFormContext();
  return (
    <Controller name={name} control={control}
      render={({ field }) => (
        <EASelectCustom value={field.value || ""} onChange={field.onChange}
          options={options} placeholder={placeholder} className={className} />
      )}
    />
  );
}

export function SidePanel({ title, items }: { title: string; items: { label: string; value: string | number; href?: string; accent?: string }[] }) {
  const statusColor = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === "active" || s === "paid") return "bg-ea-green/15 text-foreground";
    if (s === "pending" || s === "draft") return "bg-muted/60 text-muted-foreground";
    if (s === "inactive" || s === "archived" || s === "overdue") return "bg-muted/60 text-foreground";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 min-w-[220px] shadow-[0_4px_16px_rgba(15,23,42,0.05)]">
      <h4 className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.15em]">{title}</h4>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i}>
            <p className="text-[11px] font-mono text-muted-foreground/80 uppercase tracking-wider mb-0.5">{item.label}</p>
            {item.accent ? (
              <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold", statusColor(String(item.value)))}>
                <span className={cn("h-1.5 w-1.5 rounded-full", String(item.value).toLowerCase() === "active" || String(item.value).toLowerCase() === "paid" ? "bg-ea-green" : "bg-current")} />
                {item.value}
              </span>
            ) : item.href ? (
              <Link href={item.href} className="inline-flex items-center gap-1.5 text-sm text-foreground font-medium hover:text-ea-green transition-colors">
                {item.value}<ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              </Link>
            ) : (
              <p className="text-sm text-foreground font-medium">{item.value}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Breadcrumb({ items }: { items: { label: string; href?: string; icon?: React.ReactNode }[] }) {
  return (
    <nav className="flex items-center gap-1.5 mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
          {item.icon && <span className="text-muted-foreground/60">{item.icon}</span>}
          {item.href ? (
            <Link href={item.href} className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">{item.label}</Link>
          ) : (
            <span className="text-xs font-mono text-muted-foreground/70">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
