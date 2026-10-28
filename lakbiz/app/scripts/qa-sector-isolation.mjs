import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = (process.env.LAKBIZ_PREVIEW_URL ?? "http://localhost:3010").replace(/\/$/, "");
const output = process.env.LAKBIZ_UI_QA_DIR ?? ".qa-sector-isolation";
const expectedBuildSha = process.env.LAKBIZ_EXPECTED_BUILD_SHA?.trim();
const sectors = ["grocery", "pharmacy", "electronics", "mobile_shop", "electricals", "spare_parts", "footwear", "textile", "ac_hvac", "car_sales"];
const browser = await chromium.launch({ headless: true });
const failures = [];
const cases = [];
await mkdir(output, { recursive: true });
try {
  if (expectedBuildSha) {
    const preflight = await browser.newPage();
    let found = "";
    for (let attempt = 0; attempt < 36; attempt += 1) {
      await preflight.goto(`${base}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      found = await preflight.locator("body").getAttribute("data-lakbiz-build-sha") ?? "";
      if (found === expectedBuildSha) break;
      console.log(JSON.stringify({ waitingForCommit: expectedBuildSha, found }));
      await preflight.waitForTimeout(10_000);
    }
    await preflight.close();
    if (found !== expectedBuildSha) throw new Error(`Expected preview commit ${expectedBuildSha}, found ${found}`);
  }
  for (const sector of sectors) {
    for (const locale of sector === "grocery" || sector === "ac_hvac" ? ["en", "si", "ta"] : ["en"]) {
    for (const width of [1280, 390]) {
      // Keep these network assertions outside the PWA cache and its first-install
      // controller reload. Service-worker/offline journeys are a separate gate.
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      await context.addInitScript(({ sector, locale }) => {
        localStorage.setItem("lakbiz-org-demo", JSON.stringify({ id: null, name: `${sector} QA demo`, sector, role: "owner", isAuthenticated: false }));
        localStorage.setItem("lakbiz-subscription-demo", JSON.stringify({ planId: "pro", status: "active", billingCycle: "monthly", trialEndsAt: null, currentPeriodEnd: null, addons: [], isDemo: true }));
        localStorage.setItem("lakbiz-locale", locale);
        // Old global preferences/history must never be adopted into another shop.
        localStorage.setItem("lakbiz-notification-settings-v1", JSON.stringify({ autoSendServiceDueSms: true, technicianPhone: "0770000000" }));
        localStorage.setItem("lakbiz-notification-log-v1", JSON.stringify([{ id: "legacy", messageBody: "LEGACY AC PRIVATE MESSAGE" }]));
        localStorage.setItem("lakbiz-shop-settings-v1", JSON.stringify({ name: "LEGACY PRIVATE AC SHOP", logoDataUrl: "old-logo" }));
        localStorage.setItem("lakbiz-app-data-v2", JSON.stringify({ business: { name: "LEGACY PRIVATE AC SHOP" }, products: [{ id: "legacy-ac-unit", name: "LEGACY AC UNIT", sector: "ac_hvac", stockQty: 1, active: true }] }));
      }, { sector, locale });
      await context.route("**/api/messages/status", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: true, whatsappConfigured: true }) }));
      await context.route("**/*", (route) => ["POST", "PUT", "PATCH", "DELETE"].includes(route.request().method()) ? route.abort("blockedbyclient") : route.fallback());
      const page = await context.newPage();
      const errors = [];
      const mutations = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) mutations.push(request.url());
      });
      try {
        await page.goto(`${base}/settings/notifications`, { waitUntil: "domcontentloaded" });
        await page.locator("main h1").waitFor({ timeout: 25_000 });
        await page.getByText(`${sector} QA demo`, { exact: true }).first().waitFor({ state: "attached", timeout: 25_000 });
        await page.waitForFunction((expected) => {
          const panel = document.querySelector('[data-ui="ac-service-notification-settings"]');
          return Boolean(panel) === expected;
        }, sector === "ac_hvac");
        const result = await page.evaluate(() => ({
          acControls: document.querySelector('[data-ui="ac-service-notification-settings"]') !== null,
          legacyMessage: document.body.textContent.includes("LEGACY AC PRIVATE MESSAGE"),
          acText: /AC service|AC job|Technician phone|Send due reminders now|from Jobs|on Jobs/.test(document.querySelector("main")?.textContent ?? ""),
          serviceNav: document.querySelector('a[href="/jobs"]') !== null,
          jobNavLabel: document.querySelector('aside a[href="/jobs"]')?.textContent?.trim() ?? "",
          vehicleNav: document.querySelector('a[href="/vehicles"]') !== null,
          clippedSettingsTabs: Array.from(document.querySelectorAll('nav[aria-label="Settings"] a')).some((link) => {
            const rect = link.getBoundingClientRect();
            return rect.left < 0 || rect.right > innerWidth || link.scrollWidth > link.clientWidth + 2;
          }),
          scrollWidth: document.documentElement.scrollWidth,
          width: innerWidth,
          build: document.body.dataset.lakbizBuildSha,
        }));
        if (expectedBuildSha && result.build !== expectedBuildSha) throw new Error(`Preview changed during QA: expected ${expectedBuildSha}, found ${result.build}`);
        if (sector === "ac_hvac" && locale === "si" && !result.jobNavLabel.includes("AC වැඩ")) throw new Error("Sinhala HVAC navigation must use the owner's approved term AC වැඩ");
        await page.screenshot({ path: `${output}/${sector}-messages-${width}-${locale}.png`, fullPage: true });
        if (result.acControls !== (sector === "ac_hvac") || result.serviceNav !== (sector === "ac_hvac") || result.vehicleNav !== (sector === "car_sales") || (sector !== "ac_hvac" && result.acText) || result.legacyMessage || result.clippedSettingsTabs || result.scrollWidth > width + 2 || errors.length || mutations.length) failures.push({ sector, locale, width, result, errors, mutations });
        await page.goto(`${base}/settings/shop`, { waitUntil: "domcontentloaded" });
        await page.locator('input[name="name"]:visible').waitFor();
        await page.waitForFunction((expected) => Array.from(document.querySelectorAll('input[name="name"]')).some((input) => input.getClientRects().length > 0 && input.value === `${expected} QA demo`), sector);
        const legacyRetained = await page.evaluate(() => localStorage.getItem("lakbiz-app-data-v2")?.includes("LEGACY PRIVATE AC SHOP"));
        if (!legacyRetained) failures.push({ sector, locale, width, error: "Legacy data was not retained" });
        if (sector === "ac_hvac" && locale === "si") {
          await page.goto(`${base}/jobs`, { waitUntil: "domcontentloaded" });
          await page.getByRole("heading", { level: 1, name: "AC වැඩ", exact: true }).waitFor();
          await page.screenshot({ path: `${output}/hvac-jobs-${width}-si.png`, fullPage: true });
        }
        const wrongPath = sector === "ac_hvac" ? "/vehicles" : "/jobs";
        await page.goto(`${base}${wrongPath}`, { waitUntil: "domcontentloaded" });
        await page.locator('[data-ui="workspace-route-blocked"]').waitFor({ timeout: 25_000 });
        if (mutations.length || errors.length) failures.push({ sector, locale, width, mutations, errors });
        const checked = { sector, locale, width, ...result, directLinkBlocked: true, shopIdentityIsolated: true };
        cases.push(checked);
        console.log(JSON.stringify(checked));
      } catch (error) { failures.push({ sector, locale, width, error: String(error) }); }
      await context.close();
    }
    }
  }
} finally { await browser.close(); }
await writeFile(`${output}/report.json`, JSON.stringify({ base, expectedBuildSha, checkedAt: new Date().toISOString(), cases, failures }, null, 2));
console.log(JSON.stringify({ checked: cases.length, failed: failures.length }));
if (failures.length) { console.error(JSON.stringify({ failures }, null, 2)); process.exitCode = 1; }
