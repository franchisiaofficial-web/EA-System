"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, Pencil, ShieldCheck, ShieldOff, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageCard } from "@/components/ui/ea/layout";
import { EntityActionBar } from "@/components/crud/EntityActionBar";
import { ConfirmDialog } from "@/components/crud/ConfirmDialog";
import { EAButton } from "@/components/ui/ea";

interface StaffMember {
  id: string;
  userId: string;
  employeeId: string;
  fullName: string;
  email: string;
  phone: string | null;
  designation: string;
  role: string;
  status: string;
}

export function StaffList({ canCreate, canUpdate }: { canCreate: boolean; canUpdate: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<StaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [suspendTarget, setSuspendTarget] = useState<StaffMember | null>(null);
  const didLoad = useRef(false);

  const load = useCallback(async (p: number, s: string, r: string) => {
    const params = new URLSearchParams({ page: String(p), pageSize: "50" });
    if (s) params.set("search", s);
    if (r) params.set("role", r);
    const res = await fetch(`/api/staff/members?${params}`);
    const data = await res.json();
    if (data.success) { setItems(data.data.items); setTotal(data.data.total); setTotalPages(data.data.totalPages); }
    else toast.error("Failed to load staff");
  }, []);

  useEffect(() => { if (!didLoad.current) { didLoad.current = true; void load(page, search, roleFilter); } }, [page, search, roleFilter, load]);

  const handleToggleStatus = async (member: StaffMember) => {
    const nextStatus = member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const res = await fetch(`/api/staff/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const r = await res.json();
    if (r.success) { toast.success(member.status === "ACTIVE" ? "Member suspended" : "Member reactivated"); setSuspendTarget(null); void load(page, search, roleFilter); }
    else toast.error(r.error?.message || "Failed");
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Staff" />
      <EntityActionBar entityLabel="Staff Member" createHref={canCreate ? "/dashboard/staff/create" : undefined} onRefresh={() => void load(page, search, roleFilter)} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); void load(1, e.target.value, roleFilter); }}
            placeholder="Search by name, email, or phone..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-cli-blue/30"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); void load(1, search, e.target.value); }}
          className="px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cli-blue/30"
        >
          <option value="">All Roles</option>
          <option value="PRINCIPAL">Principal</option>
          <option value="VICE_PRINCIPAL">Vice Principal</option>
          <option value="HR">HR</option>
          <option value="ACCOUNTANT">Accountant</option>
          <option value="TEACHER">Teacher</option>
          <option value="CLASS_TEACHER">Class Teacher</option>
          <option value="NON_TEACHING">Non-Teaching</option>
          <option value="LIBRARIAN">Librarian</option>
          <option value="TRANSPORT_MANAGER">Transport Manager</option>
          <option value="DRIVER">Driver</option>
          <option value="CAFETERIA_STAFF">Cafeteria Staff</option>
        </select>
      </div>

      <PageCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">Employee ID</th>
                <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">Name</th>
                <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">Email</th>
                <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">Designation</th>
                <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">Role</th>
                <th className="px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">Status</th>
                <th className="px-4 py-3 text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(m => (
                <tr key={m.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{m.employeeId}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{m.fullName}</td>
                  <td className="px-4 py-3 text-muted-foreground/80">{m.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.designation}</td>
                  <td className="px-4 py-3"><span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted/60 border border-border text-foreground">{m.role}</span></td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-mono ${m.status === "ACTIVE" ? "text-cli-emerald" : m.status === "SUSPENDED" ? "text-cli-amber" : "text-muted-foreground"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${m.status === "ACTIVE" ? "bg-cli-emerald" : m.status === "SUSPENDED" ? "bg-cli-amber" : "bg-muted-foreground"}`} />
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canUpdate && (
                        <>
                          <EAButton variant="secondary" size="sm" onClick={() => router.push(`/dashboard/staff/${m.id}/edit`)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                          </EAButton>
                          <EAButton
                            variant="secondary"
                            size="sm"
                            className={m.status === "ACTIVE" ? "text-cli-rose" : "text-cli-emerald"}
                            onClick={() => setSuspendTarget(m)}
                          >
                            {m.status === "ACTIVE" ? <ShieldOff className="h-3.5 w-3.5 mr-1" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
                            {m.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                          </EAButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground/70 font-mono">No staff members found</p>
          </div>
        )}
      </PageCard>

      <ConfirmDialog
        open={!!suspendTarget}
        title={suspendTarget?.status === "ACTIVE" ? "Suspend Member" : "Reactivate Member"}
        message={suspendTarget?.status === "ACTIVE" ? `Suspend ${suspendTarget?.fullName}? They will lose access until reactivated.` : `Reactivate ${suspendTarget?.fullName}?`}
        confirmLabel={suspendTarget?.status === "ACTIVE" ? "Suspend" : "Reactivate"}
        onConfirm={() => suspendTarget && handleToggleStatus(suspendTarget)}
        onCancel={() => setSuspendTarget(null)}
      />

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => { setPage(p); void load(p, search, roleFilter); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${p === page ? "bg-muted/60 text-foreground" : "text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/50"}`}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
