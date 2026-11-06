import { chromium } from "playwright";
import { mkdir, copyFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const artifactOut = "/opt/cursor/artifacts/gates";
const repoOut = join(root, "gates");
const base = process.env.EXO_SCREEN_BASE || "http://127.0.0.1:8765";

await mkdir(artifactOut, { recursive: true });
await mkdir(repoOut, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

async function waitRoleStatus(page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-exo-role-status]");
      return el && !el.hidden && /rehearsal|visitor/i.test(el.textContent || "");
    },
    { timeout: 15000 },
  );
}

async function shot(name, url, w, h, fullPage = true) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url, { waitUntil: "networkidle" });
  const artifactPath = join(artifactOut, name);
  await page.screenshot({ path: artifactPath, fullPage });
  await copyFile(artifactPath, join(repoOut, name));
}

await shot("rift-overview-1440.png", `${base}/projects/rift-manager/`, 1440, 900);
await shot("rift-overview-390.png", `${base}/projects/rift-manager/`, 390, 844);

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/projects/rift-manager/`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  try {
    localStorage.removeItem("exoframe-participation:rift-manager");
  } catch (_) {}
});
await page.reload({ waitUntil: "networkidle" });
const roleForm = page.locator("[data-exo-role-form]");
if (await roleForm.count()) {
  await page.locator("[data-exo-role-form]").scrollIntoViewIfNeeded();
  await page.locator("[data-exo-role-form] button[type='submit']").click();
  await waitRoleStatus(page);
  await page.screenshot({
    path: join(artifactOut, "rift-role-interest-rehearsal-390.png"),
    fullPage: true,
  });
  await copyFile(
    join(artifactOut, "rift-role-interest-rehearsal-390.png"),
    join(repoOut, "rift-role-interest-rehearsal-390.png"),
  );
  await page.reload({ waitUntil: "networkidle" });
  await waitRoleStatus(page);
  await page.screenshot({
    path: join(artifactOut, "rift-role-interest-reload-390.png"),
    fullPage: false,
  });
  await copyFile(
    join(artifactOut, "rift-role-interest-reload-390.png"),
    join(repoOut, "rift-role-interest-reload-390.png"),
  );
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/projects/rift-manager/#decision`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  try {
    localStorage.removeItem("exoframe-participation:rift-manager");
  } catch (_) {}
});
await page.reload({ waitUntil: "networkidle" });
const approve = page.locator("#approve");
if (await approve.count()) {
  await approve.click();
  await page.waitForSelector("#sigline.signed, .pill.signed", { timeout: 15000 });
  await page.screenshot({
    path: join(artifactOut, "rift-decision-approved-rehearsal-390.png"),
    fullPage: false,
  });
  await copyFile(
    join(artifactOut, "rift-decision-approved-rehearsal-390.png"),
    join(repoOut, "rift-decision-approved-rehearsal-390.png"),
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".pill.signed", { timeout: 8000 });
  await page.waitForSelector("#revoke", { timeout: 8000 });
  await page.locator("#decision").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(artifactOut, "rift-decision-approved-reload-390.png"),
    fullPage: false,
  });
  await copyFile(
    join(artifactOut, "rift-decision-approved-reload-390.png"),
    join(repoOut, "rift-decision-approved-reload-390.png"),
  );
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/projects/rift-manager/`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.removeItem("exoframe-participation:rift-manager"));
await page.reload({ waitUntil: "networkidle" });
await page.locator("[data-exo-role-form] button[type='submit']").click();
await waitRoleStatus(page);
await page.goto(`${base}/projects/rift-manager/#decision`, { waitUntil: "networkidle" });
await page.locator("#approve").click();
await page.waitForSelector("#sigline.signed", { timeout: 15000 });
await page.screenshot({
  path: join(artifactOut, "rift-rehearsal-before-reset-390.png"),
  fullPage: true,
});
await copyFile(
  join(artifactOut, "rift-rehearsal-before-reset-390.png"),
  join(repoOut, "rift-rehearsal-before-reset-390.png"),
);
await page.locator("#demoReset").click();
await page.waitForLoadState("networkidle");
await page.waitForFunction(
  () => {
    const el = document.querySelector("[data-exo-role-status]");
    const signed = document.querySelector("#sigline.signed");
    return (!el || el.hidden) && !signed;
  },
  { timeout: 15000 },
);
await page.screenshot({
  path: join(artifactOut, "rift-rehearsal-after-reset-390.png"),
  fullPage: true,
});
await copyFile(
  join(artifactOut, "rift-rehearsal-after-reset-390.png"),
  join(repoOut, "rift-rehearsal-after-reset-390.png"),
);

await shot("rift-lattice-1440.png", `${base}/projects/rift-manager/#demo-start`, 1440, 900);
await shot("submit-form-390.png", `${base}/submit.html`, 390, 844);

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/submit.html`, { waitUntil: "networkidle" });
await page.fill("#title", "Gate verify idea");
await page.fill("#what", "Short description for fail-closed screenshot.");
await page.click("#submitBtn");
await page.waitForSelector("#sum:not([hidden])", { timeout: 5000 });
await page.screenshot({ path: join(artifactOut, "submit-not-saved-390.png"), fullPage: true });
await copyFile(
  join(artifactOut, "submit-not-saved-390.png"),
  join(repoOut, "submit-not-saved-390.png"),
);

await browser.close();
console.log("Saved screenshots to", artifactOut, "and", repoOut);
