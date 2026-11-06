#!/usr/bin/env node
/**
 * Browser rehearsal tests for Reset demo + restored Revoke control.
 * Requires static site at EXO_SCREEN_BASE (default http://127.0.0.1:8765).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "playwright";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const base = process.env.EXO_SCREEN_BASE || "http://127.0.0.1:8765";
const slug = "rift-manager";
const storeKey = `exoframe-participation:${slug}`;

test("source: reset clears rehearsal before reload", () => {
  const src = readFileSync(join(root, "assets/crystal-lattice.js"), "utf8");
  assert.match(src, /clearRehearsalParticipation/);
  assert.doesNotMatch(src, /reset\.addEventListener\("click", \(\) => location\.reload\(\)\)/);
});

test("source: approved restore includes revoke button", () => {
  const src = readFileSync(join(root, "assets/crystal-lattice.js"), "utf8");
  const idx = src.indexOf("function reflectPersistedDecisionUI");
  assert.ok(idx >= 0);
  const block = src.slice(idx, idx + 2800);
  assert.match(block, /id="revoke"/);
});

test("browser: reset clears local rehearsal after reload", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${base}/projects/${slug}/`, { waitUntil: "networkidle" });
  await page.evaluate((key) => localStorage.removeItem(key), storeKey);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-exo-role-form] button[type='submit']").click();
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-exo-role-status]");
      return el && !el.hidden && /rehearsal/i.test(el.textContent || "");
    },
    { timeout: 15000 },
  );
  assert.ok(await page.evaluate((key) => localStorage.getItem(key), storeKey));
  await page.locator("#demoReset").click();
  await page.waitForLoadState("networkidle");
  const after = await page.evaluate((key) => {
    const el = document.querySelector("[data-exo-role-status]");
    return {
      ls: localStorage.getItem(key),
      statusHidden: el ? el.hidden : true,
      statusText: el ? el.textContent : "",
      signed: !!document.querySelector("#sigline.signed"),
    };
  }, storeKey);
  assert.equal(after.ls, null);
  assert.equal(after.statusHidden, true);
  assert.equal(after.signed, false);
  await browser.close();
});

test("browser: reload after approve shows revoke control", async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${base}/projects/${slug}/#decision`, { waitUntil: "networkidle" });
  await page.evaluate((key) => localStorage.removeItem(key), storeKey);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#approve").click();
  await page.waitForSelector("#sigline.signed", { timeout: 15000 });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".pill.signed", { timeout: 8000 });
  assert.ok(await page.locator("#revoke").count());
  const saved = await page.locator("#sigdate").textContent();
  assert.match(saved || "", /rehearsal|visitor/i);
  await browser.close();
});
