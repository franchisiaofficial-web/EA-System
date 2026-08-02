import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { withRls } from "@/lib/prisma/rls-middleware";
import { SchoolAdminDashboard } from "./SchoolAdminDashboard";

export default async function SchoolAdminDashboardPage() {
  const authCtx = await getAuthContext();
  if (!authCtx) redirect("/login");

  const schoolId = authCtx.schoolId;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rc = toRequestContext(authCtx);

  const dashboard = await withRls(rc, async (tx) => {
    const [students, staff, classes, todayAtt, recentStudents, recentAudit, fees, trend] = await Promise.all([
      tx.student.count({ where: { schoolId, isDeleted: false } }),
      tx.membership.count({ where: { schoolId, status: "ACTIVE", role: { in: ["TEACHER", "CLASS_TEACHER"] } } }),
      tx.class.count({ where: { schoolId, status: "ACTIVE" } }),
      tx.attendanceRecord.groupBy({ by: ["status"], where: { schoolId, date: today, isDeleted: false }, _count: true }),
      tx.student.findMany({ where: { schoolId, isDeleted: false }, orderBy: { createdAt: "desc" }, take: 5, select: { firstName: true, lastName: true, admissionNumber: true, createdAt: true } }),
      tx.auditLog.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 8, select: { action: true, entity: true, createdAt: true } }),
      tx.feeInvoice.aggregate({ where: { schoolId }, _sum: { totalAmount: true, paidAmount: true } }),
      tx.attendanceRecord.groupBy({ by: ["date"], where: { schoolId, isDeleted: false, date: { gte: new Date(Date.now() - 7 * 86400000) } }, _count: { status: true } }),
    ]);

    const attCounts: Record<string, number> = {}; for (const a of todayAtt) attCounts[a.status] = a._count;
    const attTotal = Object.values(attCounts).reduce((a, b) => a + b, 0);

    const trendMap: Record<string, number> = {};
    for (const t of trend) { const d = t.date.toISOString().slice(0, 10); trendMap[d] = (trendMap[d] || 0) + t._count.status; }

    return {
      schoolName: "School", userName: authCtx.email?.split("@")[0] || "Admin",
      summary: { students, staff, classes, attendance: attTotal > 0 ? Math.round(((attCounts.PRESENT || 0) / attTotal) * 100) : 0 },
      todayAttendance: { present: attCounts.PRESENT || 0, absent: attCounts.ABSENT || 0, late: attCounts.LATE || 0, excused: attCounts.EXCUSED || 0 },
      attendanceTrend: Object.entries(trendMap).sort().map(([d, c]) => ({ date: d.slice(5), count: c })),
      recentAdmissions: recentStudents.map((s: any) => ({ ...s, createdAt: s.createdAt.toISOString() })),
      recentActivity: recentAudit.map((a: any) => ({ ...a, createdAt: a.createdAt.toISOString() })),
      fees: { collected: fees._sum.paidAmount || 0, pending: (fees._sum.totalAmount || 0) - (fees._sum.paidAmount || 0) },
    };
  });

  return <SchoolAdminDashboard data={dashboard} />;
}
