import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

// Browser fixtures only: all Supabase traffic is intercepted. This verifies
// rendering/request behavior, not an authenticated staging-shop journey.
const base = process.env.LAKBIZ_PREVIEW_URL ?? "http://localhost:3013";
const output = process.env.LAKBIZ_UI_QA_DIR ?? ".qa-sector-isolation/catalogues";
const orgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const expectedSha = process.env.LAKBIZ_EXPECTED_BUILD_SHA;
const labels = {
  en: { titles: ["Sri Lankan grinding-mill range", "Poultry & processed meat range"], pending: "Catalogue setup pending", adding: "Adding products…", confirm: "Add templates" },
  si: { titles: ["ශ්‍රී ලාංකික ඇඹරුම්හල් භාණ්ඩ", "කුකුල් මස් සහ මස් නිෂ්පාදන"], pending: "භාණ්ඩ ලැයිස්තුව සැකසීම බලාපොරොත්තුවෙන්", adding: "භාණ්ඩ එක් කරමින්…", confirm: "භාණ්ඩ එක් කරන්න" },
  ta: { titles: ["இலங்கை அரவை ஆலைப் பொருட்கள்", "கோழி இறைச்சி மற்றும் இறைச்சிப் பொருட்கள்"], pending: "பொருட்பட்டியல் அமைப்பு நிலுவையில் உள்ளது", adding: "பொருட்களைச் சேர்க்கிறது…", confirm: "பொருட்களைச் சேர்" },
};
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const locale of ["en", "si", "ta"]) {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      await context.addInitScript(({ orgId, locale }) => {
        localStorage.setItem("lakbiz-org-demo", JSON.stringify({ id: orgId, name: "Catalogue UI fixture", sector: "grocery", role: "owner", isAuthenticated: true }));
        localStorage.setItem("lakbiz-subscription-demo", JSON.stringify({ planId: "pro", status: "active", billingCycle: "monthly", addons: [], isDemo: true }));
        localStorage.setItem("lakbiz-locale", locale);
      }, { orgId, locale });
      let mode = "missing";
      let readinessCalls = 0;
      let importCalls = 0;
      let finishImport;
      const heldImport = new Promise((resolve) => { finishImport = resolve; });
      await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.hostname.endsWith("supabase.co")) {
          if (url.pathname.endsWith("/rpc/grocery_catalogue_readiness")) {
            readinessCalls += 1;
            assert.equal(request.method(), "GET");
            return route.fulfill(mode === "missing"
              ? { status: 404, json: { code: "PGRST202", message: "Could not find function public.grocery_catalogue_readiness in schema cache" } }
              : { json: { mill: true, meat: true } });
          }
          if (/\/rpc\/import_grocery_(mill|meat)_catalogue$/.test(url.pathname)) {
            importCalls += 1;
            await heldImport;
            return route.fulfill({ status: 404, json: { code: "PGRST202", message: "Could not find function in schema cache" } });
          }
          return route.fulfill({ json: url.pathname.includes("rpc/") ? 0 : [] });
        }
        if (!["GET", "HEAD"].includes(request.method())) return route.abort("blockedbyclient");
        return route.continue();
      });
      const page = await context.newPage();
      await page.goto(`${base}/stock`, { waitUntil: "domcontentloaded" });
      const sections = page.locator("section[aria-label]").filter({ has: page.getByRole("button", { name: labels[locale].pending, exact: true }) });
      await sections.first().waitFor();
      assert.ok(readinessCalls > 0, "Use a preview built with Supabase configured; every database request is intercepted by this test");
      assert.equal(await sections.count(), 2);
      for (const button of await sections.getByRole("button").all()) assert.equal(await button.isDisabled(), true);
      assert.equal(importCalls, 0, "A readiness check must never import products");
      assert.equal(await page.locator("main").getByText(/Could not find|schema cache|public\.import_/).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true);
      if (expectedSha) assert.equal(await page.locator("body").getAttribute("data-lakbiz-build-sha"), expectedSha);
      await page.screenshot({ path: `${output}/pending-${locale}-${width}.png`, fullPage: true });
      mode = "ready";
      await page.reload({ waitUntil: "domcontentloaded" });
      const mill = page.getByRole("region", { name: labels[locale].titles[0], exact: true });
      const add = mill.getByRole("button");
      await add.waitFor();
      await page.waitForFunction((title) => document.querySelector(`section[aria-label="${title}"] button`)?.disabled === false, labels[locale].titles[0]);
      await add.click();
      await page.getByRole("dialog").getByRole("button", { name: labels[locale].confirm, exact: true }).click();
      await page.waitForFunction(() => Array.from(document.querySelectorAll('section[aria-label] button')).some((button) => button.disabled && /…/.test(button.textContent)));
      await page.waitForTimeout(350);
      assert.equal(await add.isDisabled(), true, "Import must remain disabled while its RPC is pending");
      assert.equal(importCalls, 1);
      finishImport();
      await mill.getByRole("button", { name: labels[locale].pending, exact: true }).waitFor();
      assert.equal(await mill.getByRole("button").isDisabled(), true);
      assert.equal(await page.locator("main").getByText(/Could not find|schema cache/).count(), 0);
      results.push({ locale, width, pendingDisabled: true, readinessImports: 0, pendingRequestImports: importCalls, rawErrorHidden: true, noOverflow: true });
      await context.close();
    }
  }
} finally { await browser.close(); }
await writeFile(`${output}/results.json`, JSON.stringify({ fixtureOnly: true, results }, null, 2));
console.log(JSON.stringify({ fixtureOnly: true, results }));
