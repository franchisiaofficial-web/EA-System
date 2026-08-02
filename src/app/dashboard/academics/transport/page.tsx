import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { withRls } from "@/lib/prisma/rls-middleware";

export default async function TransportPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");
  const rc = toRequestContext(authCtx);
  const vehicles = await withRls(rc, (tx) => tx.vehicle.findMany({ where: { schoolId: authCtx.schoolId, isActive: true } }));
  const assignments = await withRls(rc, (tx) => tx.transportAssignment.findMany({
    where: { schoolId: authCtx.schoolId, isActive: true },
    include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } }, route: { select: { name: true } }, vehicle: { select: { name: true, vehicleNo: true } } },
    take: 20,
  }));

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-5xl mx-auto">
      <div><h1 className="text-xl font-bold text-foreground">Transport</h1><p className="text-xs text-muted-foreground">Manage vehicles and student transport assignments</p></div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Vehicles ({vehicles.length})</h2>
        {vehicles.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No vehicles registered.</p> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {vehicles.map((v: any) => (
              <div key={v.id} className="p-4 rounded-lg border border-border bg-muted/20">
                <p className="font-medium text-foreground">{v.name} — <span className="text-xs font-mono text-muted-foreground">{v.vehicleNo}</span></p>
                <p className="text-xs text-muted-foreground mt-1">Type: {v.type} • Capacity: {v.capacity}</p>
                {v.driverName && <p className="text-xs text-muted-foreground">Driver: {v.driverName} {v.driverPhone ? `(${v.driverPhone})` : ""}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Student Assignments</h2>
        {assignments.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No transport assignments.</p> : (
          <table className="w-full text-sm"><thead><tr className="border-b border-border text-left"><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Student</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Vehicle</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Route</th><th className="pb-2 font-mono text-xs text-muted-foreground uppercase">Pickup</th></tr></thead>
            <tbody>{assignments.map((a: any) => (<tr key={a.id} className="border-b border-border/30"><td className="py-2">{a.student?.firstName} {a.student?.lastName}</td><td className="py-2 text-muted-foreground text-xs">{a.vehicle?.name || "—"}</td><td className="py-2 text-muted-foreground text-xs">{a.route?.name || "—"}</td><td className="py-2 text-muted-foreground text-xs">{a.pickupPoint || "—"}</td></tr>))}</tbody></table>
        )}
      </div>
    </div>
  );
}
