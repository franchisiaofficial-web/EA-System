import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { requirePermission, AuthorizationError } from "@/lib/permissions/guards";
import { withRls } from "@/lib/prisma/rls-middleware";
import { runSimpleMutation } from "@/lib/crud/mutation";
import type { AcademicYear, Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Not authenticated" } }, { status: 401 });
    await requirePermission(authCtx, "academic_years", "read");
    const requestCtx = toRequestContext(authCtx);

    const record = await withRls(requestCtx, async (tx) => {
      return tx.academicYear.findFirst({
        where: { id, schoolId: authCtx.schoolId },
        include: { _count: { select: { classes: true } } },
      });
    });

    if (!record) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Academic year not found" } }, { status: 404 });
    return NextResponse.json({ success: true, data: record });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    console.error("GET /api/academic-years/[id] error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.parse(body);

    const result = await runSimpleMutation<typeof parsed, AcademicYear>({
      resource: "academic_years", action: "update", input: parsed,
      execute: async (data, { authCtx: ac, requestCtx: rc }) => {
        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
        if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
        if (data.isActive !== undefined) {
          updateData.isActive = data.isActive;
          if (data.isActive) {
            await withRls(rc, async (tx) => {
              await tx.academicYear.updateMany({ where: { schoolId: ac.schoolId, isActive: true, id: { not: id } }, data: { isActive: false } });
            });
          }
        }
        return withRls(rc, async (tx) => {
          const existing = await tx.academicYear.findFirst({ where: { id, schoolId: ac.schoolId }, select: { id: true } });
          if (!existing) throw new AuthorizationError("Academic year not found in this school");
          return tx.academicYear.update({ where: { id }, data: updateData });
        });
      },
      getEntityId: () => id,
      buildAfter: (r) => ({ name: r.name, isActive: r.isActive }),
    });

    if (!result.success) return NextResponse.json(result, { status: result.error?.code === "FORBIDDEN" ? 403 : 400 });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: "VALIDATION", message: e.message } }, { status: 400 });
    console.error("PATCH /api/academic-years/[id] error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const result = await runSimpleMutation<string, AcademicYear>({
      resource: "academic_years", action: "archive", input: id,
      execute: async (entityId, { authCtx: ac, requestCtx: rc }) => {
        return withRls(rc, async (tx) => {
          const existing = await tx.academicYear.findFirst({ where: { id: entityId, schoolId: ac.schoolId }, include: { _count: { select: { classes: true } } } });
          if (!existing) throw new AuthorizationError("Academic year not found in this school");
          if (existing._count.classes > 0) throw new Error("Cannot delete academic year with active classes. Archive classes first.");
          return tx.academicYear.update({ where: { id: entityId }, data: { status: "COMPLETED", isActive: false } });
        });
      },
      getEntityId: () => id,
      buildAfter: () => ({ status: "COMPLETED", isActive: false }),
    });

    if (!result.success) return NextResponse.json(result, { status: result.error?.code === "FORBIDDEN" ? 403 : 400 });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes("Cannot delete")) return NextResponse.json({ success: false, error: { code: "CONFLICT", message: e.message } }, { status: 409 });
    console.error("DELETE /api/academic-years/[id] error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
