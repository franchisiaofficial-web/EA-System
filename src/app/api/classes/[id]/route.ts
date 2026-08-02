import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { requirePermission, AuthorizationError } from "@/lib/permissions/guards";
import { withRls } from "@/lib/prisma/rls-middleware";
import { runSimpleMutation } from "@/lib/crud/mutation";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  gradeLevel: z.string().optional(),
  sortOrder: z.number().int().optional(),
  academicYearId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Not authenticated" } }, { status: 401 });
    await requirePermission(authCtx, "classes", "read");
    const requestCtx = toRequestContext(authCtx);

    const record = await withRls(requestCtx, async (tx) => {
      return tx.class.findFirst({
        where: { id, schoolId: authCtx.schoolId, isDeleted: false },
        include: {
          academicYear: { select: { id: true, name: true } },
          sections: {
            where: { status: 'ACTIVE' },
            orderBy: { name: 'asc' },
            include: {
              enrollmentRecords: { where: { status: 'ACTIVE' }, select: { id: true } },
              studentEnrollments: { where: { status: 'ACTIVE', isDeleted: false }, select: { id: true } },
            },
          },
          assignments: {
            orderBy: { createdAt: 'desc' },
            include: { teacherMembership: { include: { user: { select: { name: true, email: true } } } } },
          },
          _count: { select: { sections: true, studentEnrollments: true, attendanceRecords: true } },
        },
      });
    });

    if (!record) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Class not found" } }, { status: 404 });

    return NextResponse.json({ success: true, data: record });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    console.error("GET /api/classes/[id] error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.parse(body);

    const result = await runSimpleMutation<typeof parsed, Prisma.ClassGetPayload<{}>>({
      resource: "classes", action: "update", input: parsed,
      execute: async (data, { authCtx: ac, requestCtx: rc }) => {
        return withRls(rc, async (tx) => {
          const existing = await tx.class.findFirst({ where: { id, schoolId: ac.schoolId }, select: { id: true } });
          if (!existing) throw new AuthorizationError("Class not found in this school");
          return tx.class.update({ where: { id }, data });
        });
      },
      getEntityId: () => id,
      buildAfter: (r) => ({ name: r.name, status: r.status }),
    });

    if (!result.success) return NextResponse.json(result, { status: result.error?.code === "FORBIDDEN" ? 403 : 400 });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: "VALIDATION", message: e.message } }, { status: 400 });
    console.error("PATCH /api/classes/[id] error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const result = await runSimpleMutation<string, Prisma.ClassGetPayload<{}>>({
      resource: "classes", action: "archive", input: id,
      execute: async (entityId, { authCtx: ac, requestCtx: rc }) => {
        return withRls(rc, async (tx) => {
          const existing = await tx.class.findFirst({ where: { id: entityId, schoolId: ac.schoolId }, include: { _count: { select: { sections: true, studentEnrollments: true } } } });
          if (!existing) throw new AuthorizationError("Class not found in this school");
          if (existing._count.sections > 0) throw new Error("Cannot delete class with active sections. Archive sections first.");
          if (existing._count.studentEnrollments > 0) throw new Error("Cannot delete class with active students.");
          return tx.class.update({ where: { id: entityId }, data: { status: "ARCHIVED", isDeleted: true, updatedBy: ac.userId } });
        });
      },
      getEntityId: () => id,
      buildAfter: () => ({ status: "ARCHIVED", isDeleted: true }),
    });

    if (!result.success) return NextResponse.json(result, { status: result.error?.code === "FORBIDDEN" ? 403 : 400 });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes("Cannot delete")) return NextResponse.json({ success: false, error: { code: "CONFLICT", message: e.message } }, { status: 409 });
    console.error("DELETE /api/classes/[id] error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
