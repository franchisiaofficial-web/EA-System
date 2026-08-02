import { resolve } from "path";
import { writeFileSync } from "fs";

const RUNS_DIR = resolve("evidence", "runs");
const LATEST_PATH = resolve("evidence", "latest.json");

export function getRunDir(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve(RUNS_DIR, ts);
}

export function updateLatest(runDir: string, result: string) {
  writeFileSync(
    LATEST_PATH,
    JSON.stringify({ latest: runDir, result, updatedAt: new Date().toISOString() }, null, 2)
  );
}
