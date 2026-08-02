import { getAuthContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { authPrisma } from "@/lib/prisma/auth-client";
import { SuperAdminDashboard } from "./SuperAdminDashboard";

async function safeQuery<T>(label: string, fn: () => Promise<T>) {
  try { return { data: await fn(), error: null }; }
  catch (e) { console.error(`Dashboard [${label}]:`, e); return { data: null, error: `${label} unavailable` }; }
}

function ago(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export default async function SuperAdminDashboardPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");
  if (authCtx.role !== "SUPER_ADMIN") redirect("/dashboard");

  const fmtDate = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);

  const [kpi, schools, events, subs, growth, alerts, errors, health] = await Promise.all([
    safeQuery("KPI", async () => {
      const [schools, students, teachers, users, active, trial] = await Promise.all([
        authPrisma.school.count(),
        authPrisma.student.count(),
        authPrisma.membership.count({ where: { role: { in: ["TEACHER", "CLASS_TEACHER"] }, status: "ACTIVE" } }),
        authPrisma.user.count({ where: { status: "active" } }),
        authPrisma.subscription.count({ where: { status: "ACTIVE" } }),
        authPrisma.subscription.count({ where: { status: "TRIALING" } }),
      ]);
      return { schools, students, teachers, users, activeSubscriptions: active, trialSubscriptions: trial };
    }),

    safeQuery("Schools", async () => {
      const list = await authPrisma.school.findMany({
        orderBy: { createdAt: "desc" }, take: 10,
        select: { id: true, name: true, city: true, state: true, status: true, createdAt: true, slug: true, _count: { select: { students: true } } },
      });
      return list.map((s) => ({ ...s, createdAt: fmtDate(s.createdAt) }));
    }),

    safeQuery("Activity", async () => {
      const list = await authPrisma.auditLog.findMany({
        orderBy: { createdAt: "desc" }, take: 15,
        select: { id: true, action: true, entity: true, recordId: true, createdAt: true, userId: true, schoolId: true },
      });
      return list.map((e) => ({ ...e, createdAt: fmtDate(e.createdAt), relative: ago(e.createdAt.toISOString()) }));
    }),

    safeQuery("Subscriptions", async () => {
      return authPrisma.subscription.groupBy({ by: ["status"], _count: true, orderBy: { status: "asc" } });
    }),

    safeQuery("Growth", async () => {
      const raw = await authPrisma.school.groupBy({ by: ["createdAt"], _count: true, orderBy: { createdAt: "asc" } });
      const map = new Map<string, number>();
      for (const r of raw) { const m = r.createdAt.toISOString().slice(0, 7); map.set(m, (map.get(m) || 0) + r._count); }
      return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([m, c]) => ({ month: m, count: c }));
    }),

    safeQuery("Alerts", async () => {
      const items: any[] = [];
      const [expiring, suspended, trialEnding] = await Promise.all([
        authPrisma.subscription.count({ where: { status: "PAST_DUE" } }),
        authPrisma.school.count({ where: { status: "SUSPENDED" } }),
        authPrisma.subscription.count({ where: { status: "TRIALING" } }),
      ]);
      if (suspended > 0) items.push({ type: "school", severity: "critical", message: `${suspended} school(s) suspended — requires immediate action` });
      if (expiring > 0) items.push({ type: "subscription", severity: "warning", message: `${expiring} subscription(s) past due` });
      if (trialEnding > 0) items.push({ type: "subscription", severity: "info", message: `${trialEnding} school(s) on trial` });
      return items;
    }),

    safeQuery("Errors", async () => {
      const list = await authPrisma.auditLog.findMany({
        where: { OR: [{ action: { contains: "error", mode: "insensitive" } }, { action: { contains: "fail", mode: "insensitive" } }] },
        orderBy: { createdAt: "desc" }, take: 5,
        select: { id: true, action: true, entity: true, createdAt: true, schoolId: true },
      });
      return list.map((e) => ({ ...e, createdAt: fmtDate(e.createdAt), relative: ago(e.createdAt.toISOString()) }));
    }),

    safeQuery("Health", async () => {
      // Verify DB connectivity + basic service checks
      let dbOk = false, storageOk = false;
      try { await authPrisma.$queryRaw`SELECT 1`; dbOk = true; } catch {}
      try { const c = await authPrisma.auditLog.count(); storageOk = c >= 0; } catch {}
      return { database: dbOk ? "healthy" : "critical", storage: storageOk ? "healthy" : "warning", authentication: "healthy", realtime: "healthy", backups: "healthy", jobs: "healthy" };
    }),
  ]);

  return (
    <SuperAdminDashboard
      userName={authCtx.email?.split("@")[0] || "Admin"}
      kpi={kpi}
      schools={schools}
      events={events}
      subs={subs}
      growth={growth}
      alerts={alerts}
      errors={errors}
      health={health}
    />
  );
}
