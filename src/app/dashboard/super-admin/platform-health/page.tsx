import { getAuthContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { authPrisma } from "@/lib/prisma/auth-client";
import { PlatformHealth } from "./PlatformHealth";

async function safeQuery<T>(label: string, fn: () => Promise<T>) {
  try { return { data: await fn(), error: null }; }
  catch (e) { console.error(`Health [${label}]:`, e); return { data: null, error: `${label} unavailable` }; }
}

export default async function PlatformHealthPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");
  if (authCtx.role !== "SUPER_ADMIN") redirect("/dashboard");

  const [db, auth, storage, api, jobs, events] = await Promise.all([
    safeQuery("Database", async () => {
      const start = Date.now();
      await authPrisma.$queryRaw`SELECT 1`;
      return { latency: Date.now() - start, connections: "ok" };
    }),
    safeQuery("Auth", async () => {
      const start = Date.now();
      const count = await authPrisma.user.count();
      return { latency: Date.now() - start, users: count };
    }),
    safeQuery("Storage", async () => {
      const start = Date.now();
      const count = await authPrisma.auditLog.count();
      return { latency: Date.now() - start, accessible: count >= 0 };
    }),
    safeQuery("API", async () => {
      const start = Date.now();
      const count = await authPrisma.school.count();
      return { latency: Date.now() - start, schools: count };
    }),
    safeQuery("Jobs", async () => {
      const [queued, failed] = await Promise.all([
        authPrisma.auditLog.count({ where: { action: { contains: "create", mode: "insensitive" } } }),
        authPrisma.auditLog.count({ where: { OR: [{ action: { contains: "error", mode: "insensitive" } }, { action: { contains: "fail", mode: "insensitive" } }] } }),
      ]);
      return { completed: queued, failed };
    }),
    safeQuery("Events", async () => {
      const list = await authPrisma.auditLog.findMany({
        orderBy: { createdAt: "desc" }, take: 20,
        select: { id: true, action: true, entity: true, createdAt: true },
      });
      return list.map((e) => ({ ...e, createdAt: e.createdAt.toISOString().replace("T", " ").slice(0, 19) }));
    }),
  ]);

  return (
    <PlatformHealth
      db={db}
      auth={auth}
      storage={storage}
      api={api}
      jobs={jobs}
      events={events}
    />
  );
}
