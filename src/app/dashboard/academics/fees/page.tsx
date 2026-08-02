import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { getInvoices, getFeeStructures } from "@/services/fee.service";
import { FeesClient } from "./FeesClient";

export default async function FeesPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");
  const rc = toRequestContext(authCtx);

  const [invoices, structures] = await Promise.all([
    getInvoices(authCtx.schoolId, { page: 1, pageSize: 20 }, rc),
    getFeeStructures(authCtx.schoolId, rc),
  ]);

  return <FeesClient invoices={invoices} structures={structures} />;
}
