import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { requirePermission, AuthorizationError } from "@/lib/permissions/guards";
import { withRls } from "@/lib/prisma/rls-middleware";
import { logError } from "@/services/error-log.service";
import { z } from "zod";

const createSessionSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().optional(),
  subjectId: z.string().optional(),
  type: z.enum(["MORNING", "AFTERNOON", "EXAM", "SPECIAL"]).default("MORNING"),
});

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "attendance", "create");
    const body = await req.json();
    const parsed = createSessionSchema.parse(body);
    const rc = toRequestContext(authCtx);

    const session = await withRls(rc, async (tx) => {
      // Phase 1.5 tenant isolation: classId is client-supplied; it must belong
      // to the authenticated school (sections are class-scoped by the same check).
      const cls = await tx.class.findFirst({
        where: { id: parsed.classId, schoolId: authCtx.schoolId },
        select: { id: true },
      });
      if (!cls) throw new Error('Class not found');
      return tx.attendanceSession.create({
        data: {
          schoolId: authCtx.schoolId,
          classId: parsed.classId,
          sectionId: parsed.sectionId,
          subjectId: parsed.subjectId,
          teacherId: authCtx.membershipId,
          type: parsed.type,
          createdBy: authCtx.userId,
        },
      });
    });

    return NextResponse.json({ success: true, data: session }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: "VALIDATION", message: e.message } }, { status: 400 });
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    await logError({ service: "API", module: "AttendanceSession", severity: "ERROR", category: "API", message: (e as Error).message || "Unknown" });
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "attendance", "read");
    const rc = toRequestContext(authCtx);
    const sp = req.nextUrl.searchParams;
    const classId = sp.get("classId");
    const status = sp.get("status") || "ACTIVE";

    const sessions = await withRls(rc, async (tx) =>
      tx.attendanceSession.findMany({
        where: {
          schoolId: authCtx.schoolId,
          ...(classId ? { classId } : {}),
          status: status as any,
        },
        orderBy: { openedAt: "desc" },
        take: 20,
        include: { class: { select: { name: true } }, section: { select: { name: true } }, subject: { select: { name: true } } },
      })
    );

    return NextResponse.json({ success: true, data: sessions });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
