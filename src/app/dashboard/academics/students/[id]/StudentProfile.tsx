"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, ArrowLeft, Search, Plus, Star, Link, UserPlus, AlertTriangle, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_CHIP: Record<string, string> = {
  ACTIVE: "text-cli-emerald bg-cli-emerald/10",
  PROMOTED: "text-cli-blue bg-cli-blue/10",
  PASSED_OUT: "text-cli-amber bg-cli-amber/10",
  TRANSFERRED: "text-cli-cyan bg-cli-cyan/10",
  GRADUATED: "text-cli-purple bg-cli-purple/10",
  WITHDRAWN: "text-muted-foreground bg-muted/40",
};

interface GuardianLink {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string;
  phone: string | null;
  isPrimary: boolean;
}

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  bloodGroup: string | null;
  admissionDate: string | null;
  status: string;
  siblings: {
    name: string;
    admissionNo?: string;
    age?: number;
    gender?: string;
    className?: string;
    relationship?: string;
    schoolName?: string;
    notes?: string;
    reason?: string;
  }[];
  enrollments: {
    id: string;
    rollNumber: string | null;
    status: string;
    enrolledAt: string;
    academicYear: string;
    className: string;
    sectionName: string;
    classTeacher: string | null;
  }[];
  passedOut: {
    id: string;
    batch: string;
    passedOutDate: string;
    graduationReason: string | null;
    finalAcademicYear: string;
    finalClassName: string | null;
    finalSectionName: string | null;
    finalRollNumber: string | null;
  }[];
  guardians: GuardianLink[];
}

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  isLinked: boolean;
  isPrimary: boolean;
  linkId: string | null;
}

interface PendingDuplicate {
  guardianId: string;
  firstName: string;
  lastName: string;
  relationship: string;
  isPrimary: boolean;
}

