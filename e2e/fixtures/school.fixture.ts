import type { Page } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

export async function setupSchoolB(page: Page): Promise<{ schoolBId: string; studentBId: string }> {
  const res = await page.evaluate(async ({ base }: any) => {
    const r = await fetch(`${base}/api/test/setup-cross-tenant`, { method: "POST" });
    const data = await r.json();
    return data;
  }, { base: BASE_URL });
  return {
    schoolBId: res.data?.schoolB?.id,
    studentBId: res.data?.studentB?.id,
  };
}
