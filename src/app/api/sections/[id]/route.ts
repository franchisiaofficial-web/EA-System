import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { requirePermission, AuthorizationError } from "@/lib/permissions/guards";
import { withRls } from "@/lib/prisma/rls-middleware";
import { z } from "zod";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Not authenticated" } }, { status: 401 });
    await requirePermission(authCtx, "sections", "read");
    const requestCtx = toRequestContext(authCtx);

    const record = await withRls(requestCtx, async (tx) => {
      return tx.section.findFirst({
        where: { id, schoolId: authCtx.schoolId },
        include: {
          class: {
            select: {
              id: true, name: true, displayName: true, status: true,
              academicYear: { select: { id: true, name: true } },
              assignments: {
                where: { status: 'ACTIVE' },
                include: { teacherMembership: { include: { user: { select: { name: true, email: true } } } } },
              },
            },
          },
          studentEnrollments: {
            where: { status: 'ACTIVE', isDeleted: false },
            include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, status: true } } },
            orderBy: { rollNumber: 'asc' },
          },
          _count: { select: { studentEnrollments: true } },
        },
      });
    });

    if (!record) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Section not found" } }, { status: 404 });
    return NextResponse.json({ success: true, data: record });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    console.error("GET /api/sections/[id] error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
