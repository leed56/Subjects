#!/usr/bin/env node
/* Anonymous, localStorage-only HVAC theme check. Never authenticates or writes to Supabase. */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = (process.env.LAKBIZ_PREVIEW_URL ?? "http://localhost:3011").replace(/\/$/, "");
const outputDir = process.env.LAKBIZ_UI_QA_DIR ?? "./.qa-hvac";
const paths = ["/dashboard", "/jobs", "/assets", "/schedule", "/workforce", "/stock", "/sales", "/customers", "/bills", "/suppliers", "/job-costing", "/reports", "/vat"];
const widths = [1280, 390];
const browser = await chromium.launch({ headless: true });
const failures = [];

await mkdir(outputDir, { recursive: true });
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem("lakbiz-locale", "en");
    });
    const entry = await context.newPage();
    await entry.goto(`${baseUrl}/demo/hvac`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await entry.waitForURL("**/dashboard", { timeout: 30_000 });
    await entry.close();
    for (const path of paths) {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.locator(".hvac-workspace main h1").waitFor({ state: "visible", timeout: 25_000 });
        await page.waitForTimeout(500);
        const result = await page.evaluate(() => ({
          sector: document.querySelector(".hvac-workspace") !== null,
          scrollWidth: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
          heading: document.querySelector("main h1")?.textContent?.trim() ?? "",
          header: document.querySelector('main [data-ui="page-header"], main [data-ui="pro-page-header"]') !== null,
          metricCount: document.querySelectorAll('main [data-ui="metric-card"], main [data-ui="pro-stat-card"]').length,
          loading: document.querySelector("main")?.textContent?.includes("Loading...") ?? false,
          darkCards: [...document.querySelectorAll('main [data-ui="metric-card"], main [data-ui="pro-stat-card"], main [data-ui="stock-command-header"]')].filter((element) => {
            const style = getComputedStyle(element);
            const colors = `${style.backgroundImage} ${style.backgroundColor}`.match(/rgba?\([^)]*\)/g) ?? [];
            const opaque = colors.map((color) => color.match(/[\d.]+/g)?.map(Number) ?? []).filter((channels) => channels.length >= 3 && (channels.length < 4 || channels[3] > 0.5));
            return opaque.length > 0 && opaque.every(([red, green, blue]) => (red + green + blue) / 3 < 75);
          }).length,
        }));
        await page.screenshot({ path: `${outputDir}/${path.slice(1)}-${width}.png`, fullPage: true });
        if (!result.sector || !result.heading || result.scrollWidth > result.viewport + 2 || result.darkCards > 0 || errors.length) {
          failures.push({ path, width, result, errors });
        }
        console.log(JSON.stringify({ path, width, ...result, errors }));
      } catch (error) {
        failures.push({ path, width, error: String(error) });
      } finally {
        await page.close();
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exitCode = 1;
}
