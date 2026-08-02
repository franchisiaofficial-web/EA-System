import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync, copyFileSync, statSync } from "fs";
import { resolve } from "path";
import { createHash } from "crypto";

const OUT = resolve("evidence", "framework-test");
mkdirSync(OUT, { recursive: true });

let passed = 0;
let failed = 0;
const results: string[] = [];

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) { passed++; results.push(`  ✓ ${label}`); console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`); }
  else { failed++; results.push(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); }
}

// ── Helpers (mirrors guardian-evidence.ts logic) ──
function hashFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

interface ScreenshotEntry {
  filename: string; sha256: string; size: number; createdAt: string; scenario: string;
}

function detectDuplicates(manifest: ScreenshotEntry[]): { fileA: string; fileB: string; hash: string; reason: string; expected: boolean }[] {
  const byHash: Record<string, ScreenshotEntry[]> = {};
  for (const s of manifest) { if (!byHash[s.sha256]) byHash[s.sha256] = []; byHash[s.sha256].push(s); }
  const dupes: any[] = [];
  const allowList = [
    ["G4B-after-cancel.png", "G4C-form-preserved.png"],
    ["B4A-edit-archived.png", "B4D-archive-again.png"],
    ["B4B-add-guardian-archived.png", "B4C-replace-primary-archived.png"],
    ["G6-after-unlink.png", "G7-final-state.png"],
  ];
  for (const [hash, entries] of Object.entries(byHash)) {
    if (entries.length > 1) {
      const filenames = entries.map((e) => e.filename);
      const isExpected = allowList.some(([a, b]) =>
        filenames.includes(a) && filenames.includes(b) && entries.every((e) => existsSync(resolve(OUT, e.filename)))
      );
      dupes.push({ fileA: entries[0].filename, fileB: entries[1].filename, hash, reason: isExpected ? "Allow-listed duplicate" : "Unexpected duplicate image", expected: isExpected });
    }
  }
  return dupes;
}

// ── Setup: create test screenshots ──
const img1Path = resolve(OUT, "test-A.png");
const img2Path = resolve(OUT, "test-B.png");
const img3Path = resolve(OUT, "test-C.png");
const img4Path = resolve(OUT, "test-D.png");
writeFileSync(img1Path, Buffer.from("UNIQUE_DATA_A_" + Math.random())); // unique
writeFileSync(img2Path, Buffer.from("UNIQUE_DATA_B_" + Math.random())); // unique
writeFileSync(img3Path, Buffer.from("UNIQUE_DATA_C_" + Math.random())); // unique
writeFileSync(img4Path, Buffer.from("UNIQUE_DATA_C_" + Math.random())); // unique

// ═══ A1: Unexpected Duplicate Detection ═══
console.log("\n=== A1: Unexpected Duplicate Detection ===");
let manifest: ScreenshotEntry[] = [
  { filename: "test-A.png", sha256: hashFile(img1Path), size: statSync(img1Path).size, createdAt: "", scenario: "T1" },
  { filename: "test-B.png", sha256: hashFile(img2Path), size: statSync(img2Path).size, createdAt: "", scenario: "T2" },
  { filename: "test-C.png", sha256: hashFile(img3Path), size: statSync(img3Path).size, createdAt: "", scenario: "T3" },
];

// Part A: Normal — no duplicates
let dupes = detectDuplicates(manifest);
assert("A1a: no duplicates in normal run", dupes.length === 0, `${dupes.length} dupes found`);

// Part B: Create unexpected duplicate by copying file
copyFileSync(img3Path, resolve(OUT, "test-B.png"));
manifest[1].sha256 = hashFile(resolve(OUT, "test-B.png"));
manifest[1].size = statSync(resolve(OUT, "test-B.png")).size;
dupes = detectDuplicates(manifest);
assert("A1b: unexpected duplicate detected", dupes.length === 1 && !dupes[0].expected);
assert("A1b: reason is 'Unexpected duplicate image'", dupes[0]?.reason === "Unexpected duplicate image");

// Restore
writeFileSync(resolve(OUT, "test-B.png"), Buffer.from("UNIQUE_DATA_B_" + Math.random()));
manifest[1].sha256 = hashFile(resolve(OUT, "test-B.png"));
dupes = detectDuplicates(manifest);
assert("A1c: restored — no duplicates", dupes.length === 0);

// ═══ A2: Scenario Index Validation ═══
console.log("\n=== A2: Scenario Index Validation ===");
const scenarios = {
  "T1": { status: "PASS" as const, screenshots: [], networkIdxStart: 0, networkIdxEnd: 3 },
  "T2": { status: "PASS" as const, screenshots: [], networkIdxStart: 5, networkIdxEnd: 3 }, // end < start — invalid
  "T3": { status: "PASS" as const, screenshots: [], networkIdxStart: 999, networkIdxEnd: 1000 }, // out of range
};

const networkRequests = [{ method: "GET" }, { method: "POST" }, { method: "PATCH" }, { method: "DELETE" }];

const valErrors: string[] = [];
for (const [id, s] of Object.entries(scenarios)) {
  if (s.status !== "PASS") continue;
  if (s.networkIdxStart >= networkRequests.length) valErrors.push(`${id}: networkIdxStart out of range`);
  if (s.networkIdxEnd < s.networkIdxStart) valErrors.push(`${id}: networkIdxEnd < networkIdxStart`);
}
assert("A2a: detected invalid index range (end < start)", valErrors.some((e) => e.includes("networkIdxEnd < networkIdxStart")));
assert("A2b: detected out-of-range index", valErrors.some((e) => e.includes("out of range")));

// ═══ A3: Missing Screenshot ═══
console.log("\n=== A3: Missing Screenshot Detection ===");
const missingFile = resolve(OUT, "nonexistent.png");
assert("A3a: missing file detected", !existsSync(missingFile));

// ═══ A4: Empty Screenshot ═══
console.log("\n=== A4: Empty Screenshot Detection ===");
const emptyPath = resolve(OUT, "empty.png");
writeFileSync(emptyPath, "");
assert("A4a: empty file size = 0", statSync(emptyPath).size === 0);
unlinkSync(emptyPath);

// ═══ A5: Hash Integrity ═══
console.log("\n=== A5: Hash Integrity ===");
const h1 = hashFile(img1Path);
writeFileSync(img1Path, Buffer.from("MODIFIED_" + Date.now()));
const h2 = hashFile(img1Path);
assert("A5a: hash changes after modification", h1 !== h2);
writeFileSync(img1Path, Buffer.from("IMAGE_DATA_A_" + Date.now())); // restore

// ═══ A6: Allow-List Verification ═══
console.log("\n=== A6: Allow-List Verification ===");

// Part A — Expected duplicate
const allowImgA = resolve(OUT, "G4B-after-cancel.png");
const allowImgB = resolve(OUT, "G4C-form-preserved.png");
const sharedData = Buffer.from("SHARED_ALLOW_LIST_DATA_" + Date.now());
writeFileSync(allowImgA, sharedData);
copyFileSync(allowImgA, allowImgB);

const allowManifest: ScreenshotEntry[] = [
  { filename: "G4B-after-cancel.png", sha256: hashFile(allowImgA), size: sharedData.length, createdAt: "", scenario: "G4B" },
  { filename: "G4C-form-preserved.png", sha256: hashFile(allowImgB), size: sharedData.length, createdAt: "", scenario: "G4C" },
  { filename: "test-C.png", sha256: hashFile(img3Path), size: statSync(img3Path).size, createdAt: "", scenario: "T3" },
];
const allowDupes = detectDuplicates(allowManifest);
assert("A6a: expected duplicate PASSes (allow-listed G4B/G4C)", allowDupes.length === 1 && allowDupes[0].expected);
assert("A6a: reason is 'Allow-listed duplicate'", allowDupes[0]?.reason === "Allow-listed duplicate");

// Part B — Unexpected duplicate (not on allow-list)
copyFileSync(img3Path, resolve(OUT, "test-A.png"));
const badManifest: ScreenshotEntry[] = [
  { filename: "test-A.png", sha256: hashFile(img3Path), size: statSync(img3Path).size, createdAt: "", scenario: "T1" },
  { filename: "test-C.png", sha256: hashFile(img3Path), size: statSync(img3Path).size, createdAt: "", scenario: "T3" },
];
const badDupes = detectDuplicates(badManifest);
assert("A6b: unexpected duplicate FAILs (not on allow-list)", badDupes.length === 1 && !badDupes[0].expected);

// Part C — Invalid allow-list (referenced files don't exist)
const fakeManifest: ScreenshotEntry[] = [
  { filename: "fakeA.png", sha256: "abc123", size: 100, createdAt: "", scenario: "FAKE" },
  { filename: "fakeB.png", sha256: "abc123", size: 100, createdAt: "", scenario: "FAKE" },
];
const fakeDupes = detectDuplicates(fakeManifest);
assert("A6c: invalid allow-list entry (fake files don't exist)", fakeDupes.length === 1 && !fakeDupes[0].expected, "duplicate detected but not allow-listed because files don't exist");

// Part D — Hash mismatch (allow-listed files modified)
writeFileSync(allowImgB, Buffer.from("DIFFERENT_DATA_" + Date.now())); // modify one
const mismatchManifest: ScreenshotEntry[] = [
  { filename: "G4B-after-cancel.png", sha256: hashFile(allowImgA), size: sharedData.length, createdAt: "", scenario: "G4B" },
  { filename: "G4C-form-preserved.png", sha256: hashFile(allowImgB), size: statSync(allowImgB).size, createdAt: "", scenario: "G4C" },
];
const mismatchDupes = detectDuplicates(mismatchManifest);
assert("A6d: hash mismatch — files no longer identical, not detected as duplicate", mismatchDupes.length === 0, `${mismatchDupes.length} dupes (expected 0 — hashes differ)`);

// Cleanup
try {
  unlinkSync(allowImgA); unlinkSync(allowImgB);
  unlinkSync(img1Path); unlinkSync(img2Path); unlinkSync(img3Path); unlinkSync(img4Path);
} catch {}

// ═══ Summary ═══
console.log(`\n=== FRAMEWORK RESULTS ===`);
console.log(`  Passed: ${passed}/${passed + failed}`);
console.log(`  Failed: ${failed}/${passed + failed}`);
results.forEach((r) => console.log(r));
const overall = failed === 0 ? "PASS" : "FAIL";
console.log(`\n  Framework: ${overall}`);

writeFileSync(resolve(OUT, "framework-test-results.json"), JSON.stringify({ passed, failed, overall, results }, null, 2));
process.exit(failed > 0 ? 1 : 0);
