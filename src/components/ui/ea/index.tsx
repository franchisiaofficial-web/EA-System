import { cn } from "@/lib/utils";
import { forwardRef } from "react";

const variants = {
  primary: "bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:bg-primary/80 ",
  secondary: "bg-card text-foreground border border-border hover:bg-muted",
  danger: "bg-primary text-primary-foreground hover:bg-primary/90 ",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
};

const sizes = { sm: "h-8 px-3 text-xs rounded-lg", md: "h-10 px-4 text-sm rounded-xl", lg: "h-12 px-6 text-base rounded-xl" };

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const EAButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => (
    <button ref={ref} className={cn("inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 active:scale-[0.98]", variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  )
);
EAButton.displayName = "EAButton";

export const EATable = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-2xl border border-border bg-card overflow-hidden", className)}>
    <table className="w-full">{children}</table>
  </div>
);

export const EATh = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <th className={cn("px-4 py-3 text-left text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.1em] bg-muted/50 sticky top-0", className)}>{children}</th>
);

export const EATd = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn("px-4 py-3 text-sm text-foreground/85 border-t border-border", className)}>{children}</td>
);

export const EABadge = ({ children, color = "green" }: { children: React.ReactNode; color?: "green" | "red" | "amber" | "blue" | "gray" }) => {
  const c = { green: "bg-muted/60 text-foreground", red: "bg-muted/60 text-foreground", amber: "bg-muted/60 text-muted-foreground", blue: "bg-muted/60 text-muted-foreground", gray: "bg-muted text-muted-foreground" }[color];
  return <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold", c)}>{children}</span>;
};

export const EAStatCard = ({ label, value, icon: Icon, color = "green" }: { label: string; value: string | number; icon: any; color?: string }) => {
  const bg = color === "green" ? "bg-muted/60" : color === "blue" ? "bg-muted/60" : color === "amber" ? "bg-muted/60" : color === "purple" ? "bg-muted/60" : "bg-muted";
  const ic = color === "green" ? "text-foreground" : color === "blue" ? "text-muted-foreground" : color === "amber" ? "text-muted-foreground" : color === "purple" ? "text-muted-foreground" : "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 hover:border-border hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", bg)}><Icon className={cn("h-5 w-5", ic)} /></div>
      </div>
      <p className="text-2xl font-bold text-foreground font-mono tracking-tight">{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
};

export const EASearch = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <div className="relative">
    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || "Search..."} className="h-10 w-full rounded-xl bg-card border border-input pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ea-green focus:ring-4 focus:ring-ea-green/10 transition-all" />
  </div>
);
