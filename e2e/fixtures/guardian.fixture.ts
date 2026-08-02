import type { Page } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

type GuardianInput = {
  firstName: string; lastName: string; relationship: string;
  phone?: string; email?: string; isPrimary?: boolean;
};

export async function createGuardian(
  page: Page, studentId: string, input: GuardianInput
): Promise<{ guardianId: string; linked: boolean }> {
  const res = await page.evaluate(async ({ base, sid, input }: any) => {
    const r = await fetch(`${base}/api/students/${sid}/guardians`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...input }),
    });
    return { status: r.status, data: await r.json() };
  }, { base: BASE_URL, sid: studentId, input });
  return res.data?.data;
}

export async function linkGuardian(
  page: Page, studentId: string, guardianId: string, relationship: string, isPrimary?: boolean
): Promise<{ linked: boolean }> {
  const res = await page.evaluate(async ({ base, sid, gid, rel, primary }: any) => {
    const r = await fetch(`${base}/api/students/${sid}/guardians`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link", guardianId: gid, relationship: rel, isPrimary: primary || false }),
    });
    return { status: r.status, data: await r.json() };
  }, { base: BASE_URL, sid: studentId, gid: guardianId, rel: relationship, primary: isPrimary });
  return res.data?.data;
}

export async function unlinkGuardian(page: Page, studentId: string, guardianId: string): Promise<void> {
  await page.evaluate(async ({ base, sid, gid }: any) => {
    await fetch(`${base}/api/students/${sid}/guardians/${gid}`, { method: "DELETE" });
  }, { base: BASE_URL, sid: studentId, gid: guardianId });
}
