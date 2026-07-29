import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, toRequestContext } from "@/lib/auth/context";
import { requirePermission, AuthorizationError } from "@/lib/permissions/guards";
import { withRls } from "@/lib/prisma/rls-middleware";
import { auditLog } from "@/lib/audit/logger";
import { z } from "zod";

const createGuardianSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  relationship: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  isPrimary: z.boolean().optional().default(false),
});

const linkGuardianSchema = z.object({
  guardianId: z.string().min(1),
  relationship: z.string().min(1),
  isPrimary: z.boolean().optional().default(false),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), ...createGuardianSchema.shape }),
  z.object({ action: z.literal("link"), ...linkGuardianSchema.shape }),
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studentId } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx)
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Not authenticated" } },
        { status: 401 }
      );
    await requirePermission(authCtx, "students", "update");

    const body = await req.json();
    const parsed = bodySchema.parse(body);
    const rc = toRequestContext(authCtx);
    const schoolId = authCtx.schoolId;

    let created = false;
    let statusCode = 200;

    const result = await withRls(rc, async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId, schoolId },
        select: { id: true, firstName: true, lastName: true, isDeleted: true, status: true },
      });
      if (!student) throw new AuthorizationError("Student not found");
      if (student.isDeleted || student.status === "ARCHIVED")
        throw new AuthorizationError("Cannot modify guardians of an archived student");

      let guardianId: string;

      if (parsed.action === "create") {
        if (parsed.phone) {
          const existing = await tx.guardian.findFirst({
            where: { schoolId, phone: parsed.phone },
            select: { id: true, firstName: true, lastName: true },
          });
          if (existing) {
            const existingLink = await tx.studentGuardian.findUnique({
              where: { studentId_guardianId: { studentId, guardianId: existing.id } },
            });
            if (existingLink) {
              return {
                guardianId: existing.id,
                linked: false,
                created: false,
                message: "Guardian already linked to this student",
              };
            }
            return {
              guardianId: existing.id,
              linked: false,
              created: false,
              existingGuardian: {
                id: existing.id,
                firstName: existing.firstName,
                lastName: existing.lastName,
              },
              message: "Existing guardian found with this phone number",
            };
          }
        }

        const guardian = await tx.guardian.create({
          data: {
            schoolId,
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            relationship: parsed.relationship,
            phone: parsed.phone,
            email: parsed.email,
            address: parsed.address,
          },
        });
        guardianId = guardian.id;
        created = true;
      } else {
        const guardian = await tx.guardian.findUnique({
          where: { id: parsed.guardianId },
          select: { id: true, schoolId: true },
        });
        if (!guardian) throw new AuthorizationError("Guardian not found");
        if (guardian.schoolId !== schoolId)
          throw new AuthorizationError("Guardian belongs to a different school");

        const existingLink = await tx.studentGuardian.findUnique({
          where: {
            studentId_guardianId: { studentId, guardianId: parsed.guardianId },
          },
        });
        if (existingLink) {
          return {
            guardianId: parsed.guardianId,
            linked: false,
            created: false,
            message: "Already linked",
          };
        }

        guardianId = parsed.guardianId;
      }

      let usePrimary = parsed.isPrimary;
      if (parsed.isPrimary) {
        await tx.studentGuardian.updateMany({
          where: { studentId, isPrimary: true },
          data: { isPrimary: false },
        });
      } else {
        const count = await tx.studentGuardian.count({ where: { studentId } });
        if (count === 0) {
          usePrimary = true;
        }
      }

      const link = await tx.studentGuardian.create({
        data: { studentId, guardianId, isPrimary: usePrimary },
        include: { guardian: true },
      });

      created = true;

      return {
        guardianId,
        linked: true,
        created: true,
        isPrimary: usePrimary,
        guardian: {
          id: link.guardian.id,
          firstName: link.guardian.firstName,
          lastName: link.guardian.lastName,
          relationship: link.guardian.relationship,
          phone: link.guardian.phone,
        },
      };
    });

    // Audit log isolated from mutation result (Fix 3 + Fix 6)
    try {
      if ((result as any).linked && (result as any).guardianId) {
        await auditLog({
          userId: authCtx.userId,
          schoolId,
          action: parsed.action === "create" ? "create" : "link",
          entity: "guardian",
          recordId: `${studentId}:${(result as any).guardianId}`,
          after: {
            studentId,
            guardianId: (result as any).guardianId,
            isPrimary: (result as any).isPrimary,
            relationship: parsed.relationship,
          },
        });
      }
    } catch (auditErr) {
      console.error("Audit log write failed (non-blocking):", auditErr);
    }

    // Fix 2: 201 only when something was actually created
    if (created) statusCode = 201;

    return NextResponse.json({ success: true, data: result }, { status: statusCode });
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION", message: e.message } },
        { status: 400 }
      );
    if (e instanceof AuthorizationError)
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: e.message } },
        { status: 403 }
      );
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: (e as Error).message } },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studentId } = await params;
    const authCtx = await getAuthContext();
    if (!authCtx)
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 401 }
      );
    await requirePermission(authCtx, "students", "read");

    const sp = req.nextUrl.searchParams;
    const search = sp.get("search") || "";
    const rc = toRequestContext(authCtx);
    const schoolId = authCtx.schoolId;

    const result = await withRls(rc, async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId, schoolId },
        select: { id: true },
      });
      if (!student) throw new AuthorizationError("Student not found");

      const where: any = { schoolId };
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
      }

      const guardians = await tx.guardian.findMany({
        where,
        take: 20,
        orderBy: { firstName: "asc" },
        include: {
          studentLinks: {
            where: { studentId },
            select: { id: true, isPrimary: true },
          },
        },
      });

      return guardians.map((g) => ({
        id: g.id,
        firstName: g.firstName,
        lastName: g.lastName,
        relationship: g.relationship,
        phone: g.phone,
        email: g.email,
        isLinked: g.studentLinks.length > 0,
        isPrimary: g.studentLinks.some((l) => l.isPrimary),
        linkId: g.studentLinks[0]?.id || null,
      }));
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    if (e instanceof AuthorizationError)
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: e.message } },
        { status: 403 }
      );
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: (e as Error).message } },
      { status: 500 }
    );
  }
}