export function StudentProfile({
  data: initialData,
  canEdit,
  canArchive,
}: {
  data: ProfileData;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [showAddGuardian, setShowAddGuardian] = useState(false);
  const [guardianSearch, setGuardianSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  // Relationship for linking from search results (Fix 1)
  const [linkRelationship, setLinkRelationship] = useState("Father");

  const [newGuardian, setNewGuardian] = useState({
    firstName: "",
    lastName: "",
    relationship: "Father",
    phone: "",
    email: "",
  });

  const [replacePrimary, setReplacePrimary] = useState<string | null>(null);
  const [unlinkGuardian, setUnlinkGuardian] = useState<{ id: string; name: string } | null>(null);

  // Pending duplicate state (Fix 4A)
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null);

  const handleArchive = async () => {
    const res = await fetch(`/api/students/${data.id}`, { method: "DELETE" });
    const r = await res.json();
    if (r.success) {
      toast.success("Student archived");
      router.push("/dashboard/academics/students");
    } else toast.error(r.error?.message || "Failed");
  };

  const searchGuardians = useCallback(
    async (q: string) => {
      if (q.length < 2) { setSearchResults([]); return; }
      setSearching(true);
      try {
        const res = await fetch(`/api/students/${data.id}/guardians?search=${encodeURIComponent(q)}`);
        const r = await res.json();
        if (r.success) setSearchResults(r.data);
      } catch { toast.error("Search failed"); }
      finally { setSearching(false); }
    },
    [data.id]
  );

  // Fix 1: link with user-selected relationship, not hardcoded "Guardian"
  const linkGuardian = async (guardianId: string, relationship: string, isPrimary = false) => {
    try {
      const res = await fetch(`/api/students/${data.id}/guardians`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "link", guardianId, relationship, isPrimary }),
      });
      const r = await res.json();
      if (r.success && r.data.linked) {
        toast.success("Guardian linked");
        refreshGuardians();
        resetAddPanel();
      } else {
        toast.error(r.data?.message || r.error?.message || "Link failed");
      }
    } catch { toast.error("Network error"); }
  };

  const createAndLinkGuardian = async (isPrimary: boolean) => {
    if (!newGuardian.firstName || !newGuardian.lastName) {
      toast.error("First and last name are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/students/${data.id}/guardians`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...newGuardian, isPrimary }),
      });
      const r = await res.json();

      if (r.success && r.data.linked) {
        toast.success(`${newGuardian.firstName} ${newGuardian.lastName} added`);
        refreshGuardians();
        resetAddPanel();
      } else if (r.success && r.data.existingGuardian) {
        // Fix 4/4A: pending duplicate state — no auto-link
        const ex = r.data.existingGuardian;
        setPendingDuplicate({
          guardianId: ex.id,
          firstName: ex.firstName,
          lastName: ex.lastName,
          relationship: newGuardian.relationship,
          isPrimary,
        });
      } else {
        toast.error(r.data?.message || r.error?.message || "Create failed");
      }
    } catch { toast.error("Network error"); }
    finally { setCreating(false); }
  };

  // Fix 4A: user explicitly chooses to link existing guardian
  const confirmDuplicateLink = () => {
    if (!pendingDuplicate) return;
    linkGuardian(pendingDuplicate.guardianId, pendingDuplicate.relationship, pendingDuplicate.isPrimary);
    setPendingDuplicate(null);
  };

  const cancelDuplicate = () => {
    setPendingDuplicate(null);
  };

  const resetAddPanel = () => {
    setShowAddGuardian(false);
    setGuardianSearch("");
    setSearchResults([]);
    setLinkRelationship("Father");
    setNewGuardian({ firstName: "", lastName: "", relationship: "Father", phone: "", email: "" });
    setPendingDuplicate(null);
  };

  const handleReplacePrimary = async () => {
    if (!replacePrimary) return;
    try {
      const res = await fetch(`/api/students/${data.id}/guardians/${replacePrimary}`, { method: "PATCH" });
      const r = await res.json();
      if (r.success) {
        toast.success("Primary guardian updated");
        refreshGuardians();
        setReplacePrimary(null);
      } else toast.error(r.error?.message || "Update failed");
    } catch { toast.error("Network error"); }
  };

  const promotePrimary = async (guardianId: string) => {
    try {
      const res = await fetch(`/api/students/${data.id}/guardians/${guardianId}`, { method: "PATCH" });
      const r = await res.json();
      if (r.success) {
        toast.success("Primary guardian updated");
        refreshGuardians();
      } else toast.error(r.error?.message || "Update failed");
    } catch { toast.error("Network error"); }
  };

  const handleUnlink = async () => {
    if (!unlinkGuardian) return;
    try {
      const res = await fetch(`/api/students/${data.id}/guardians/${unlinkGuardian.id}`, { method: "DELETE" });
      const r = await res.json();
      if (r.success) {
        toast.success(`${unlinkGuardian.name} removed`);
        refreshGuardians();
        setUnlinkGuardian(null);
      } else toast.error(r.error?.message || "Remove failed");
    } catch { toast.error("Network error"); }
  };

  const refreshGuardians = async () => {
    try {
      const res = await fetch(`/api/students/${data.id}`);
      const r = await res.json();
      if (r.success && r.data.guardians) {
        const mapped = r.data.guardians.map(
          (g: { guardian: GuardianLink; isPrimary: boolean }) => ({
            id: g.guardian.id,
            firstName: g.guardian.firstName,
            lastName: g.guardian.lastName,
            relationship: g.guardian.relationship,
            phone: g.guardian.phone,
            isPrimary: g.isPrimary,
          })
        );
        setData((prev) => ({ ...prev, guardians: mapped }));
      }
    } catch { /* silent */ }
  };

  const hasPrimary = data.guardians.some((g) => g.isPrimary);

  const inputClass = cn(
    "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground font-sans",
    "placeholder:text-muted-foreground",
    "focus:outline-none focus:ring-2 focus:ring-cli-emerald/50 focus:border-cli-emerald/30"
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {data.firstName} {data.lastName}
            </h1>
            <p className="text-sm font-mono text-muted-foreground">
              {data.admissionNumber} &bull; {data.status}
              {data.status === "PASSED_OUT" && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-mono text-cli-amber bg-cli-amber/10 px-2 py-0.5 rounded-md">
                  <GraduationCap className="h-3 w-3" />Passed Out
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/academics/students/${data.id}/edit`)}>
              <Pencil className="h-4 w-4 mr-1" />Edit
            </Button>
          )}
          {canArchive && (
            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="h-4 w-4 mr-1 text-foreground" />Archive
            </Button>
          )}
        </div>
      </div>

      {/* Personal info + Enrollments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-mono text-muted-foreground uppercase mb-4">Personal Information</h2>
          <dl className="space-y-3">
            {[["Name", `${data.firstName} ${data.lastName}`], ["Admission #", data.admissionNumber], ["Admission Date", data.admissionDate || "—"], ["Date of Birth", data.dateOfBirth || "—"], ["Gender", data.gender || "—"], ["Blood Group", data.bloodGroup || "—"], ["Phone", data.phone || "—"]].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3"><dt className="text-sm text-muted-foreground shrink-0">{label}</dt><dd className="text-sm font-medium text-foreground text-right">{value}</dd></div>
            ))}
            {data.address ? (
              <div className="pt-2 border-t border-border">
                <dt className="text-sm text-muted-foreground mb-1">Address</dt>
                <dd className="text-sm font-medium text-foreground whitespace-pre-line break-words">{data.address}</dd>
              </div>
            ) : (
              <div className="flex justify-between"><dt className="text-sm text-muted-foreground">Address</dt><dd className="text-sm font-medium text-foreground">—</dd></div>
            )}
          </dl>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-mono text-muted-foreground uppercase">Academic Information</h2>
            {data.status === "PASSED_OUT" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cli-amber bg-cli-amber/10 px-2 py-0.5 rounded-md"><GraduationCap className="h-3 w-3" />Passed Out</span>
            )}
          </div>
          {data.enrollments.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">No Academic Assignment</p>
              <p className="text-xs text-muted-foreground">This student is not assigned to any grade or section.</p>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/academics/students/${data.id}/edit`)}>
                  Assign Enrollment
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const active = data.enrollments.find(e => e.status === "ACTIVE");
                return active ? (
                  <div className="space-y-2.5 rounded-lg border border-cli-emerald/20 bg-cli-emerald/5 p-4">
                    <dl className="space-y-2">
                      {[["Academic Year", active.academicYear], ["Class", active.className], ["Section", active.sectionName || "—"], ["Roll Number", active.rollNumber || "—"], ["Class Teacher", active.classTeacher || "—"], ["Enrollment Status", active.status]].map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-3"><dt className="text-xs text-muted-foreground shrink-0">{label}</dt><dd className="text-sm font-medium text-foreground text-right">{value}</dd></div>
                      ))}
                    </dl>
                  </div>
                ) : null;
              })()}
              <div>
                <h3 className="text-[11px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-2">Promotion History</h3>
                <div className="space-y-2">
                  {data.enrollments.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{e.academicYear} — {e.className} ({e.sectionName})</p>
                        <p className="text-xs text-muted-foreground font-mono">Roll: {e.rollNumber ?? "—"} &bull; Joined {new Date(e.enrolledAt).toLocaleDateString()}</p>
                      </div>
                      <span className={cn("inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono", STATUS_CHIP[e.status] ?? "bg-muted/40 text-muted-foreground")}>{e.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Passed Out Record */}
      {data.passedOut.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-mono text-muted-foreground uppercase mb-4">Passed Out Record</h2>
          <div className="space-y-3">
            {data.passedOut.map((p) => (
              <div key={p.id} className="border-b border-border pb-2 last:border-0 space-y-1.5">
                <p className="text-sm font-medium text-foreground">Batch {p.batch} — {new Date(p.passedOutDate).toLocaleDateString()}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  Final: {p.finalAcademicYear} &bull; {p.finalClassName ?? "—"} {p.finalSectionName ? `(${p.finalSectionName})` : ""} &bull; Roll {p.finalRollNumber ?? "—"}
                </p>
                {p.graduationReason && <p className="text-xs text-muted-foreground">{p.graduationReason}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guardians */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-mono text-muted-foreground uppercase">Guardians</h2>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => showAddGuardian ? resetAddPanel() : setShowAddGuardian(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              {showAddGuardian ? "Cancel" : "Add Guardian"}
            </Button>
          )}
        </div>

        {/* Linked guardians list */}
        {data.guardians.length === 0 ? (
          <p className="text-sm text-muted-foreground">No guardians linked.</p>
        ) : (
          <div className="space-y-3 mb-4">
            {data.guardians.map((g) => (
              <div key={g.id} className="flex justify-between items-center border-b border-border pb-2 last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {g.firstName} {g.lastName}
                    {g.isPrimary && (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-xs font-mono text-cli-amber">
                        <Star className="h-3 w-3" />Primary
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{g.relationship}{g.phone ? ` • ${g.phone}` : ""}</p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    {!g.isPrimary && (
                      <Button variant="ghost" size="xs" onClick={() => { if (hasPrimary) setReplacePrimary(g.id); else promotePrimary(g.id); }} title="Make Primary">
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="xs" onClick={() => setUnlinkGuardian({ id: g.id, name: `${g.firstName} ${g.lastName}` })} title="Remove">
                      <Trash2 className="h-3.5 w-3.5 text-foreground" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add guardian panel */}
        {showAddGuardian && canEdit && (
          <div className="border-t border-border pt-4 space-y-4">
            {/* Search existing guardians */}
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Search Existing Guardians</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" placeholder="Search by name or phone..." value={guardianSearch}
                  onChange={(e) => { setGuardianSearch(e.target.value); searchGuardians(e.target.value); }}
                  className={cn(inputClass, "pl-10")} />
              </div>
              {searching && <p className="text-xs text-muted-foreground mt-1">Searching...</p>}
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {searchResults.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/30">
                      <div>
                        <p className="text-sm font-medium">{r.firstName} {r.lastName}</p>
                        <p className="text-xs text-muted-foreground">{r.relationship}{r.phone ? ` • ${r.phone}` : ""}</p>
                      </div>
                      {r.isLinked ? (
                        <span className="text-xs font-mono text-muted-foreground">Linked</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          {/* Fix 1: Relationship selector for linking */}
                          <select value={linkRelationship}
                            onChange={(e) => setLinkRelationship(e.target.value)}
                            className="h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground font-sans focus:outline-none focus:ring-1 focus:ring-cli-emerald/50">
                            <option value="Father">Father</option>
                            <option value="Mother">Mother</option>
                            <option value="Guardian">Guardian</option>
                          </select>
                          <Button variant="outline" size="xs"
                            onClick={() => linkGuardian(r.id, linkRelationship)}>
                            <Link className="h-3 w-3 mr-1" />Link
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {guardianSearch.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">No guardians found. Create one below.</p>
              )}
            </div>

            {/* Create new guardian */}
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Or Create New Guardian</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="text" placeholder="First Name *" value={newGuardian.firstName}
                  onChange={(e) => setNewGuardian((p) => ({ ...p, firstName: e.target.value }))}
                  className={inputClass} />
                <input type="text" placeholder="Last Name *" value={newGuardian.lastName}
                  onChange={(e) => setNewGuardian((p) => ({ ...p, lastName: e.target.value }))}
                  className={inputClass} />
                <select value={newGuardian.relationship}
                  onChange={(e) => setNewGuardian((p) => ({ ...p, relationship: e.target.value }))}
                  className={inputClass}>
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Guardian</option>
                </select>
                <input type="text" placeholder="Phone" value={newGuardian.phone}
                  onChange={(e) => setNewGuardian((p) => ({ ...p, phone: e.target.value }))}
                  className={inputClass} />
                <input type="email" placeholder="Email" value={newGuardian.email}
                  onChange={(e) => setNewGuardian((p) => ({ ...p, email: e.target.value }))}
                  className={cn(inputClass, "sm:col-span-2")} />
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => createAndLinkGuardian(false)} disabled={creating}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium">
                  <UserPlus className="h-3.5 w-3.5 mr-1" />
                  {creating ? "Adding..." : "Add Guardian"}
                </Button>
                {(!hasPrimary || data.guardians.length === 0) && (
                  <Button size="sm" variant="outline" onClick={() => createAndLinkGuardian(true)} disabled={creating}>
                    <Star className="h-3.5 w-3.5 mr-1" />Add as Primary
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Siblings */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-mono text-muted-foreground uppercase mb-4">Siblings</h2>
        {data.siblings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No siblings recorded.</p>
        ) : (
          <div className="space-y-3">
            {data.siblings.map((s, i) => (
              <div key={i} className="flex justify-between items-center border-b border-border pb-2 last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}{s.relationship ? ` · ${s.relationship}` : ""}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {[s.admissionNo ? `Adm ${s.admissionNo}` : null, s.schoolName, s.age != null ? `Age ${s.age}` : null, s.gender, s.reason].filter(Boolean).join(" · ") || "—"}
                  </p>
                  {s.notes && <p className="text-xs text-muted-foreground mt-0.5">{s.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fix 4A: Pending Duplicate Guardian dialog */}
      {pendingDuplicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cli-amber/10">
                <AlertTriangle className="h-5 w-5 text-cli-amber" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Existing Guardian Found</h3>
                <p className="text-xs text-muted-foreground mt-0.5">A guardian with this phone already exists</p>
              </div>
            </div>
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{pendingDuplicate.firstName} {pendingDuplicate.lastName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Relationship</span><span className="font-medium">{pendingDuplicate.relationship}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-medium">{newGuardian.phone || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Primary</span><span className="font-medium">{pendingDuplicate.isPrimary ? "Yes" : "No"}</span></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={cancelDuplicate}>Cancel</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium" onClick={confirmDuplicateLink}>
                <Link className="h-3.5 w-3.5 mr-1" />Link Existing
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Fix 5: Replace Primary Guardian Dialog */}
      {replacePrimary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cli-amber/10">
                <AlertTriangle className="h-5 w-5 text-cli-amber" />
              </div>
              <h3 className="font-semibold text-foreground">Replace Primary Guardian?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">This student already has a Primary Guardian. The current Primary Guardian will become a secondary guardian. Do you want to continue?</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setReplacePrimary(null)}>Cancel</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium" onClick={handleReplacePrimary}>Replace Primary</Button>
            </div>
          </div>
        </div>
      )}

      {/* Unlink Guardian Dialog */}
      {unlinkGuardian && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60">
                <Trash2 className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="font-semibold text-foreground">Remove Guardian?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">This removes the relationship only. {unlinkGuardian.name}&apos;s record will remain in the system.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setUnlinkGuardian(null)}>Cancel</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium" onClick={handleUnlink}>Remove Guardian</Button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Student Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cli-amber/10">
                <AlertTriangle className="h-5 w-5 text-cli-amber" />
              </div>
              <h3 className="font-semibold text-foreground">Archive Student</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Archive this student? Their record will be preserved but hidden from default lists.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium" onClick={handleArchive}>Archive</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
