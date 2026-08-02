import type { ScreenshotEntry } from "./screenshots";

export function detectDuplicates(
  manifest: ScreenshotEntry[],
  outputDir: string
): { fileA: string; fileB: string; hash: string; expected: boolean; reason: string }[] {
  const byHash: Record<string, ScreenshotEntry[]> = {};
  for (const s of manifest) {
    if (!byHash[s.sha256]) byHash[s.sha256] = [];
    byHash[s.sha256].push(s);
  }

  const { existsSync } = require("fs");

  const allowList = [
    ["G4B-after-cancel.png", "G4C-form-preserved.png"],
    ["B4A-edit-archived.png", "B4D-archive-again.png"],
    ["B4B-add-guardian-archived.png", "B4C-replace-primary-archived.png"],
    ["G6-after-unlink.png", "G7-final-state.png"],
  ];

  const dupes: { fileA: string; fileB: string; hash: string; expected: boolean; reason: string }[] = [];
  for (const [hash, entries] of Object.entries(byHash)) {
    if (entries.length > 1) {
      const filenames = entries.map((e) => e.filename);
      const isExpected = allowList.some(
        ([a, b]) =>
          filenames.includes(a) &&
          filenames.includes(b) &&
          entries.every((e) => existsSync(resolve(require("path").resolve(outputDir, e.filename))))
      );
      dupes.push({
        fileA: entries[0].filename,
        fileB: entries[1].filename,
        hash,
        expected: isExpected,
        reason: isExpected ? "Allow-listed duplicate" : "Unexpected duplicate image",
      });
    }
  }
  return dupes;
}

import { resolve } from "path";

export interface ScenarioState {
  status: string;
  networkIdxStart: number;
  networkIdxEnd: number;
  failureReason?: string;
}

export interface NetworkEntry {
  method: string;
  url: string;
  status: number;
  timestamp: string;
}

export function validateScenarios(
  scenarios: Record<string, ScenarioState>,
  network: NetworkEntry[]
): string[] {
  const errors: string[] = [];
  for (const [id, s] of Object.entries(scenarios)) {
    if (s.status !== "PASS") continue;
    if (s.networkIdxStart < 0 || s.networkIdxStart >= network.length) {
      errors.push(`${id}: networkIdxStart ${s.networkIdxStart} out of range`);
    }
    if (s.networkIdxEnd < s.networkIdxStart) {
      errors.push(`${id}: networkIdxEnd ${s.networkIdxEnd} < networkIdxStart ${s.networkIdxStart}`);
    }
  }
  return errors;
}

export function validateEvidence(
  manifest: ScreenshotEntry[],
  scenarios: Record<string, ScenarioState>,
  network: NetworkEntry[],
  outputDir: string
): string[] {
  const errors: string[] = [];
  errors.push(...validateScenarios(scenarios, network));
  const dupes = detectDuplicates(manifest, outputDir);
  const unexpected = dupes.filter((d) => !d.expected);
  if (unexpected.length > 0) {
    errors.push(`${unexpected.length} unexpected duplicate screenshot pair(s)`);
  }
  const { existsSync, statSync } = require("fs");
  for (const s of manifest) {
    const fpath = resolve(outputDir, s.filename);
    if (!existsSync(fpath)) errors.push(`Missing screenshot: ${s.filename}`);
    else if (statSync(fpath).size === 0) errors.push(`Empty screenshot: ${s.filename}`);
  }
  return errors;
}
