"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Users, Pencil, Eye, Archive, RotateCcw, ShieldOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageCard } from "@/components/ui/ea/layout";
import { EntityActionBar } from "@/components/crud/EntityActionBar";
import { EAButton } from "@/components/ui/ea";
import { LifecycleDialog } from "./LifecycleDialog";

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

interface PermissionFlags {
  canCreate: boolean;
  canUpdate: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canDeactivate: boolean;
  canReactivate: boolean;
}

type DialogState =
  | { type: "archive"; member: StaffMember }
  | { type: "restore"; member: StaffMember }
  | { type: "deactivate"; member: StaffMember }
  | { type: "reactivate"; member: StaffMember }
  | null;

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "REMOVED", label: "Archived" },
];

export function StaffList(props: PermissionFlags) {
  const { canCreate, canUpdate, canArchive, canRestore, canDeactivate, canReactivate } = props;
  const router = useRouter();
  const [items, setItems] = useState<StaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busy, setBusy] = useState(false);
  const didLoad = useRef(false);

  const load = useCallback(async (p: number, s: string, r: string, st: string) => {
    const params = new URLSearchParams({ page: String(p), pageSize: "50" });
    if (s) params.set("search", s);
    if (r) params.set("role", r);
    if (st && st !== "ALL") params.set("status", st);
    const res = await fetch(`/api/staff/members?${params}`);
    const data = await res.json();
    if (data.success) { setItems(data.data.items); setTotal(data.data.total); setTotalPages(data.data.totalPages); }
    else toast.error("Failed to load staff");
  }, []);

  useEffect(() => { if (!didLoad.current) { didLoad.current = true; void load(page, search, roleFilter, statusFilter); } }, [page, search, roleFilter, statusFilter, load]);

  const runLifecycle = async (member: StaffMember, action: string, reason?: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/staff/members/${member.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reason ? { reason } : {}),
      });
      const r = await res.json();
      if (r.success) {
        const labels: Record<string, string> = {
          archive: "Member archived",
          restore: "Member restored",
          deactivate: "Member deactivated",
          reactivate: "Member reactivated",
        };
        toast.success(labels[action] || "Updated");
        setDialog(null);
        void load(page, search, roleFilter, statusFilter);
      } else {
        toast.error(r.error?.message || "Failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader title="Staff" />
      <EntityActionBar entityLabel="Staff Member" createHref={canCreate ? "/dashboard/staff/create" : undefined} onRefresh={() => void load(page, search, roleFilter, statusFilter)} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); void load(1, e.target.value, roleFilter, statusFilter); }}
            placeholder="Search by name, email, or phone..."
            className="w-full pl-4 pr-4 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-cli-blue/30"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); void load(1, search, e.target.value, statusFilter); }}
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
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); void load(1, search, roleFilter, e.target.value); }}
          className="px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cli-blue/30"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                      {m.status === "REMOVED" ? "ARCHIVED" : m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <EAButton variant="ghost" size="sm" onClick={() => router.push(`/dashboard/staff/${m.id}/edit`)} title="View">
                        <Eye className="h-4 w-4" /> View
                      </EAButton>
                      {m.status === "ACTIVE" && (
                        <>
                          {canUpdate && (
                            <EAButton variant="secondary" size="sm" onClick={() => router.push(`/dashboard/staff/${m.id}/edit`)} title="Edit">
                              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                            </EAButton>
                          )}
                          {canDeactivate && (
                            <EAButton variant="secondary" size="sm" className="text-cli-amber" onClick={() => setDialog({ type: "deactivate", member: m })} title="Deactivate">
                              <ShieldOff className="h-3.5 w-3.5 mr-1" /> Deactivate
                            </EAButton>
                          )}
                          {canArchive && (
                            <EAButton variant="secondary" size="sm" className="text-cli-rose" onClick={() => setDialog({ type: "archive", member: m })} title="Archive">
                              <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                            </EAButton>
                          )}
                        </>
                      )}
                      {m.status === "SUSPENDED" && (
                        <>
                          {canReactivate && (
                            <EAButton variant="secondary" size="sm" className="text-cli-emerald" onClick={() => setDialog({ type: "reactivate", member: m })} title="Reactivate">
                              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Reactivate
                            </EAButton>
                          )}
                          {canArchive && (
                            <EAButton variant="secondary" size="sm" className="text-cli-rose" onClick={() => setDialog({ type: "archive", member: m })} title="Archive">
                              <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                            </EAButton>
                          )}
                        </>
                      )}
                      {m.status === "REMOVED" && canRestore && (
                        <EAButton variant="secondary" size="sm" className="text-cli-emerald" onClick={() => setDialog({ type: "restore", member: m })} title="Restore">
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                        </EAButton>
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

      <LifecycleDialog
        open={dialog?.type === "archive"}
        title="Archive Member"
        message={`Archive ${dialog?.member.fullName ?? ""}? They will lose access and be removed from the active staff directory. Historical records are retained.`}
        confirmLabel="Archive"
        destructive
        requiresReason
        onConfirm={(reason) => dialog && runLifecycle(dialog.member, "archive", reason)}
        onCancel={() => setDialog(null)}
      />
      <LifecycleDialog
        open={dialog?.type === "restore"}
        title="Restore Member"
        message={`Restore ${dialog?.member.fullName ?? ""} to Active? They will regain access and reappear in the active staff directory.`}
        confirmLabel="Restore"
        onConfirm={() => dialog && runLifecycle(dialog.member, "restore")}
        onCancel={() => setDialog(null)}
      />
      <LifecycleDialog
        open={dialog?.type === "deactivate"}
        title="Deactivate Member"
        message={`Deactivate ${dialog?.member.fullName ?? ""}? They will lose access until reactivated.`}
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => dialog && runLifecycle(dialog.member, "deactivate")}
        onCancel={() => setDialog(null)}
      />
      <LifecycleDialog
        open={dialog?.type === "reactivate"}
        title="Reactivate Member"
        message={`Reactivate ${dialog?.member.fullName ?? ""}? They will regain access.`}
        confirmLabel="Reactivate"
        onConfirm={() => dialog && runLifecycle(dialog.member, "reactivate")}
        onCancel={() => setDialog(null)}
      />

      {busy && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm"><p className="font-mono text-sm text-foreground bg-card border border-border rounded-xl px-4 py-2">Processing...</p></div>}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => { setPage(p); void load(p, search, roleFilter, statusFilter); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${p === page ? "bg-muted/60 text-foreground" : "text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/50"}`}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
