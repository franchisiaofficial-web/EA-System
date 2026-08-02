import { getAuthContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { getErrorLogs } from "@/services/error-log.service";
import { ErrorLogsClient } from "./ErrorLogsClient";

export default async function ErrorLogsPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");
  if (authCtx.role !== "SUPER_ADMIN") redirect("/dashboard");

  const raw = await getErrorLogs({ page: 1, pageSize: 50 });
  const data = { ...raw, items: raw.items.map((i: any) => ({ ...i, firstOccurredAt: i.firstOccurredAt.toISOString(), lastOccurredAt: i.lastOccurredAt.toISOString(), resolvedAt: i.resolvedAt?.toISOString() ?? null, createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt?.toISOString() })) };

  return <ErrorLogsClient initialData={data} />;
}
