import { test as base, type Page } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

type AuthFixtures = {
  authenticatedAdmin: Page;
  authenticatedTeacher: Page;
};

export const test = base.extend<AuthFixtures>({
  authenticatedAdmin: async ({ page }, use) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.locator("input[name=email]").fill("admin@easystem.dev");
    await page.locator("#password").fill("password123");
    await page.locator("button[type=submit]").click();
    await page.getByRole("button", { name: /continue to dashboard/i }).waitFor({ state: "visible", timeout: 15000 });
    await page.getByRole("button", { name: /continue to dashboard/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 15000 });
    await use(page);
  },

  authenticatedTeacher: async ({ page }, use) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await page.locator("input[name=email]").fill("teacher@easystem.dev");
    await page.locator("#password").fill("password123");
    await page.locator("button[type=submit]").click();
    await page.getByRole("button", { name: /continue to dashboard/i }).waitFor({ state: "visible", timeout: 15000 });
    await page.getByRole("button", { name: /continue to dashboard/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 15000 });
    await use(page);
  },
});

export { expect } from "@playwright/test";
