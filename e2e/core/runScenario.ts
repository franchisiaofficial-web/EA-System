import type { Page } from "@playwright/test";
import type { ScenarioDefinition } from "./scenario-definition";
import type { ScenarioContext, NetworkEntry, ScreenshotManifestEntry, PerformanceResult } from "./scenario-context";
import { PluginManager } from "./plugin-manager";
import { log } from "../logger";
import { BASE_URL } from "../config/constants";
import { capture } from "../helpers/screenshots";
import { measure } from "../helpers/performance";

export async function runScenario(
  definition: ScenarioDefinition,
  page: Page,
  plugins: PluginManager
): Promise<{ scenarioId: string; status: string; reason?: string }> {
  if (!definition.enabled) {
    log("INFO", `Scenario ${definition.id} is disabled — skipping`);
    return { scenarioId: definition.id, status: "SKIPPED" };
  }

  log("INFO", `Starting scenario: ${definition.id} — ${definition.name}`);

  const networkEntries: NetworkEntry[] = [];
  const screenshotManifest: ScreenshotManifestEntry[] = [];
  const performanceResults: Record<string, PerformanceResult> = {};
  const outDir = ""; // populated by evidence init

  const ctx: ScenarioContext = {
    page,
    scenarioId: definition.id,
    scenarioName: definition.name,
    evidence: {
      beginScenario(_id: string) { /* collector hook */ },
      endScenario(_id: string) { /* collector hook */ },
      failScenario(_id: string, _reason: string) { /* collector hook */ },
      generateSummary() { return null; },
    },
    network: {
      entries: networkEntries,
      startCapture() {
        page.on("response", async (res) => {
          const url: string = res.url();
          if (!url.includes("/api/")) return;
          const entry: NetworkEntry = {
            method: res.request().method(),
            url: url.replace(BASE_URL, ""),
            status: res.status(),
            timestamp: new Date().toISOString(),
          };
          try {
            entry.requestBody = res.request().postDataJSON() || undefined;
            const text = await res.text();
            try { entry.responseBody = JSON.parse(text); } catch {}
          } catch {}
          networkEntries.push(entry);
        });
      },
    },
    performance: {
      results: performanceResults,
      measure: async (label, fn, iterations) => {
        const result = await measure(label, fn, iterations);
        performanceResults[label] = result;
        return result;
      },
    },
    screenshots: {
      manifest: screenshotManifest,
      capture: async (scenario, name) => {
        const entry = await capture(page, outDir, scenario, name);
        screenshotManifest.push(entry);
        return entry;
      },
    },
    database: {
      verifyStudent: async (studentId: string) => {
        const r = await page.evaluate(async ({ base, id }: any) => {
          const res = await fetch(`${base}/api/students/${id}`);
          return { status: res.status, data: await res.json() };
        }, { base: BASE_URL, id: studentId });
        return r.data?.data;
      },
      verifyGuardian: async (studentId: string, guardianId: string) => {
        const r = await page.evaluate(async ({ base, sid, gid }: any) => {
          const res = await fetch(`${base}/api/students/${sid}`);
          const d = await res.json();
          const guardians = d.data?.guardians || [];
          return guardians.some((g: any) => (g.guardian?.id || g.guardianId) === gid);
        }, { base: BASE_URL, sid: studentId, gid: guardianId });
        return r;
      },
      verifyRelationship: async (studentId: string, guardianId: string) => {
        const r = await page.evaluate(async ({ base, sid, gid }: any) => {
          const res = await fetch(`${base}/api/students/${sid}`);
          const d = await res.json();
          const guardians = d.data?.guardians || [];
          return guardians.some((g: any) => (g.guardian?.id || g.guardianId) === gid);
        }, { base: BASE_URL, sid: studentId, gid: guardianId });
        return r;
      },
    },
  };

  try {
    await plugins.executeBeforeHooks(ctx);
    await definition.execute(ctx);
    await plugins.executeAfterHooks(ctx);

    log("INFO", `Scenario ${definition.id} PASS`);
    return { scenarioId: definition.id, status: "PASS" };
  } catch (e) {
    const msg = (e as Error).message;
    log("ERROR", `Scenario ${definition.id} FAIL: ${msg}`);
    await plugins.executeFailureHooks(e as Error, ctx);
    return { scenarioId: definition.id, status: "FAIL", reason: msg };
  }
}
