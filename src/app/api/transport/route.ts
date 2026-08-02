import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { requirePermission, AuthorizationError } from "@/lib/permissions/guards";
import { withRls } from "@/lib/prisma/rls-middleware";
import { z } from "zod";

const vehicleSchema = z.object({ name: z.string().min(1), vehicleNo: z.string().min(1), type: z.string().optional(), capacity: z.number().optional(), driverName: z.string().optional(), driverPhone: z.string().optional() });
const assignmentSchema = z.object({ studentId: z.string(), routeId: z.string().optional(), vehicleId: z.string().optional(), pickupPoint: z.string().optional(), fee: z.number().optional() });

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "students", "read");
    const rc = toRequestContext(authCtx);
    const type = req.nextUrl.searchParams.get("type") || "vehicles";
    if (type === "assignments") {
      const items = await withRls(rc, (tx) => tx.transportAssignment.findMany({ where: { schoolId: authCtx.schoolId, isActive: true }, include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } }, route: { select: { name: true } }, vehicle: { select: { name: true, vehicleNo: true } } }, orderBy: { student: { firstName: "asc" } } }));
      return NextResponse.json({ success: true, data: items });
    }
    if (type === "routes") {
      return NextResponse.json({ success: true, data: await withRls(rc, (tx) => tx.transportRoute.findMany({ where: { schoolId: authCtx.schoolId }, include: { vehicle: { select: { name: true, vehicleNo: true } } } })) });
    }
    return NextResponse.json({ success: true, data: await withRls(rc, (tx) => tx.vehicle.findMany({ where: { schoolId: authCtx.schoolId, isActive: true } })) });
  } catch (e) { return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    await requirePermission(authCtx, "students", "create");
    const body = await req.json();
    const action = req.nextUrl.searchParams.get("action") || "vehicle";
    const rc = toRequestContext(authCtx);
    if (action === "assignment") {
      const parsed = assignmentSchema.parse(body);
      return NextResponse.json({ success: true, data: await withRls(rc, async (tx) => {
        const student = await tx.student.findFirst({ where: { id: parsed.studentId, schoolId: authCtx.schoolId }, select: { id: true } });
        if (!student) throw new AuthorizationError("Student not found in this school");
        if (parsed.routeId) {
          const route = await tx.transportRoute.findFirst({ where: { id: parsed.routeId, schoolId: authCtx.schoolId }, select: { id: true } });
          if (!route) throw new AuthorizationError("Route not found in this school");
        }
        if (parsed.vehicleId) {
          const vehicle = await tx.vehicle.findFirst({ where: { id: parsed.vehicleId, schoolId: authCtx.schoolId }, select: { id: true } });
          if (!vehicle) throw new AuthorizationError("Vehicle not found in this school");
        }
        return tx.transportAssignment.create({ data: { schoolId: authCtx.schoolId, ...parsed } });
      }) }, { status: 201 });
    }
    const parsed = vehicleSchema.parse(body);
    return NextResponse.json({ success: true, data: await withRls(rc, (tx) => tx.vehicle.create({ data: { schoolId: authCtx.schoolId, ...parsed } })) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: "VALIDATION" } }, { status: 400 });
    if (e instanceof AuthorizationError) return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
