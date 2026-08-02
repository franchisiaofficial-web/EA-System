import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getRunDir, updateLatest } from "../helpers/utils";
import { validateEvidence } from "../helpers/validator";
import type { ScreenshotEntry } from "../helpers/screenshots";
import type { NetworkEntry } from "../helpers/network";
import type { ScenarioState } from "../helpers/validator";

export interface EvidenceSummary {
  version: number;
  generatedAt: string;
  overall: string;
  scenarios: Record<string, ScenarioState>;
  screenshots: ScreenshotEntry[];
  network: NetworkEntry[];
  validationErrors: string[];
  duplicateScreenshots: unknown[];
  accessibility: { executed: boolean; reason?: string };
  performance: Record<string, unknown>;
}

let currentScenario: string | null = null;
let scenarioStartIdx = 0;

export function beginScenario(id: string, network: NetworkEntry[]) {
  currentScenario = id;
  scenarioStartIdx = network.length;
}

export function endScenario(
  id: string,
  scenarios: Record<string, ScenarioState>,
  network: NetworkEntry[]
) {
  if (!scenarios[id]) {
    scenarios[id] = {
      status: "PASS",
      networkIdxStart: scenarioStartIdx,
      networkIdxEnd: network.length,
    };
  } else {
    scenarios[id].status = "PASS";
    scenarios[id].networkIdxEnd = network.length;
  }
  currentScenario = null;
}

export function failScenario(id: string, reason: string, scenarios: Record<string, ScenarioState>) {
  scenarios[id] = {
    status: "FAIL",
    networkIdxStart: scenarioStartIdx,
    networkIdxEnd: 0,
    failureReason: reason,
  };
}

export function generateSummary(
  outDir: string,
  manifest: ScreenshotEntry[],
  network: NetworkEntry[],
  scenarios: Record<string, ScenarioState>,
  accessibility: { executed: boolean; reason?: string },
  performance: Record<string, unknown>
): EvidenceSummary {
  const errors = validateEvidence(manifest, scenarios, network, outDir);
  const passed = Object.values(scenarios).filter((s) => s.status === "PASS").length;
  const total = Object.keys(scenarios).length;
  const overall = errors.length > 0 ? "PARTIAL" : passed >= total ? "PASS" : "PARTIAL";

  const summary: EvidenceSummary = {
    version: 1,
    generatedAt: new Date().toISOString(),
    overall,
    scenarios,
    screenshots: manifest,
    network,
    validationErrors: errors,
    duplicateScreenshots: [],
    accessibility,
    performance,
  };

  const path = resolve(outDir, "e2e-summary.json");
  writeFileSync(path, JSON.stringify(summary, null, 2));
  updateLatest(outDir, overall);

  return summary;
}
