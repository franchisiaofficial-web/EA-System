import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { getErrorLogs, getRecentErrors } from "@/services/error-log.service";

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    if (authCtx.role !== "SUPER_ADMIN") return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });

    const sp = req.nextUrl.searchParams;

    // CSV export
    if (sp.get("format") === "csv") {
      const scope = sp.get("scope") || "page";
      const pageSize = scope === "all" ? 10000 : parseInt(sp.get("pageSize") || "50");
      const result = await getErrorLogs({
        page: 1, pageSize,
        severity: sp.get("severity") || undefined, status: sp.get("status") || undefined,
        service: sp.get("service") || undefined, module: sp.get("module") || undefined,
        category: sp.get("category") || undefined, search: sp.get("search") || undefined,
      });

      const headers = ["Timestamp","Severity","Status","Service","Module","Message","Occurrences","Correlation ID"];
      const rows = result.items.map((e: any) => [e.lastOccurredAt?.toString().slice(0,19)||"", e.severity, e.status, e.service, e.module, `"${(e.message||"").replace(/"/g,'""')}"`, e.occurrenceCount, e.correlationId||""]);

      const csv = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="error-logs-${new Date().toISOString().slice(0,10)}.csv"` } });
    }

    const result = await getErrorLogs({
      page: parseInt(sp.get("page") || "1"), pageSize: parseInt(sp.get("pageSize") || "50"),
      severity: sp.get("severity") || undefined, status: sp.get("status") || undefined,
      service: sp.get("service") || undefined, module: sp.get("module") || undefined,
      category: sp.get("category") || undefined, search: sp.get("search") || undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    console.error("GET /api/admin/error-logs error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
