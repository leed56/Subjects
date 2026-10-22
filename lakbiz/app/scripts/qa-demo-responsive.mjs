#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const playwrightRoot = process.env.LAKBIZ_QA_PLAYWRIGHT;
const require = createRequire(playwrightRoot ? path.join(playwrightRoot, "package.json") : import.meta.url);
const { chromium } = require("playwright");
const previewUrl = (process.env.LAKBIZ_PREVIEW_URL ?? "http://127.0.0.1:3011").replace(/\/$/, "");
const output = process.env.LAKBIZ_UI_QA_DIR ?? path.join(process.cwd(), ".qa-demo-responsive");
const allIndustries = [
  "grocery", "pharmacy", "cosmetics", "electronics", "mobile_shop", "electricals", "spare_parts",
  "footwear", "textile", "ac_hvac", "car_sales", "hardware", "stationery", "wholesale",
];
const industries = process.env.LAKBIZ_QA_INDUSTRIES?.split(",").filter(Boolean) ?? allIndustries;
const widths = process.env.LAKBIZ_QA_WIDTHS?.split(",").map(Number).filter(Number.isFinite) ?? [360, 390, 768, 1440];
const failures = [];
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.LAKBIZ_CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});

try {
  for (const industry of industries) {
    const context = await browser.newContext();
    for (const width of widths) {
      const page = await context.newPage();
      await page.setViewportSize({ width, height: 900 });
      process.stdout.write(`Checking ${industry} at ${width}px ... `);
      try {
        await page.goto(`${previewUrl}/demo/${industry}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        const enter = page.getByRole("button", { name: "Enter with the sample account →" });
        const topbar = page.locator(".demo-topbar");
        await Promise.race([
          enter.waitFor({ state: "visible", timeout: 20_000 }),
          topbar.waitFor({ state: "visible", timeout: 20_000 }),
        ]);
        if (await enter.isVisible()) await enter.click();
        await page.locator(".demo-topbar").waitFor({ state: "visible", timeout: 20_000 });

        const shell = await page.evaluate(() => {
          const html = document.documentElement;
          const sidebar = document.querySelector(".demo-sidebar");
          const canvas = document.querySelector(".demo-canvas");
          const topbar = document.querySelector(".demo-topbar");
          const identity = document.querySelector(".demo-mobile-identity");
          const menuButton = document.querySelector(".demo-menu-button");
          return {
            innerWidth,
            scrollWidth: html.scrollWidth,
            sidebarPosition: getComputedStyle(sidebar).position,
            sidebarVisibility: getComputedStyle(sidebar).visibility,
            canvasWidth: canvas.getBoundingClientRect().width,
            topbarRight: topbar.getBoundingClientRect().right,
            identityDisplay: getComputedStyle(identity).display,
            menuDisplay: getComputedStyle(menuButton).display,
          };
        });

        assert(shell.scrollWidth <= shell.innerWidth + 1, `page overflow ${shell.scrollWidth}/${shell.innerWidth}`);
        assert(shell.topbarRight <= shell.innerWidth + 1, "topbar exceeds viewport");
        if (width <= 800) {
          assert(shell.sidebarPosition === "fixed", "mobile sidebar is not off-canvas");
          assert(shell.canvasWidth >= shell.innerWidth - 20, `mobile canvas collapsed to ${shell.canvasWidth}px`);
          assert(shell.menuDisplay !== "none", "mobile menu trigger missing");
          if (width <= 540) assert(shell.identityDisplay === "flex", "mobile tenant identity missing");

          await page.locator(".demo-menu-button").click();
          await page.locator(".demo-sidebar-open").waitFor({ state: "visible" });
          await page.waitForTimeout(250);
          const drawer = await page.locator(".demo-sidebar").evaluate((node) => {
            const rect = node.getBoundingClientRect();
            return { left: rect.left, right: rect.right, width: rect.width };
          });
          assert(drawer.left >= -1 && drawer.right <= width + 1, "drawer is outside the phone viewport");
          assert(drawer.width <= width * 0.9, "drawer leaves too little context visible");
          await page.locator(".demo-sidebar-close").click();
        } else {
          assert(shell.sidebarPosition === "sticky", "desktop sidebar lost sticky positioning");
          assert(shell.menuDisplay === "none", "mobile menu leaked into desktop");
        }

        await page.goto(`${previewUrl}/demo/${industry}/inventory`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.locator("#demo-content").waitFor({ state: "visible", timeout: 20_000 });
        const inventoryWidth = await page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }));
        assert(inventoryWidth.scrollWidth <= inventoryWidth.innerWidth + 1, `inventory overflow ${inventoryWidth.scrollWidth}/${inventoryWidth.innerWidth}`);

        results.push({ industry, width, status: "passed" });
        if (industry === "textile") await page.screenshot({ path: path.join(output, `textile-${width}.png`), fullPage: true });
        console.log("passed");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ industry, width, message });
        results.push({ industry, width, status: "failed", message });
        console.log("failed");
      } finally {
        await page.close();
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(results, null, 2));
}

if (failures.length) throw new Error(`${failures.length} responsive demo failures:\n${failures.map((x) => `${x.industry}/${x.width}: ${x.message}`).join("\n")}`);
console.log(`Passed ${results.length} responsive demo scenarios: ${industries.length} industries × ${widths.length} viewports.`);
