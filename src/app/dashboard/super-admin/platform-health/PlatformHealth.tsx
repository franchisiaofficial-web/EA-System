"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Database, Shield, HardDrive, Globe, Wrench, Activity, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type HealthStatus = "healthy" | "warning" | "critical" | "unknown";
const ST: Record<HealthStatus, { icon: any; color: string; bg: string; label: string }> = {
  healthy: { icon: CheckCircle2, color: "text-cli-emerald", bg: "bg-cli-emerald/10", label: "Healthy" },
  warning: { icon: AlertCircle, color: "text-muted-foreground", bg: "bg-muted/60", label: "Warning" },
  critical: { icon: XCircle, color: "text-muted-foreground", bg: "bg-foreground/10", label: "Critical" },
  unknown: { icon: AlertCircle, color: "text-muted-foreground", bg: "bg-muted/20", label: "Unknown" },
};

function statusFromLatency(ms: number): HealthStatus {
  if (ms < 0) return "unknown";
  if (ms < 200) return "healthy";
  if (ms < 1000) return "warning";
  return "critical";
}

function useNow() { const [n, setN] = useState(Date.now()); useEffect(() => { const i = setInterval(() => setN(Date.now()), 1000); return () => clearInterval(i); }, []); return n; }

function ServiceCard({ name, icon: Icon, status, latency, detail, lastChecked }: { name: string; icon: any; status: HealthStatus; latency?: number; detail?: string; lastChecked: string }) {
  const s = ST[status];
  const serviceKey = name.toLowerCase();
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", s.bg)}><Icon className={cn("h-4.5 w-4.5", s.color)} /></div>
          <div><p className="text-sm font-semibold text-foreground">{name}</p><p className="text-xs text-muted-foreground font-mono">Checked {lastChecked}</p></div>
        </div>
        <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono border", s.bg, s.color, status === "healthy" ? "border-cli-emerald/30" : status === "warning" ? "border-border" : "border-border")}>
          <s.icon className="h-3.5 w-3.5" />{s.label}
        </span>
      </div>
      {latency !== undefined && <p className="text-xs text-muted-foreground">Response: {latency}ms</p>}
      {detail && <p className="text-xs text-muted-foreground mt-1">{detail}</p>}
      {status !== "healthy" && (
        <a href={`/dashboard/super-admin/error-logs?service=${serviceKey}&severity=WARNING`} className="inline-block mt-2 text-xs font-mono text-cli-blue hover:underline">View Errors →</a>
      )}
    </div>
  );
}

type WR<T> = { data: T | null; error: string | null };

interface Props {
  db: WR<{ latency: number; connections: string }>;
  auth: WR<{ latency: number; users: number }>;
  storage: WR<{ latency: number; accessible: boolean }>;
  api: WR<{ latency: number; schools: number }>;
  jobs: WR<{ completed: number; failed: number }>;
  events: WR<{ id: string; action: string; entity: string; createdAt: string }[]>;
}

