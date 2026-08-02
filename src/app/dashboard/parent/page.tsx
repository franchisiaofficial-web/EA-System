import { getAuthContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { ParentDashboardClient } from "./ParentDashboardClient";

export default async function ParentDashboardPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");
  return <ParentDashboardClient parentName={authCtx.email?.split("@")[0] || "Parent"} />;
}
