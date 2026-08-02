import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { getErrorLogById, updateErrorLog } from "@/services/error-log.service";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "RETRYING", "RESOLVED", "IGNORED"]).optional(),
  severity: z.enum(["INFO", "WARNING", "ERROR", "CRITICAL"]).optional(),
  resolvedAt: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    if (authCtx.role !== "SUPER_ADMIN") return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });

    const { id } = await params;
    const item = await getErrorLogById(id);
    if (!item) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Error log not found" } }, { status: 404 });

    return NextResponse.json({ success: true, data: item });
  } catch (e) {
    console.error("GET /api/admin/error-logs/[id] error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    if (authCtx.role !== "SUPER_ADMIN") return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.parse(body);

    const item = await getErrorLogById(id);
    if (!item) return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Error log not found" } }, { status: 404 });

    const updated = await updateErrorLog(id, parsed, authCtx.userId, authCtx.schoolId);
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: "VALIDATION", message: e.message } }, { status: 400 });
    console.error("PATCH /api/admin/error-logs/[id] error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
