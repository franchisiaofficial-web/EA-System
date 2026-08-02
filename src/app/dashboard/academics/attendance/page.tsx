import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions/permissions";
import { withRls } from "@/lib/prisma/rls-middleware";
import { AttendanceClient } from "./AttendanceClient";

export default async function AttendancePage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");
  if (!hasPermission(authCtx.role, "attendance", "read")) redirect("/dashboard");

  const rc = toRequestContext(authCtx);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const { records, classes, counts } = await withRls(rc, async (tx) => {
    const [records, classes, summary] = await Promise.all([
      tx.attendanceRecord.findMany({
        where: { schoolId: authCtx.schoolId, date: today, isDeleted: false },
        include: { studentMembership: { include: { user: { select: { name: true } } } }, class: { select: { name: true } } },
        orderBy: { createdAt: "desc" }, take: 50,
      }),
      tx.class.findMany({ where: { schoolId: authCtx.schoolId, status: "ACTIVE" }, select: { id: true, name: true } }),
      tx.attendanceRecord.groupBy({ by: ["status"], where: { schoolId: authCtx.schoolId, date: today, isDeleted: false }, _count: true }),
    ]);

    const counts: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const s of summary) counts[s.status] = s._count;
    return { records, classes, counts };
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const mapped = records.map((r: any) => ({
    id: r.id, status: r.status, notes: r.notes, markedAt: r.markedAt.toISOString(),
    studentName: r.studentMembership?.user?.name || "Unknown",
    studentMembershipId: r.studentMembershipId,
    className: r.class?.name || "—", sectionName: "",
  }));

  return <AttendanceClient initialRecords={mapped} classes={classes} summary={{ ...counts, total, pct: total > 0 ? Math.round((counts.PRESENT / total) * 100) : 0 }} />;
}
