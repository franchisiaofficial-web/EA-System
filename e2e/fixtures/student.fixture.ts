import type { Page } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

export async function createStudent(
  page: Page,
  details: { firstName: string; lastName: string; admissionNumber: string; dateOfBirth?: string; gender?: string; phone?: string }
): Promise<{ id: string; admissionNumber: string }> {
  const res = await page.evaluate(async ({ base, details }: any) => {
    const r = await fetch(`${base}/api/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    return { status: r.status, data: await r.json() };
  }, { base: BASE_URL, details });

  if (!res.data?.success) throw new Error(`Student creation failed: ${JSON.stringify(res.data)}`);
  return { id: res.data.data.id, admissionNumber: res.data.data.admissionNumber };
}

export async function archiveStudent(page: Page, studentId: string): Promise<void> {
  await page.evaluate(async ({ base, id }: any) => {
    await fetch(`${base}/api/students/${id}`, { method: "DELETE" });
  }, { base: BASE_URL, id: studentId });
}

export async function getStudent(page: Page, studentId: string): Promise<any> {
  const res = await page.evaluate(async ({ base, id }: any) => {
    const r = await fetch(`${base}/api/students/${id}`);
    return { status: r.status, data: await r.json() };
  }, { base: BASE_URL, id: studentId });
  return res.data?.data;
}
