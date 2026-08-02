import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/context";
import { authPrisma } from "@/lib/prisma/auth-client";
import { hashPassword } from "better-auth/crypto";
import { logError } from "@/services/error-log.service";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1), slug: z.string().min(1), email: z.string().email().optional(), phone: z.string().optional(),
  board: z.string().optional(), country: z.string().optional(), state: z.string().optional(), city: z.string().optional(),
  address: z.string().optional(), timezone: z.string().default("Asia/Kolkata"), currency: z.string().default("INR"),
  plan: z.string().default("TRIALING"), adminName: z.string().min(1), adminEmail: z.string().email(), adminPassword: z.string().min(8),
});

export async function GET(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    if (authCtx.role !== "SUPER_ADMIN") return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1"));
    const pageSize = Math.min(100, parseInt(sp.get("pageSize") || "50"));
    const search = sp.get("search") || "";
    const status = sp.get("status") || "";

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { state: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total, counts] = await Promise.all([
      authPrisma.school.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { students: true, memberships: true } }, subscription: { select: { status: true, plan: { select: { name: true } } } } },
      }),
      authPrisma.school.count({ where }),
      Promise.all([
        authPrisma.school.count(), authPrisma.school.count({ where: { status: "ACTIVE" } }),
        authPrisma.subscription.count({ where: { status: "TRIALING" } }), authPrisma.school.count({ where: { status: "SUSPENDED" } }),
        authPrisma.subscription.count({ where: { status: "PAST_DUE" } }),
      ]),
    ]);

    const mapped = items.map((s: any) => ({ id: s.id, name: s.name, slug: s.slug, city: s.city, state: s.state, status: s.status, createdAt: s.createdAt.toISOString(), plan: s.subscription?.plan?.name || s.subscription?.status || "—", students: s._count.students, teachers: s._count.memberships }));
    const summary = { total: counts[0], active: counts[1], trial: counts[2], suspended: counts[3], expired: counts[4] };

    return NextResponse.json({ success: true, data: { items: mapped, total, page, pageSize, totalPages: Math.ceil(total / pageSize), summary } });
  } catch (e) {
    console.error("GET /api/admin/schools error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getAuthContext();
    if (!authCtx) return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 401 });
    if (authCtx.role !== "SUPER_ADMIN") return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });

    const body = await req.json();
    const parsed = createSchema.parse(body);

    const password = await hashPassword(parsed.adminPassword);

    const result = await authPrisma.$transaction(async (tx) => {
      const school = await tx.school.create({ data: { name: parsed.name, slug: parsed.slug.toLowerCase(), status: "ACTIVE", timezone: parsed.timezone, currency: parsed.currency, city: parsed.city, state: parsed.state, address: parsed.address } });
      const user = await tx.user.create({ data: { name: parsed.adminName, email: parsed.adminEmail, emailVerified: true, status: "active" } });
      await tx.account.create({ data: { accountId: user.id, providerId: "credential", userId: user.id, password } });
      await tx.membership.create({ data: { schoolId: school.id, userId: user.id, role: "SCHOOL_ADMIN", status: "ACTIVE" } });

      const plan = await tx.plan.findFirst({ where: { name: parsed.plan } });
      if (plan) await tx.subscription.create({ data: { schoolId: school.id, planId: plan.id, status: "TRIALING", studentLimit: plan.studentLimit, staffLimit: plan.staffLimit } });

      await tx.auditLog.create({ data: { userId: authCtx.userId, schoolId: school.id, action: "create", entity: "School", recordId: school.id, after: { name: school.name, admin: parsed.adminEmail } } });
      return school;
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ success: false, error: { code: "VALIDATION", message: e.message } }, { status: 400 });
    await logError({ service: "API", module: "Schools", severity: "ERROR", category: "API", message: (e as Error).message || "Unknown", errorCode: "INTERNAL" });
    console.error("POST /api/admin/schools error:", e);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "An unexpected error occurred" } }, { status: 500 });
  }
}
