import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { authPrisma } from "@/lib/prisma/auth-client";
import { logError } from "@/services/error-log.service";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]).optional(),
  name: z.string().optional(), city: z.string().optional(), state: z.string().optional(), address: z.string().optional(), phone: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    if (authCtx.role !== "SUPER_ADMIN") return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.parse(body);

    const existing = await authPrisma.school.findUnique({ where: { id }, select: { status: true, name: true } });
    if (!existing) return NextResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });

    const updated = await authPrisma.school.update({ where: { id }, data: parsed });

    await authPrisma.auditLog.create({ data: { userId: authCtx.userId, schoolId: id, action: "update", entity: "School", recordId: id, before: { status: existing.status, name: existing.name }, after: { status: updated.status, name: updated.name } } });

    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: "VALIDATION" } }, { status: 400 });
    await logError({ service: "API", module: "Schools", severity: "ERROR", category: "API", message: (e as Error).message || "Unknown" });
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
