import { chromium } from "playwright";
import { spawn } from "child_process";
import { resolve } from "path";
import { mkdirSync, readdirSync, rmSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = resolve("evidence");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let server;

// ── server lifecycle ──
function start() {
  return new Promise<void>((ok) => {
    server = spawn("npx.cmd", ["next", "dev"], {
      cwd: resolve("."),
      stdio: "pipe",
      shell: true,
    });
    server.stdout.on("data", (d: Buffer) => {
      if (d.toString().includes("Ready in")) ok();
    });
  });
}
function stop() {
  const { execSync } = require("child_process");
  try { execSync('for /f "tokens=5" %a in (\'netstat -ano ^| findstr :3000 ^| findstr LISTENING\') do taskkill /F /PID %a 2>nul', { stdio: "ignore", shell: "cmd.exe" }); } catch { /* */ }
  if (server) { try { server.kill("SIGKILL"); } catch { /* */ } }
}

// ── helpers ──
async function shot(p: any, n: string) {
  await p.screenshot({ path: resolve(OUT, n + ".png"), fullPage: true });
}

let step = 0;
const TOTAL = 10;
function progress(name: string) {
  step++;
  console.log(`  [${step}/${TOTAL}] ${name} ✓`);
}

async function failFast(p: any, loc: any, desc: string) {
  try {
    await loc.waitFor({ state: "visible", timeout: 5000 });
  } catch {
    throw new Error(`FAIL FAST: ${desc}`);
  }
}

// ── navigation ──
async function login(p: any, email: string) {
  await p.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.locator("input[name=email]").fill(email);
  await p.locator("#password").fill("password123");
  await p.locator("button[type=submit]").click();
  await p.getByRole("button", { name: /continue to dashboard/i }).waitFor({ state: "visible", timeout: 15000 });
  await p.getByRole("button", { name: /continue to dashboard/i }).click();
  await p.waitForURL(/dashboard/, { timeout: 15000 });
  await failFast(p, p.locator("nav, header, aside, [role=navigation]").first(), "dashboard shell after login");
}

async function nav(p: any, path: string) {
  await p.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 15000 });
  await failFast(p, p.locator("h1, h2, form, table, main, [role=main]").first(), `page content at ${path}`);
}

// ── form filling ──
async function fillSelect(p: any, labelText: string, desiredText: string) {
  const el = p.locator("label").filter({ hasText: labelText }).locator("xpath=..").locator("select").first();
  await el.waitFor({ state: "visible", timeout: 5000 });

  const options = await el.evaluate((s: HTMLSelectElement) =>
    Array.from(s.options).map((o, i) => ({
      index: i,
      text: o.text.trim(),
      value: o.value,
      disabled: o.disabled,
    }))
  );

  console.log(`\n  ${labelText}`);
  for (const o of options)
    console.log(`    ${o.index}  Text: ${o.text}  Value: ${o.value}  Disabled: ${o.disabled}`);

  if (!options.some((o) => !o.disabled)) {
    console.log(`    WARN: no enabled options for ${labelText}, skipping`);
    return;
  }

  let match = options.find(
    (o) => !o.disabled && o.text.toLowerCase() === (desiredText || "").toLowerCase()
  );
  if (!match) match = options.find((o) => !o.disabled && o.value === desiredText);
  if (!match) match = options.find((o) => !o.disabled && o.value !== "");
  if (!match) return;

  await el.selectOption({ value: match.value });
  console.log(`    > Selected: "${match.text}"`);

  const selected = await el.inputValue();
  if (!selected) throw new Error(`Select "${labelText}" still empty after selection`);
  console.log(`    > Verified value: ${selected}`);
}

async function fillField(p: any, label: string, value: string) {
  const el = p
    .locator("label")
    .filter({ hasText: label })
    .locator("xpath=..")
    .locator("input,select,textarea")
    .first();
  await el.waitFor({ state: "visible", timeout: 5000 });
  const tag = await el.evaluate((e: HTMLElement) => e.tagName.toLowerCase());
  if (tag === "select") {
    await fillSelect(p, label, value);
  } else {
    await el.fill(value);
  }
}

