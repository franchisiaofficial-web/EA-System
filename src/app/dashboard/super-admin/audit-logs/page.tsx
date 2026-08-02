import { getAuthContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { authPrisma } from "@/lib/prisma/auth-client";
import { AuditLogsClient } from "./AuditLogsClient";

export default async function AuditLogsPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");
  if (authCtx.role !== "SUPER_ADMIN") redirect("/dashboard");

  const [items, total, todayCount, loginCount] = await Promise.all([
    authPrisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, action: true, entity: true, recordId: true, userId: true, schoolId: true, before: true, after: true, createdAt: true, ipAddress: true, userAgent: true } }),
    authPrisma.auditLog.count(),
    authPrisma.auditLog.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    authPrisma.auditLog.count({ where: { action: { in: ["sign_in", "login", "sign_in_email"] } } }),
  ]);

  const mapped = items.map((i: any) => ({
    ...i,
    createdAt: i.createdAt.toISOString(),
  }));

  return <AuditLogsClient initialItems={mapped} initialTotal={total} todayCount={todayCount} loginCount={loginCount} />;
}
