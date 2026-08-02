import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { requirePermission, AuthorizationError } from "@/lib/permissions/guards";
import { withRls } from "@/lib/prisma/rls-middleware";
import { z } from "zod";

const schema = z.object({ classId: z.string().min(1), sectionId: z.string().optional(), subjectId: z.string().min(1), teacherId: z.string().optional(), dayOfWeek: z.number().min(1).max(7), startTime: z.string(), endTime: z.string(), roomNo: z.string().optional() });

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "students", "read");
    const rc = toRequestContext(authCtx);
    const classId = req.nextUrl.searchParams.get("classId");
    const sectionId = req.nextUrl.searchParams.get("sectionId");
    const items = await withRls(rc, (tx) => tx.timetable.findMany({
      where: { schoolId: authCtx.schoolId, ...(classId ? { classId } : {}), ...(sectionId ? { sectionId } : {}) },
      include: { subject: { select: { name: true } }, class: { select: { name: true } }, section: { select: { name: true } }, teacher: { select: { user: { select: { name: true } } } } },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }));
    return NextResponse.json({ success: true, data: items });
  } catch (e) { return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "students", "create");
    const body = await req.json();
    const parsed = schema.parse(body);
    const rc = toRequestContext(authCtx);
    const item = await withRls(rc, async (tx) => {
      const cls = await tx.class.findFirst({ where: { id: parsed.classId, schoolId: authCtx.schoolId }, select: { id: true } });
      if (!cls) throw new AuthorizationError("Class not found in this school");
      if (parsed.sectionId) {
        const sec = await tx.section.findFirst({ where: { id: parsed.sectionId, schoolId: authCtx.schoolId, classId: parsed.classId }, select: { id: true } });
        if (!sec) throw new AuthorizationError("Section not found in this school");
      }
      const subj = await tx.subject.findFirst({ where: { id: parsed.subjectId, schoolId: authCtx.schoolId }, select: { id: true } });
      if (!subj) throw new AuthorizationError("Subject not found in this school");
      if (parsed.teacherId) {
        const mem = await tx.membership.findFirst({ where: { id: parsed.teacherId, schoolId: authCtx.schoolId }, select: { id: true } });
        if (!mem) throw new AuthorizationError("Teacher not found in this school");
      }
      return tx.timetable.create({ data: { schoolId: authCtx.schoolId, ...parsed } });
    });
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: "VALIDATION" } }, { status: 400 });
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
