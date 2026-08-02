import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { requirePermission, AuthorizationError } from "@/lib/permissions/guards";
import { getExams, getExamResults, getStudentResults, upsertResult, bulkUpsertResults } from "@/services/exam.service";
import { logError } from "@/services/error-log.service";
import { z } from "zod";

const resultSchema = z.object({ examId: z.string(), studentId: z.string(), marksObtained: z.number().min(0), grade: z.string().optional(), remarks: z.string().optional() });
const bulkSchema = z.object({ examId: z.string(), results: z.array(z.object({ studentId: z.string(), marksObtained: z.number().min(0), grade: z.string().optional(), remarks: z.string().optional() })) });

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "students", "read");
    const rc = toRequestContext(authCtx);
    const sp = req.nextUrl.searchParams;
    const examId = sp.get("examId");
    const studentId = sp.get("studentId");

    if (studentId) return NextResponse.json({ success: true, data: await getStudentResults(studentId, rc) });
    if (examId) return NextResponse.json({ success: true, data: await getExamResults(examId, rc) });
    return NextResponse.json({ success: true, data: await getExams(authCtx.schoolId, { classId: sp.get("classId") || undefined }, rc) });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "students", "update");
    const body = await req.json();
    const rc = toRequestContext(authCtx);
    const action = req.nextUrl.searchParams.get("action") || "single";

    if (action === "bulk") {
      const parsed = bulkSchema.parse(body);
      return NextResponse.json({ success: true, data: await bulkUpsertResults(authCtx.schoolId, parsed.examId, parsed.results, rc) }, { status: 201 });
    }
    const parsed = resultSchema.parse(body);
    return NextResponse.json({ success: true, data: await upsertResult(authCtx.schoolId, parsed, rc) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: "VALIDATION", message: e.message } }, { status: 400 });
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    await logError({ service: "API", module: "Exam", severity: "ERROR", category: "API", message: (e as Error).message || "Unknown" });
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
