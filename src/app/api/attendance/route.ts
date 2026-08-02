import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { requirePermission, AuthorizationError } from "@/lib/permissions/guards";
import { markAttendance, bulkMarkAttendance, getClassAttendance, getStudentAttendance, AttendanceConflictError } from "@/services/attendance/attendance-service";
import { withRls } from "@/lib/prisma/rls-middleware";
import { logError } from "@/services/error-log.service";
import { z } from "zod";

const markSchema = z.object({
  studentMembershipId: z.string().min(1),
  classId: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]),
  notes: z.string().optional(),
});

const bulkSchema = z.object({
  classId: z.string().min(1),
  date: z.string().min(1),
  records: z.array(z.object({
    studentMembershipId: z.string().min(1),
    status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]),
    notes: z.string().optional(),
  })),
});

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "attendance", "create");

    const body = await req.json();
    const isBulk = req.nextUrl.searchParams.get("bulk") === "true";
    const rc = toRequestContext(authCtx);

    if (isBulk) {
      const parsed = bulkSchema.parse(body);
      const result = await bulkMarkAttendance({
        schoolId: authCtx.schoolId,
        classId: parsed.classId,
        date: new Date(parsed.date),
        records: parsed.records,
      }, authCtx, rc);
      return NextResponse.json({ success: true, data: result });
    }

    const parsed = markSchema.parse(body);
    await markAttendance({
      schoolId: authCtx.schoolId,
      classId: parsed.classId,
      studentMembershipId: parsed.studentMembershipId,
      date: new Date(parsed.date),
      status: parsed.status,
      notes: parsed.notes,
    }, authCtx, rc);
    return NextResponse.json({ success: true, data: { status: parsed.status } }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: "VALIDATION", message: e.message } }, { status: 400 });
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    if (e instanceof AttendanceConflictError) return NextResponse.json({ success: false, error: { code: "CONFLICT", message: e.message } }, { status: 409 });
    await logError({ service: "API", module: "Attendance", severity: "ERROR", category: "API", message: (e as Error).message || "Unknown", errorCode: "INTERNAL" });
    console.error("POST /api/attendance error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "attendance", "read");

    const sp = req.nextUrl.searchParams;
    const classId = sp.get("classId") || undefined;
    const date = sp.get("date");
    const from = sp.get("from");
    const to = sp.get("to");
    const studentMembershipId = sp.get("studentMembershipId");
    const rc = toRequestContext(authCtx);

    if (studentMembershipId) {
      const stats = await getStudentAttendance(studentMembershipId, rc);
      return NextResponse.json({ success: true, data: stats });
    }

    if (!classId) return NextResponse.json({ success: true, data: [] });

    if (sp.get("summary") === "true") {
      const from = sp.get("from");
      const to = sp.get("to");
      if (!from || !to) return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "from and to are required for summary" } }, { status: 400 });

      const summary = await withRls(rc, async (tx) => {
        // Category A (Enrollment) any-status fallback for the membership→section
        // mapping (ADR: enrollment-relation-naming, Approach 2). ACTIVE rows serve
        // the current year; PROMOTED/PASSED_OUT rows preserve classId/sectionId for
        // completed years. Date-range filters still bound the membership window.
        const enrollments = await tx.enrollment.findMany({
          where: {
            schoolId: authCtx.schoolId,
            classId,
            joinedAt: { lte: new Date(`${to}T23:59:59.999`) },
            OR: [{ leftAt: null }, { leftAt: { gte: new Date(`${from}T00:00:00.000`) } }],
          },
          select: {
            sectionId: true,
            student: { select: { user: { select: { memberships: { where: { schoolId: authCtx.schoolId, role: "STUDENT", status: "ACTIVE" }, select: { id: true }, take: 1 } } } } },
          },
        });
        const membershipToSection: Record<string, string> = {};
        for (const se of enrollments) {
          const mid = se.student.user?.memberships?.[0]?.id;
          if (mid) membershipToSection[mid] = se.sectionId;
        }
        const records = await tx.attendanceRecord.findMany({
          where: { classId, schoolId: authCtx.schoolId, date: { gte: new Date(from), lte: new Date(to) }, isDeleted: false },
          select: { studentMembershipId: true, status: true },
        });
        const buckets: Record<string, { present: number; late: number; absent: number; excused: number; total: number }> = {};
        for (const r of records) {
          const sectionId = membershipToSection[r.studentMembershipId];
          if (!sectionId) continue;
          const b = (buckets[sectionId] ??= { present: 0, late: 0, absent: 0, excused: 0, total: 0 });
          b.total++;
          if (r.status === "PRESENT") b.present++;
          else if (r.status === "LATE") b.late++;
          else if (r.status === "ABSENT") b.absent++;
          else if (r.status === "EXCUSED") b.excused++;
        }
        return buckets;
      });
      return NextResponse.json({ success: true, data: summary });
    }

    if (from && to) {
      const records = await withRls(rc, async (tx) => tx.attendanceRecord.findMany({
        where: { classId, schoolId: authCtx.schoolId, date: { gte: new Date(from), lte: new Date(to) }, isDeleted: false },
        select: { id: true, studentMembershipId: true, date: true, status: true },
        orderBy: { date: 'asc' },
      }));
      return NextResponse.json({ success: true, data: records });
    }

    if (!date) {
      return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "date is required" } }, { status: 400 });
    }

    const records = await getClassAttendance(classId, new Date(date), rc);
    const mapped = records.map((r: any) => ({
      id: r.id,
      status: r.status,
      notes: r.notes,
      markedAt: r.markedAt.toISOString(),
      studentName: r.studentMembership?.user?.name || "Unknown",
      studentMembershipId: r.studentMembershipId,
      className: r.class?.name || "—",
      sectionName: "",
    }));
    return NextResponse.json({ success: true, data: mapped });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    console.error("GET /api/attendance error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
