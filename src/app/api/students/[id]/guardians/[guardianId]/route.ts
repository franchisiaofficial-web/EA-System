import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { requirePermission, AuthorizationError } from "@/lib/permissions/guards";
import { withRls } from "@/lib/prisma/rls-middleware";
import { auditLog } from "@/lib/audit/logger";

function safeAudit(input: Parameters<typeof auditLog>[0]) {
  auditLog(input).catch((e) =>
    console.error("Audit log write failed (non-blocking):", e)
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; guardianId: string }> }
) {
  try {
    const { id: studentId, guardianId } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx)
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 401 }
      );
    await requirePermission(authCtx, "students", "update");

    const rc = toRequestContext(authCtx);
    const schoolId = authCtx.schoolId;

    const result = await withRls(rc, async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId, schoolId },
        select: { id: true, isDeleted: true, status: true },
      });
      if (!student) throw new AuthorizationError("Student not found");
      if (student.isDeleted || student.status === "ARCHIVED")
        throw new AuthorizationError("Cannot modify guardians of an archived student");

      const link = await tx.studentGuardian.findUnique({
        where: {
          studentId_guardianId: { studentId, guardianId },
        },
      });
      if (!link) throw new AuthorizationError("Guardian not linked to this student");

      await tx.studentGuardian.updateMany({
        where: { studentId, isPrimary: true },
        data: { isPrimary: false },
      });

      await tx.studentGuardian.update({
        where: { id: link.id },
        data: { isPrimary: true },
      });

      return { guardianId, isPrimary: true, previousPrimaryDemoted: true };
    });

    safeAudit({
      userId: authCtx.userId,
      schoolId,
      action: "update",
      entity: "guardian_primary",
      recordId: `${studentId}:${guardianId}`,
      after: { isPrimary: true },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof AuthorizationError)
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: e.message } },
        { status: 403 }
      );
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: (e as Error).message } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; guardianId: string }> }
) {
  try {
    const { id: studentId, guardianId } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx)
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 401 }
      );
    await requirePermission(authCtx, "students", "update");

    const rc = toRequestContext(authCtx);
    const schoolId = authCtx.schoolId;

    const result = await withRls(rc, async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId, schoolId },
        select: { id: true, isDeleted: true, status: true },
      });
      if (!student) throw new AuthorizationError("Student not found");
      if (student.isDeleted || student.status === "ARCHIVED")
        throw new AuthorizationError("Cannot modify guardians of an archived student");

      const link = await tx.studentGuardian.findUnique({
        where: {
          studentId_guardianId: { studentId, guardianId },
        },
      });
      if (!link) throw new AuthorizationError("Guardian not linked to this student");

      const wasPrimary = link.isPrimary;

      await tx.studentGuardian.delete({ where: { id: link.id } });

      return { guardianId, unlinked: true, wasPrimary };
    });

    safeAudit({
      userId: authCtx.userId,
      schoolId,
      action: "unlink",
      entity: "guardian",
      recordId: `${studentId}:${guardianId}`,
      after: { unlinked: true, wasPrimary: result.wasPrimary },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof AuthorizationError)
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: e.message } },
        { status: 403 }
      );
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: (e as Error).message } },
      { status: 500 }
    );
  }
}