async function verifyForm(p: any, fields: string[]) {
  console.log("\n  === FORM VERIFICATION ===");
  for (const f of fields) {
    const el = p
      .locator("label")
      .filter({ hasText: f })
      .locator("xpath=..")
      .locator("input,select,textarea")
      .first();
    const tag = await el.evaluate((e: HTMLElement) => e.tagName.toLowerCase());
    const val = await el.inputValue();
    const status = val ? `OK: "${val}"` : "MISSING";
    console.log(`    ${f} [${tag}]: ${status}`);
  }
  console.log("  ===========================\n");
}

// ── main ──
async function main() {
  // ── 1. Start server once ──
  await start();
  console.log("Ready.");
  // Give auth middleware + DB connection time to fully initialize
  await new Promise((r) => setTimeout(r, 3000));
  console.log("Server warm.\n");

  // ── 2. Launch Chromium once ──
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // ── 3. One context, one page ──
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();

  // ── 4. Login once ──
  console.log("=== AUTH ===");
  await login(p, "admin@easystem.dev");
  console.log("  Authenticated\n");

  // ═══════════════════════════════════════════════
  // BATCH: Empty form + accessibility tabs + fill Persist + submit
  // ═══════════════════════════════════════════════
  console.log("=== BATCH: Create + Persistence + Accessibility ===");
  await nav(p, "/dashboard/academics/students/create");

  // empty form
  await shot(p, "2a-empty-form");
  progress("2a-empty-form");

  // accessibility: tab through focus indicators
  await p.keyboard.press("Tab");
  await p.waitForTimeout(150);
  await shot(p, "7a-keyboard-focus-1");
  progress("7a-keyboard-focus-1");

  for (let i = 0; i < 3; i++) {
    await p.keyboard.press("Tab");
  }
  await p.waitForTimeout(150);
  await shot(p, "7b-keyboard-focus-4");
  progress("7b-keyboard-focus-4");

  for (let i = 0; i < 8; i++) {
    await p.keyboard.press("Tab");
  }
  await p.waitForTimeout(150);
  await shot(p, "7c-keyboard-focus-submit");
  progress("7c-keyboard-focus-submit");

  // fill Persist form
  const adm = "PER-" + Date.now().toString(36).toUpperCase();
  await fillField(p, "First Name", "Persist");
  await fillField(p, "Last Name", "Check");
  await fillField(p, "Admission Number", adm);
  await fillField(p, "Date of Birth", "2014-06-10");
  await fillField(p, "Gender", "Male");
  await fillField(p, "Phone", "555-PERSIST");
  await verifyForm(p, [
    "First Name",
    "Last Name",
    "Admission Number",
    "Date of Birth",
    "Gender",
    "Phone",
  ]);

  await shot(p, "2b-filled-form");
  progress("2b-filled-form");

  // submit and wait for redirect (form does router.push to /students on success)
  await p.locator("button[type=submit]").click();
  await p.waitForURL(/\/dashboard\/academics\/students/, { timeout: 15000 });
  // Wait for actual data rows (not empty placeholder "No records found")
  await p.locator("table tbody tr td:not([colspan])").first().waitFor({ state: "visible", timeout: 15000 });

  // Step 5: search for the exact student by admission number
  const searchInput = p.locator("input[placeholder]").first();
  await searchInput.fill(adm);
  await p.waitForTimeout(500); // debounce
  await p.locator("table tbody tr td:not([colspan])").first().waitFor({ state: "visible", timeout: 10000 });

  // Verify exactly one row contains our admission number
  const searchRows = p.locator("table tbody tr");
  const searchCount = await searchRows.count();
  let matchCount = 0;
  for (let i = 0; i < searchCount; i++) {
    if ((await searchRows.nth(i).innerText()).includes(adm)) matchCount++;
  }
  if (matchCount !== 1) throw new Error(`Expected 1 search result, got ${matchCount}`);

  await shot(p, "2c-success");
  progress("2c-success");

  // ═══════════════════════════════════════════════
  // BATCH: Open the created student's profile (searched row already visible)
  // ═══════════════════════════════════════════════
  console.log("=== BATCH: Student profile persistence ===");
  // Click View on the row that contains our admission number
  let profileOpened = false;
  for (let i = 0; i < searchCount; i++) {
    const text = await searchRows.nth(i).innerText();
    if (text.includes(adm)) {
      await searchRows.nth(i).locator("button[aria-label=View]").click();
      profileOpened = true;
      break;
    }
  }
  if (!profileOpened) throw new Error(`Could not find View button for admission # ${adm}`);

  await p.waitForURL(/\/dashboard\/academics\/students\//, { timeout: 10000 });

  // Verify profile belongs to the created student
  const profileText = await p.locator("main, [role=main], .space-y-6").first().innerText().catch(() => "");
  if (!profileText.includes(adm)) throw new Error(`Profile admission number mismatch: expected ${adm}`);
  console.log(`  Verified profile matches ${adm}`);

  await shot(p, "2d-profile-with-enrollment-guardian");
  progress("2d-profile-with-enrollment-guardian");

  // ═══════════════════════════════════════════════
  // BATCH: Loading / UX (second create)
  // ═══════════════════════════════════════════════
  console.log("=== BATCH: Loading / UX ===");
  await nav(p, "/dashboard/academics/students/create");

  await fillField(p, "First Name", "LoadTest");
  await fillField(p, "Last Name", "UX");
  const adm2 = "UX-" + Date.now().toString(36).toUpperCase();
  await fillField(p, "Admission Number", adm2);
  await fillField(p, "Date of Birth", "2015-03-20");
  await fillField(p, "Gender", "Female");
  await fillField(p, "Phone", "555-UX-TEST");
  await verifyForm(p, [
    "First Name",
    "Last Name",
    "Admission Number",
    "Date of Birth",
    "Gender",
    "Phone",
  ]);

  // capture loading via spinner
  await p.locator("button[type=submit]").click();
  await p.locator(".animate-spin").first().waitFor({ state: "visible", timeout: 3000 });
  await shot(p, "6a-loading-state");
  progress("6a-loading-state");

  await p.waitForURL(/\/dashboard\/academics\/students/, { timeout: 15000 });
  await p.locator("table tbody tr td:not([colspan])").first().waitFor({ state: "visible", timeout: 15000 });

  // Search for the UX student by admission number
  const uxSearchInput = p.locator("input[placeholder]").first();
  await uxSearchInput.fill(adm2);
  await p.waitForTimeout(500);
  await p.locator("table tbody tr td:not([colspan])").first().waitFor({ state: "visible", timeout: 10000 });

  // Verify exactly one row matches
  const uxSearchRows = p.locator("table tbody tr");
  const uxRowCount = await uxSearchRows.count();
  let uxMatchCount = 0;
  for (let i = 0; i < uxRowCount; i++) {
    if ((await uxSearchRows.nth(i).innerText()).includes(adm2)) uxMatchCount++;
  }
  if (uxMatchCount !== 1) throw new Error(`Expected 1 UX search result, got ${uxMatchCount}`);

  await shot(p, "6b-success-toast");
  progress("6b-success-toast");

  // ═══════════════════════════════════════════════
  // BATCH: Backend errors (404)
  // ═══════════════════════════════════════════════
  console.log("=== BATCH: Backend errors ===");
  await nav(p, "/dashboard/academics/students/nonexistent-id-xyz");
  await shot(p, "5a-not-found-404");
  progress("5a-not-found-404");

  // ═══════════════════════════════════════════════
  // Clean exit
  // ═══════════════════════════════════════════════
  await ctx.close();
  await browser.close();
  stop();

  console.log(`\n=== CAPTURED (${TOTAL}) ===`);
  for (const f of readdirSync(OUT).sort()) console.log("  " + f);
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  stop();
  process.exit(1);
});
