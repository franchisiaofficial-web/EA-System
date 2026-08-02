import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { authPrisma } from "@/lib/prisma/auth-client";

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    if (authCtx.role !== "SUPER_ADMIN") return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "50")));
    const search = sp.get("search") || "";
    const action = sp.get("action") || "";
    const userId = sp.get("userId") || "";

    const where: any = {};
    if (action) where.action = { contains: action, mode: "insensitive" };
    if (userId) where.userId = userId;
    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entity: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      authPrisma.auditLog.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize,
        orderBy: { createdAt: "desc" },
        select: { id: true, action: true, entity: true, recordId: true, userId: true, schoolId: true, before: true, after: true, createdAt: true, ipAddress: true, userAgent: true },
      }),
      authPrisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (e) {
    console.error("GET /api/admin/audit-logs error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
