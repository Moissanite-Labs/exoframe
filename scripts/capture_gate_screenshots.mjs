import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = "/opt/cursor/artifacts/gates";
const base = process.env.EXO_SCREEN_BASE || "http://127.0.0.1:8765";

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();

async function shot(name, url, w, h, fullPage = true) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.screenshot({ path: join(out, name), fullPage });
}

await shot("rift-overview-1440.png", `${base}/projects/rift-manager/`, 1440, 900);
await shot("rift-overview-390.png", `${base}/projects/rift-manager/`, 390, 844);
await shot("rift-lattice-1440.png", `${base}/projects/rift-manager/#demo-start`, 1440, 900);
await shot("submit-form-390.png", `${base}/submit.html`, 390, 844);

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/submit.html`, { waitUntil: "networkidle" });
await page.fill("#title", "Gate verify idea");
await page.fill("#what", "Short description for fail-closed screenshot.");
await page.click("#submitBtn");
await page.waitForSelector("#sum:not([hidden])", { timeout: 5000 });
await page.screenshot({ path: join(out, "submit-not-saved-390.png"), fullPage: true });

await browser.close();
console.log("Saved screenshots to", out);
