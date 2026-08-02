import { mkdirSync } from "fs";
import { getRunDir, updateLatest } from "./utils";

export function initEvidence() {
  const dir = getRunDir();
  mkdirSync(dir, { recursive: true });
  updateLatest(dir, "PENDING");
  return dir;
}
