"use client";

import { Building2, Users, GraduationCap, CreditCard, Activity, ShieldCheck, Bell, AlertTriangle, FileText, CheckCircle2, HeartPulse, AlertCircle, XCircle, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { EAStatCard, EASearch, EATable, EATh, EATd, EABadge, EAButton } from "@/components/ui/ea";

function useClientDate() {
  const [date, setDate] = useState("");
  useEffect(() => { setDate(new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })); }, []);
  return date;
}
const STATUS = { healthy: { icon: CheckCircle2, color: "text-cli-emerald", bg: "bg-cli-emerald/10", label: "Healthy" }, warning: { icon: AlertCircle, color: "text-cli-amber", bg: "bg-cli-amber/10", label: "Warning" }, critical: { icon: XCircle, color: "text-muted-foreground", bg: "bg-foreground/10", label: "Critical" } } as const;

function Skeleton({ className }: { className?: string }) { return <div className={cn("animate-pulse rounded-xl bg-muted/30", className)} />; }
function WidgetError({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div className="rounded-xl border border-border bg-muted/30 p-6 text-center"><AlertTriangle className="h-5 w-5 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">{message}</p>{onRetry && <button onClick={onRetry} className="mt-2 text-xs text-cli-emerald hover:underline">Retry</button>}</div>; }
function WidgetCard({ title, icon: Icon, children, className }: { title?: string; icon?: any; children: React.ReactNode; className?: string }) { return <div className={cn("rounded-xl border border-border bg-card p-5", className)}>{title && <div className="flex items-center gap-2 mb-3">{Icon && <Icon className="h-4 w-4 text-muted-foreground" />}<h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{title}</h2></div>}{children}</div>; }

interface AsyncWidgetProps<T> { data: { data: T | null; error: string | null }; skeleton: React.ReactNode; empty?: React.ReactNode; children: (data: T) => React.ReactNode; }
function AsyncWidget<T>({ data, skeleton, empty, children }: AsyncWidgetProps<T>) {
  if (data.error) return <WidgetError message={data.error} />;
  if (!data.data) return skeleton;
  const rendered = children(data.data);
  if (empty && isEmpty(rendered)) return empty;
  return <>{rendered}</>;
}
function isEmpty(node: any): boolean {
  if (!node || node === true) return true;
  if (Array.isArray(node)) return node.length === 0 || node.every(isEmpty);
  if (typeof node === "object" && node.props?.children) return isEmpty(node.props.children);
  return false;
}

type WidgetResult<T> = { data: T | null; error: string | null };

interface Props {
  userName: string;
  kpi: WidgetResult<{ schools: number; students: number; teachers: number; users: number; activeSubscriptions: number; trialSubscriptions: number }>;
  schools: WidgetResult<{ id: string; name: string; city: string | null; state: string | null; status: string; slug: string; createdAt: string; _count: { students: number } }[]>;
  events: WidgetResult<{ id: string; action: string; entity: string; recordId: string | null; createdAt: string; relative: string; userId: string | null; schoolId: string | null }[]>;
  subs: WidgetResult<{ status: string; _count: number }[]>;
  growth: WidgetResult<{ month: string; count: number }[]>;
  alerts: WidgetResult<{ type: string; message: string; severity: string }[]>;
  errors: WidgetResult<{ id: string; action: string; entity: string; createdAt: string; relative: string; schoolId: string | null }[]>;
  health: WidgetResult<Record<string, string>>;
}

export function SuperAdminDashboard({ userName, kpi, schools, events, subs, growth, alerts, errors, health }: Props) {
  const today = useClientDate();

  const severityIcon = (s: string) => s === "critical" ? <XCircle className="h-4 w-4 text-muted-foreground shrink-0" /> : s === "warning" ? <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" /> : <Info className="h-4 w-4 text-cli-blue shrink-0" />;
  const severityBg = (s: string) => s === "critical" ? "border-border bg-muted/30" : s === "warning" ? "border-border bg-muted/30" : "border-cli-blue/20 bg-cli-blue/5";
  const subColors: Record<string, string> = { ACTIVE: "bg-cli-emerald/60", TRIALING: "bg-cli-blue/60", PAST_DUE: "bg-muted-foreground/60", CANCELED: "bg-muted-foreground/40", EXPIRED: "bg-foreground/60" };

  return (
    <div className="space-y-5 p-4 sm:p-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Welcome back, {userName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Platform operations center</p>
        </div>
        <span className="hidden sm:inline text-xs font-mono text-muted-foreground">{today}</span>
      </div>

      {/* Platform Status Banner */}
      <AsyncWidget data={health} skeleton={<Skeleton className="h-12" />}>
        {(d) => {
          const svc = Object.entries(d);
          const allHealthy = svc.every(([, v]) => v === "healthy");
          return (
            <div className={cn("rounded-xl border px-4 py-3 flex items-center gap-3 text-sm", allHealthy ? "border-cli-emerald/20 bg-cli-emerald/5" : "border-border bg-muted/30")}>
              {allHealthy ? <CheckCircle2 className="h-4 w-4 text-cli-emerald shrink-0" /> : <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
              <span className="text-foreground font-medium">{allHealthy ? "All platform services are operating normally." : "Some services require attention."}</span>
              <div className="hidden sm:flex items-center gap-3 ml-auto">
                {svc.map(([k, v]) => { const s = STATUS[v as keyof typeof STATUS] || STATUS.healthy; const Icon = s.icon; return <span key={k} className={cn("flex items-center gap-1 text-xs font-mono", s.color)}><Icon className="h-3 w-3" />{k}</span>; })}
              </div>
            </div>
          );
        }}
      </AsyncWidget>

      {/* Critical Alerts */}
      <AsyncWidget data={alerts} skeleton={<Skeleton className="h-10" />}>
        {(d) => d.length > 0 ? (
          <div className="space-y-1">
            {d.filter(a => a.severity === "critical").map((a, i) => (
              <div key={i} className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm", severityBg(a.severity))}>{severityIcon(a.severity)}<span className="text-foreground">{a.message}</span></div>
            ))}
            {d.filter(a => a.severity !== "critical").map((a, i) => (
              <div key={i} className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm", severityBg(a.severity))}>{severityIcon(a.severity)}<span className="text-foreground">{a.message}</span></div>
            ))}
          </div>
        ) : null}
      </AsyncWidget>

      {/* KPI Cards */}
      <AsyncWidget data={kpi} skeleton={<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>}>
        {(d) => (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <EAStatCard icon={Building2} label="Schools" value={d.schools} color="blue" />
            <EAStatCard icon={Users} label="Students" value={d.students} color="green" />
            <EAStatCard icon={GraduationCap} label="Teachers" value={d.teachers} color="blue" />
            <EAStatCard icon={Activity} label="Users" value={d.users} color="green" />
            <EAStatCard icon={CreditCard} label="Active Subs" value={d.activeSubscriptions} color="amber" />
            <EAStatCard icon={ShieldCheck} label="Platform Health" value="Healthy" color="green" />
          </div>
        )}
      </AsyncWidget>

      {/* Growth + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AsyncWidget data={growth} skeleton={<WidgetCard title="School Growth"><Skeleton className="h-56" /></WidgetCard>}>
          {(d) => (
            <WidgetCard title="School Growth">
              <div className="space-y-1.5">
                {d.slice(-12).map((g) => { const max = Math.max(...d.map(x => x.count), 1);
                  return (<div key={g.month} className="flex items-center gap-3"><span className="text-xs font-mono text-muted-foreground w-16 shrink-0">{g.month.slice(2)}</span><div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden"><div className="h-full bg-cli-emerald/60 rounded-full transition-all" style={{ width: `${(g.count / max) * 100}%` }} /></div><span className="text-xs font-mono text-foreground w-8 text-right">{g.count}</span></div>); })}
              </div>
            </WidgetCard>
          )}
        </AsyncWidget>

        <AsyncWidget data={subs} skeleton={<WidgetCard title="Subscriptions"><Skeleton className="h-56" /></WidgetCard>}>
          {(d) => {
            const total = d.reduce((a, b) => a + b._count, 0) || 1;
            return (
              <WidgetCard title="Subscriptions">
                <div className="space-y-2.5">
                  {d.map((s) => (<div key={s.status} className="flex items-center justify-between text-sm"><span className="text-foreground">{s.status.replace(/_/g, " ")}</span><div className="flex items-center gap-2"><div className="w-28 h-4 bg-muted/30 rounded-full overflow-hidden"><div className={cn("h-full rounded-full", subColors[s.status] || "bg-muted-foreground/40")} style={{ width: `${(s._count / total) * 100}%` }} /></div><span className="text-xs font-mono text-muted-foreground w-5">{s._count}</span></div></div>))}
                </div>
              </WidgetCard>
            );
          }}
        </AsyncWidget>
      </div>

      {/* Activity + Errors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AsyncWidget data={events} skeleton={<WidgetCard title="Recent Activity"><Skeleton className="h-64" /></WidgetCard>}>
          {(d) => (
            <WidgetCard title="Recent Activity">
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {d.map((e) => (<div key={e.id} className="flex items-start gap-3 text-sm py-1"><div className="h-2 w-2 rounded-full bg-cli-emerald mt-1.5 shrink-0" /><div className="flex-1 min-w-0"><p className="text-foreground truncate">{e.action.replace(/_/g, " ")} — {e.entity}</p><p className="text-xs text-muted-foreground">{e.relative}</p></div></div>))}
              </div>
            </WidgetCard>
          )}
        </AsyncWidget>

        <AsyncWidget data={errors} skeleton={<WidgetCard title="Recent Errors"><Skeleton className="h-64" /></WidgetCard>}>
          {(d) => d.length > 0 ? (
            <WidgetCard title="Recent Errors">
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {d.map((e) => (<div key={e.id} className="flex items-start gap-3 text-sm py-1"><div className="h-2 w-2 rounded-full bg-foreground mt-1.5 shrink-0" /><div className="flex-1 min-w-0"><p className="text-foreground truncate">{e.action} — {e.entity}</p><p className="text-xs text-muted-foreground">{e.relative}</p></div></div>))}
              </div>
              <a href="/dashboard/super-admin" className="block mt-3 text-xs font-mono text-cli-blue hover:underline text-center">View All →</a>
            </WidgetCard>
          ) : (
            <WidgetCard title="Recent Errors"><div className="py-12 text-center"><CheckCircle2 className="h-8 w-8 text-cli-emerald/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No recent errors</p></div></WidgetCard>
          )}
        </AsyncWidget>
      </div>

      {/* Recent Schools */}
      <AsyncWidget data={schools} skeleton={<WidgetCard title="Recent Schools"><Skeleton className="h-48" /></WidgetCard>}>
        {(d) => (
          <WidgetCard title="Recent Schools">
            <div className="overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">School</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase hidden sm:table-cell">Location</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Students</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Status</th></tr></thead><tbody>{d.map((s) => (<tr key={s.id} className="border-b border-border/40"><td className="py-2 font-medium text-foreground">{s.name}</td><td className="py-2 text-muted-foreground hidden sm:table-cell">{s.city || s.state || "—"}</td><td className="py-2 font-mono text-muted-foreground">{s._count.students}</td><td className="py-2"><span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border", s.status === "ACTIVE" ? "bg-cli-emerald/10 text-cli-emerald border-cli-emerald/30" : s.status === "TRIALING" ? "bg-cli-blue/10 text-cli-blue border-cli-blue/30" : "bg-muted/50 text-muted-foreground border-border")}><span className={cn("h-1.5 w-1.5 rounded-full", s.status === "ACTIVE" ? "bg-cli-emerald" : s.status === "TRIALING" ? "bg-cli-blue" : "bg-muted-foreground")} />{s.status}</span></td></tr>))}</tbody></table>
            </div>
          </WidgetCard>
        )}
      </AsyncWidget>

      {/* Quick Actions */}
      <WidgetCard title="Quick Actions">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[{ icon: HeartPulse, label: "Platform Health", href: "/dashboard/super-admin/platform-health" }, { icon: FileText, label: "Audit Logs", href: "/dashboard/super-admin/audit-logs" }, { icon: AlertTriangle, label: "Error Logs", href: "/dashboard/super-admin/error-logs" }].map((a) => (
            <a key={a.label} href={a.href} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors text-sm"><a.icon className="h-4 w-4 text-cli-emerald shrink-0" /><span className="font-medium text-foreground">{a.label}</span></a>
          ))}
        </div>
      </WidgetCard>
    </div>
  );
}
