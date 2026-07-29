import { chromium } from "playwright";
import { spawn } from "child_process";
import { resolve } from "path";

const BASE = "http://localhost:3000";
function start() { return new Promise((ok) => { const s = spawn("npx.cmd", ["next","dev"], { cwd: resolve("."), stdio: "pipe", shell: true }); s.stdout.on("data", (d) => { if (d.toString().includes("Ready in")) ok(); }); }); }

async function main() {
  await start();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await p.goto(BASE + "/login", { waitUntil: "networkidle" });
  await p.locator("input[name=email]").fill("admin@easystem.dev");
  await p.locator("#password").fill("password123");
  await p.locator("button[type=submit]").click();
  await p.locator("text=Continue to Dashboard").waitFor({ state: "visible", timeout: 15000 });
  await p.locator("text=Continue to Dashboard").click();
  await p.waitForURL(/dashboard/, { timeout: 15000 });

  await p.goto(BASE + "/dashboard/academics/students/create", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);

  // Inspect all selects
  const selects = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("select")).map(s => ({
      name: s.name,
      options: Array.from(s.options).map(o => ({ text: o.text, value: o.value, disabled: o.disabled })),
    }));
  });

  for (const s of selects) {
    console.log(`\n${s.name}:`);
    for (const o of s.options) {
      console.log(`  [${o.disabled ? "DISABLED" : "ENABLED"}] "${o.text}" value="${o.value}"`);
    }
  }

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
