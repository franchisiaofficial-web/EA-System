import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { requirePermission, AuthorizationError } from "@/lib/permissions/guards";
import { withRls } from "@/lib/prisma/rls-middleware";
import { logError } from "@/services/error-log.service";

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "attendance", "update");
    const { id } = await params;
    const rc = toRequestContext(authCtx);

    const session = await withRls(rc, async (tx) => {
      // Phase 1.5 tenant isolation: the session id is a client-supplied
      // identifier — it must belong to the authenticated school before update.
      const existing = await tx.attendanceSession.findFirst({
        where: { id, schoolId: authCtx.schoolId },
      });
      if (!existing) throw new Error('Attendance session not found');
      return tx.attendanceSession.update({
        where: { id },
        data: { status: "CLOSED", closedAt: new Date(), updatedBy: authCtx.userId },
      });
    });

    return NextResponse.json({ success: true, data: session });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    await logError({ service: "API", module: "AttendanceSession", severity: "ERROR", category: "API", message: (e as Error).message || "Unknown" });
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
