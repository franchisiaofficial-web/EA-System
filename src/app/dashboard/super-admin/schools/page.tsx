import { getAuthContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { authPrisma } from "@/lib/prisma/auth-client";
import { SchoolsClient } from "./SchoolsClient";

export default async function SchoolsPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");
  if (authCtx.role !== "SUPER_ADMIN") redirect("/dashboard");

  const [items, total, counts] = await Promise.all([
    authPrisma.school.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { _count: { select: { students: true, memberships: true } }, subscription: { select: { status: true, plan: { select: { name: true } } } } } }),
    authPrisma.school.count(),
    Promise.all([authPrisma.school.count(), authPrisma.school.count({ where: { status: "ACTIVE" } }), authPrisma.subscription.count({ where: { status: "TRIALING" } }), authPrisma.school.count({ where: { status: "SUSPENDED" } }), authPrisma.subscription.count({ where: { status: "PAST_DUE" } })]),
  ]);

  const mapped = items.map((s: any) => ({ id: s.id, name: s.name, slug: s.slug, city: s.city, state: s.state, status: s.status, createdAt: s.createdAt.toISOString(), plan: s.subscription?.plan?.name || s.subscription?.status || "—", students: s._count.students, teachers: s._count.memberships }));
  const summary = { total: counts[0], active: counts[1], trial: counts[2], suspended: counts[3], expired: counts[4] };

  return <SchoolsClient initialItems={mapped} initialTotal={total} summary={summary} />;
}
