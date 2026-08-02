import type { Page } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

export async function verifyStudent(page: Page, studentId: string): Promise<any> {
  const res = await page.evaluate(async ({ base, id }: any) => {
    const r = await fetch(`${base}/api/students/${id}`);
    return { status: r.status, data: await r.json() };
  }, { base: BASE_URL, id: studentId });
  return res.data?.data;
}

export async function verifyGuardians(page: Page, studentId: string): Promise<any[]> {
  const student = await verifyStudent(page, studentId);
  return student?.guardians || [];
}

export async function verifyRelationship(
  page: Page, studentId: string, guardianId: string
): Promise<boolean> {
  const guardians = await verifyGuardians(page, studentId);
  return guardians.some((g: any) =>
    (g.guardian?.id || g.guardianId) === guardianId
  );
}