export function PlatformHealth({ db, auth, storage, api, jobs, events }: Props) {
  const now = useNow();
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);

  const doRefresh = useCallback(() => { setRefreshing(true); setLastRefresh(Date.now()); setTimeout(() => setRefreshing(false), 500); }, []);

  const checked = (t: number) => `${Math.round((now - t) / 1000)}s ago`;

  const services = [
    { name: "Database", icon: Database, data: db, detail: (d: any) => `${d.latency}ms response` },
    { name: "Authentication", icon: Shield, data: auth, detail: (d: any) => `${d.users.toLocaleString()} users` },
    { name: "Storage", icon: HardDrive, data: storage, detail: (d: any) => d.accessible ? "Accessible" : "Unavailable" },
    { name: "API", icon: Globe, data: api, detail: (d: any) => `${d.schools} schools via API` },
  ];

  const overallStatus: HealthStatus = services.some((s) => s.data.error)
    ? "warning"
    : services.every((s) => s.data.data && statusFromLatency(s.data.data.latency) === "healthy")
    ? "healthy"
    : services.some((s) => s.data.data && statusFromLatency(s.data.data.latency) === "critical")
    ? "critical"
    : "warning";

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard/super-admin" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></a>
          <div><h1 className="text-xl font-bold text-foreground">Platform Health</h1><p className="text-xs text-muted-foreground font-mono">Last updated: {checked(lastRefresh)}</p></div>
        </div>
        <button onClick={doRefresh} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted/30 transition-colors", refreshing && "animate-spin")}><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>

      {/* Overall Status */}
      {(() => { const s = ST[overallStatus]; return (
        <div className={cn("rounded-xl border p-5 flex items-center gap-4", overallStatus === "healthy" ? "border-cli-emerald/30 bg-cli-emerald/5" : overallStatus === "warning" ? "border-border bg-muted/30" : "border-border bg-muted/30")}>
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", s.bg)}><s.icon className={cn("h-6 w-6", s.color)} /></div>
          <div><p className="text-lg font-bold text-foreground">Platform is {s.label.toLowerCase()}</p><p className="text-sm text-muted-foreground">{overallStatus === "healthy" ? "All services are operating normally." : overallStatus === "warning" ? "Some services are experiencing elevated latency." : "Critical services require immediate attention."}</p></div>
        </div>
      );})()}

      {/* Core Services */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((svc) => (
          svc.data.error ? (
            <div key={svc.name} className="rounded-xl border border-border bg-muted/30 p-5"><p className="text-sm text-muted-foreground">{svc.data.error}</p></div>
          ) : svc.data.data ? (
            <ServiceCard key={svc.name} name={svc.name} icon={svc.icon} status={statusFromLatency(svc.data.data.latency)} latency={svc.data.data.latency} detail={svc.detail(svc.data.data)} lastChecked={checked(lastRefresh)} />
          ) : (
            <div key={svc.name} className="rounded-xl border border-border bg-card p-5 animate-pulse"><div className="h-16 bg-muted/30 rounded-lg" /></div>
          )
        ))}
      </div>

      {/* Background Jobs */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Background Jobs</h2>
          {jobs.data && (() => {
            const total = jobs.data.completed + jobs.data.failed;
            const rate = total > 0 ? (jobs.data.failed / total) * 100 : 0;
            const st = jobs.data.failed === 0 ? ST.healthy : rate < 5 ? ST.warning : ST.critical;
            return <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border", st.color, st.bg)}><st.icon className="h-3 w-3" />{st.label}</span>;
          })()}
        </div>
        {jobs.error ? <p className="text-sm text-muted-foreground">{jobs.error}</p> : jobs.data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[{ label: "Completed", value: jobs.data.completed, color: "text-cli-emerald" }, { label: "Failed", value: jobs.data.failed, color: jobs.data.failed > 0 ? "text-muted-foreground" : "text-cli-emerald" }].map((j) => (
              <div key={j.label} className="text-center"><p className={cn("text-2xl font-bold font-mono", j.color)}>{j.value.toLocaleString()}</p><p className="text-xs text-muted-foreground mt-1">{j.label}</p></div>
            ))}
          </div>
        ) : <div className="h-16 bg-muted/30 rounded-lg animate-pulse" />}
      </div>

      {/* Recent Health Events */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Recent Health Events</h2>
        {events.error ? <p className="text-sm text-muted-foreground">{events.error}</p> : events.data ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {events.data.map((e) => (
              <div key={e.id} className="flex items-start gap-3 text-sm py-1">
                <div className="h-2 w-2 rounded-full bg-cli-emerald mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-foreground truncate">{e.action.replace(/_/g, " ")} — {e.entity}</p><p className="text-xs text-muted-foreground">{e.createdAt}</p></div>
              </div>
            ))}
          </div>
        ) : <div className="h-32 bg-muted/30 rounded-lg animate-pulse" />}
      </div>
    </div>
  );
}
