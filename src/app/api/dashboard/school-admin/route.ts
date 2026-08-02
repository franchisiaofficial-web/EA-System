import { NextResponse } from "next/server";
import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { withRls } from "@/lib/prisma/rls-middleware";

export async function GET() {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });

    const schoolId = authCtx.schoolId;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const rc = toRequestContext(authCtx);

    const dashboard = await withRls(rc, async (tx) => {
      const [students, staff, classes, todayAttendance, recentAdmissions, recentActivity, fees, attendanceTrend] = await Promise.all([
        tx.student.count({ where: { schoolId, isDeleted: false } }),
        tx.membership.count({ where: { schoolId, status: "ACTIVE", role: { in: ["TEACHER", "CLASS_TEACHER", "NON_TEACHING", "LIBRARIAN"] } } }),
        tx.class.count({ where: { schoolId, status: "ACTIVE" } }),
        tx.attendanceRecord.groupBy({ by: ["status"], where: { schoolId, date: today, isDeleted: false }, _count: true }),
        tx.student.findMany({ where: { schoolId, isDeleted: false }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, firstName: true, lastName: true, admissionNumber: true, createdAt: true, status: true } }),
        tx.auditLog.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, action: true, entity: true, createdAt: true } }),
        tx.feeInvoice.aggregate({ where: { schoolId }, _sum: { totalAmount: true, paidAmount: true } }),
        tx.attendanceRecord.groupBy({ by: ["date"], where: { schoolId, isDeleted: false, date: { gte: new Date(Date.now() - 7 * 86400000) } }, _count: { status: true } }),
      ]);

      const attCounts: Record<string, number> = {}; for (const a of todayAttendance) attCounts[a.status] = a._count;
      const attTotal = Object.values(attCounts).reduce((a, b) => a + b, 0);

      const trend = attendanceTrend.map((t: any) => ({ date: t.date.toISOString().slice(0, 10), count: t._count.status }));
      const trendMap: Record<string, number> = {}; for (const t of trend) trendMap[t.date] = (trendMap[t.date] || 0) + t.count;

      return {
        summary: { students, staff, classes, attendanceToday: attTotal > 0 ? Math.round(((attCounts.PRESENT || 0) / attTotal) * 100) : 0 },
        todayAttendance: { present: attCounts.PRESENT || 0, absent: attCounts.ABSENT || 0, late: attCounts.LATE || 0, excused: attCounts.EXCUSED || 0 },
        attendanceTrend: Object.entries(trendMap).sort(([a], [b]) => a.localeCompare(b)).map(([d, c]) => ({ date: d, count: c })),
        recentAdmissions: recentAdmissions.map((s: any) => ({ ...s, createdAt: s.createdAt.toISOString() })),
        recentActivity: recentActivity.map((a: any) => ({ ...a, createdAt: a.createdAt.toISOString() })),
        fees: { collected: fees._sum.paidAmount || 0, pending: (fees._sum.totalAmount || 0) - (fees._sum.paidAmount || 0), total: fees._sum.totalAmount || 0 },
        schoolHealth: { database: "healthy", subscription: "ACTIVE", storage: "8 GB / 25 GB", backup: "yesterday" },
      };
    });

    return NextResponse.json({ success: true, data: dashboard });
  } catch (e) {
    console.error("Dashboard API error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
