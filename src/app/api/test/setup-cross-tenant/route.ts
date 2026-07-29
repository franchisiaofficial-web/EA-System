import { NextResponse } from "next/server";
import { authPrisma } from "@/lib/prisma/auth-client";
import { getAuthContext } from "@/lib/auth/context";

export async function POST() {
  const authCtx = await getAuthContext();
  if (!authCtx || authCtx.role !== "SUPER_ADMIN") {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  try {
    const schoolB = await authPrisma.school.upsert({
      where: { slug: "school-b" },
      update: {},
      create: {
        name: "School B (Cross-Tenant Test)",
        slug: "school-b",
        status: "ACTIVE",
        timezone: "Asia/Kolkata",
        currency: "INR",
      },
    });

    const studentB = await authPrisma.student.upsert({
      where: { schoolId_admissionNumber: { schoolId: schoolB.id, admissionNumber: "CT-STUDENT" } },
      update: {},
      create: {
        schoolId: schoolB.id,
        firstName: "Cross",
        lastName: "TenantStudent",
        admissionNumber: "CT-STUDENT",
        phone: "555-CT",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        schoolB: { id: schoolB.id, name: schoolB.name, slug: schoolB.slug },
        studentB: { id: studentB.id, admissionNumber: studentB.admissionNumber },
        schoolA: { id: authCtx.schoolId },
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: (e as Error).message } },
      { status: 500 }
    );
  }
}
