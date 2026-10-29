import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.LAKBIZ_PREVIEW_URL ?? "http://localhost:3015";
const expectedSha = process.env.LAKBIZ_EXPECTED_BUILD_SHA;
const output = ".qa-sector-isolation/invoice-reference-ui";
const labels = {
  en: { remove: "Delete", product: "This product appears on completed bills. Mark it inactive instead of deleting it.", customer: "This customer is linked to completed bills. Keep the record and edit its details instead." },
  si: { remove: "මකන්න", product: "මෙම භාණ්ඩය සම්පූර්ණ කළ බිල්පත්වල ඇත. මකා දැමීම වෙනුවට එය අක්‍රිය කරන්න.", customer: "මෙම ගනුදෙනුකරු සම්පූර්ණ කළ බිල්පත්වලට සම්බන්ධයි. වාර්තාව තබා විස්තර සංස්කරණය කරන්න." },
  ta: { remove: "நீக்கு", product: "இந்தப் பொருள் முடிக்கப்பட்ட பில்களில் உள்ளது. நீக்குவதற்குப் பதிலாக செயலற்றதாக மாற்றவும்.", customer: "இந்த வாடிக்கையாளர் முடிக்கப்பட்ட பில்களுடன் இணைக்கப்பட்டுள்ளார். பதிவை வைத்திருந்து விவரங்களைத் திருத்தவும்." },
};
const browser = await chromium.launch({ headless: true });
const results = [];
await mkdir(output, { recursive: true });
try {
  for (const sector of ["grocery", "ac_hvac"]) for (const locale of ["en", "si", "ta"]) for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
    await context.addInitScript(({ sector, locale }) => {
      localStorage.setItem("lakbiz-org-demo", JSON.stringify({ id: null, name: "Invoice guard QA", sector, role: "owner", isAuthenticated: false }));
      localStorage.setItem("lakbiz-subscription-demo", JSON.stringify({ planId: "pro", status: "active", billingCycle: "monthly", addons: [], isDemo: true }));
      localStorage.setItem("lakbiz-locale", locale);
      localStorage.setItem(`lakbiz-app-data-v2-demo-${sector}`, JSON.stringify({
        business: { name: "Invoice guard QA", vatRegistered: false },
        products: [{ id: "qa-product", name: "QA Retained Product", sku: "QA-001", category: "QA", sectorId: sector, condition: "new", buyPrice: 180, sellPrice: 280, stockQty: 10, active: true, customFields: { unit: "pcs" } }],
        customers: [{ id: "qa-customer", name: "QA Retained Customer", contactType: "individual", creditBalance: 0 }],
        sales: [{ id: "qa-bill", billNo: "QA-001", date: "2026-10-28T10:00:00Z", lines: [{ productId: "qa-product", productName: "QA Retained Product", qty: 1, unitPrice: 280, buyPrice: 180 }], subtotal: 280, outputVat: 0, total: 280, profit: 100, paymentMethod: "cash", creditAmount: 0, customerId: "qa-customer", customerName: "QA Retained Customer" }],
      }));
    }, { sector, locale });
    const mutations = [];
    await context.route("**/*", (route) => {
      if (!["GET", "HEAD"].includes(route.request().method())) { mutations.push(route.request().url()); return route.abort("blockedbyclient"); }
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const [target, route] of [["product", "/stock"], ["customer", "/customers"]]) {
      await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
      if (target === "product") await page.getByRole("button", { name: "QA Retained Product", exact: true }).waitFor();
      else await page.getByRole("button", { name: /^QA Retained Customer/ }).first().waitFor();
      const actions = page.getByRole("button", { name: "Actions", exact: true }).last();
      await actions.focus(); await actions.press("Enter");
      await page.getByRole("menuitem", { name: labels[locale].remove, exact: true }).press("Enter");
      const confirm = page.getByRole("dialog").getByRole("button", { name: labels[locale].remove, exact: true });
      await confirm.focus(); await confirm.press("Enter");
      await page.getByText(labels[locale][target], { exact: true }).waitFor();
      const retained = await page.evaluate((sector) => {
        const data = JSON.parse(localStorage.getItem(`lakbiz-app-data-v2-demo-${sector}`));
        return data.products.length === 1 && data.customers.length === 1 && data.sales.length === 1;
      }, sector);
      assert.equal(retained, true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true);
      if (expectedSha) assert.equal(await page.locator("body").getAttribute("data-lakbiz-build-sha"), expectedSha);
      assert.deepEqual(errors, []);
      // Next dev's React stack-frame helper is an internal GET endpoint, not
      // an application mutation. Production previews never emit it.
      assert.deepEqual(mutations.filter((url) => !url.includes("/__nextjs_original-stack-frames")), []);
      await page.screenshot({ path: `${output}/${sector}-${target}-${locale}-${width}.png`, fullPage: true });
      results.push({ sector, target, locale, width, retained: true, keyboard: true, noOverflow: true });
    }
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(`${output}/results.json`, JSON.stringify({ anonymousFixturesOnly: true, databaseWrites: 0, results }, null, 2));
console.log(JSON.stringify({ anonymousFixturesOnly: true, databaseWrites: 0, cases: results.length }));
