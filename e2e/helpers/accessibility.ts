import type { Page } from "@playwright/test";

export interface AccessibilityResult {
  executed: boolean;
  reason?: string;
  violations?: unknown[];
  passes?: unknown[];
  incomplete?: unknown[];
}

export async function runAccessibility(page: Page): Promise<AccessibilityResult> {
  return { executed: false, reason: "@axe-core/playwright is not installed. Run: npm install @axe-core/playwright" };
}
