import { type Page } from "@playwright/test";
import { resolve } from "path";
import { writeFileSync, statSync } from "fs";
import { createHash } from "crypto";

export interface ScreenshotEntry {
  filename: string;
  sha256: string;
  size: number;
  createdAt: string;
  scenario: string;
}

export function hashBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function capture(
  page: Page,
  outDir: string,
  scenario: string,
  name: string
): Promise<ScreenshotEntry> {
  const path = resolve(outDir, `${name}.png`);
  const buf = await page.screenshot({ path, fullPage: true });
  const hash = hashBuffer(buf);
  const st = statSync(path);
  return { filename: `${name}.png`, sha256: hash, size: st.size, createdAt: new Date().toISOString(), scenario };
}
