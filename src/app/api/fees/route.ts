import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { requirePermission, AuthorizationError } from "@/lib/permissions/guards";
import { getInvoices, createInvoice, recordPayment, getFeeStructures, createFeeStructure } from "@/services/fee.service";
import { logError } from "@/services/error-log.service";
import { z } from "zod";

const invoiceSchema = z.object({ studentId: z.string().min(1), totalAmount: z.number().positive(), dueDate: z.string().min(1), month: z.string().optional(), notes: z.string().optional() });
const paymentSchema = z.object({ invoiceId: z.string().min(1), amount: z.number().positive(), method: z.enum(["CASH", "CHEQUE", "ONLINE", "BANK_TRANSFER", "OTHER"]).optional(), reference: z.string().optional(), receivedBy: z.string().optional(), notes: z.string().optional() });
const structureSchema = z.object({ categoryId: z.string().min(1), classId: z.string().optional(), amount: z.number().positive(), frequency: z.string().optional() });

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "students", "read");
    const rc = toRequestContext(authCtx);
    const sp = req.nextUrl.searchParams;

    if (sp.get("type") === "structures") {
      return NextResponse.json({ success: true, data: await getFeeStructures(authCtx.schoolId, rc) });
    }
    const result = await getInvoices(authCtx.schoolId, { studentId: sp.get("studentId") || undefined, status: sp.get("status") || undefined, page: parseInt(sp.get("page") || "1") }, rc);
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "students", "create");
    const body = await req.json();
    const rc = toRequestContext(authCtx);
    const action = req.nextUrl.searchParams.get("action") || "invoice";

    if (action === "structure") {
      const parsed = structureSchema.parse(body);
      return NextResponse.json({ success: true, data: await createFeeStructure(authCtx.schoolId, parsed, rc) }, { status: 201 });
    }
    if (action === "payment") {
      const parsed = paymentSchema.parse(body);
      return NextResponse.json({ success: true, data: await recordPayment(authCtx.schoolId, parsed, rc) }, { status: 201 });
    }

    const parsed = invoiceSchema.parse(body);
    const invoice = await createInvoice(authCtx.schoolId, parsed, rc);
    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: "VALIDATION", message: e.message } }, { status: 400 });
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    await logError({ service: "API", module: "Fees", severity: "ERROR", category: "API", message: (e as Error).message || "Unknown" });
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
