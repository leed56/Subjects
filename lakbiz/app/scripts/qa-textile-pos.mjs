/** Browser exercises of the actual TextileSalesPage with isolated adapters.
 * No authentication, database, messaging or real transaction is performed.
 * Run after npm run build. Requires Playwright, esbuild and local Chromium.
 * TEXTILE_QA_ESBUILD optionally resolves a disposable bundler installation.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createServer } from "node:http";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const { build } = require(process.env.TEXTILE_QA_ESBUILD ?? "esbuild");
const root = path.resolve(import.meta.dirname, "..");
const output = process.env.LAKBIZ_UI_QA_DIR ?? "/tmp/lakbiz-textile-pos";
fs.mkdirSync(output, { recursive: true });
const entry = `
import React from "react";
import {createRoot} from "react-dom/client";
import {TextileSalesPage} from ${JSON.stringify(path.join(root, "src/components/sales/textile-sales-page.tsx"))};
createRoot(document.getElementById("app")).render(React.createElement(TextileSalesPage));`;
const fixtureExport = (extra = "") => `const f=window.textileFixture; ${extra}`;
const stubs = {
  "next/link": `import React from "react";export default function Link({children,...props}){return React.createElement("a",props,children)}`,
  "@/components/shell/app-shell": `import React from "react";export function AppShell({children}){return React.createElement("div",{className:"flex min-h-screen"},React.createElement("aside",{className:"hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block"},React.createElement("a",{href:"/sales","aria-current":"page",className:"block p-6"},"Local checkout fixture")),React.createElement("div",{className:"min-w-0 flex-1"},children))}`,
  "@/components/write-disabled-hint": `${fixtureExport()} export function WriteDisabledHint(){return f.readOnly?"Read-only fixture":null}`,
  "@/lib/i18n/locale-provider": `import {translate} from ${JSON.stringify(path.join(root, "src/lib/i18n/translations.ts"))};${fixtureExport()}export function useLocale(){return {locale:f.locale,t:(key)=>translate(f.locale,key)}}`,
  "@/lib/store/use-app-store": `${fixtureExport()}export function useAppStore(){return {data:f.data,ready:true}}`,
  "@/lib/subscription/subscription-provider": `${fixtureExport()}export function useSubscription(){return {org:{id:"fixture-org",role:f.role,sector:"textile"},can:()=>false}}`,
  "@/lib/subscription/use-can-write": `${fixtureExport()}export function useWriteAccess(){return {canWrite:!f.readOnly,disabledHint:f.readOnly?"Read only":null}}`,
  "@/lib/supabase/textile-roll-client": `${fixtureExport()}export async function fetchTextileRolls(){f.rollLoads=(f.rollLoads??0)+1;if(f.failLoads&&f.rollLoads===1)throw new Error("Local fixture load failure");return {data:f.empty?[]:f.rolls,error:null}}export async function finalizeTextileSale(org,input){f.checkouts??=[];f.checkouts.push({org,input});return {ok:false,error:"Local fixture captured checkout; no sale posted"}}`,
  "@/lib/supabase/textile-cutting-client": `${fixtureExport()}export async function fetchTextileReservations(){return {data:f.empty?[]:f.reservations,error:null}}`,
  "@/lib/store/storage": `export function saveAppData(){throw new Error("Fixture cannot save live app data")}`,
  "@/lib/supabase/business-sync": `export async function pullBusinessData(){throw new Error("Fixture cannot synchronize live data")}`,
  "@/lib/messaging": `export async function sendApiWhatsApp(){throw new Error("Fixture cannot send messages")}`,
  "@/lib/messaging/use-sms-api-configured": `export function useWhatsAppApiConfigured(){return false}`,
};
const bundle = await build({
  stdin: { contents: entry, resolveDir: root, sourcefile: "textile-local-fixture.tsx", loader: "tsx" },
  bundle: true, platform: "browser", format: "iife", write: false, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "isolated-adapters", setup(builder) {
    builder.onResolve({ filter: /.*/ }, (args) => {
      if (Object.hasOwn(stubs, args.path)) return { path: args.path, namespace: "fixture" };
      if (args.path.startsWith("@/")) {
        const base = path.join(root, "src", args.path.slice(2));
        const file = [base, `${base}.tsx`, `${base}.ts`].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
        if (file) return { path: file };
      }
      return undefined;
    });
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: stubs[args.path], loader: "jsx", resolveDir: root }));
  } }],
});
const javascript = bundle.outputFiles[0].text;
const layout = fs.readFileSync(path.join(root, ".next/server/app/login.html"), "utf8");
const fontClasses = layout.match(/<html[^>]*class="([^"]*)"/)?.[1] ?? "";
const css = [...layout.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
  .map((match) => fs.readFileSync(path.join(root, ".next", match[1].replace(/^\/_next\//, "")), "utf8")).join("\n");
const roll = (id, productId, unit, remaining, reserved, status = "available") => ({
  id, organizationId: "fixture-org", productId, rollNo: id, barcode: `BC-${id}`,
  lengthUnit: unit, receivedLength: 100, remainingLength: remaining, reservedLength: reserved,
  custodyStatus: "available", status, dyeLot: `LOT-${id}`, shade: "Navy / Ecru", rackLocation: "Aisle B · Rack 12",
  unitCost: 9876.54,
});
function data(locale = "en", overrides = {}) {
  return {
    locale, role: "owner", readOnly: false,
    data: {
      business: { name: "Local Textile Fixture", currency: "LKR" },
      products: [
        { id: "cotton", name: "Premium cotton fabric · 150cm · long descriptive product name", active: true, sectorId: "textile", sellPrice: 125.5, customFields: { wholesalePrice: 90, wholesaleMinQty: 10 } },
        { id: "linen", name: "Linen blend fabric", active: true, sectorId: "textile", sellPrice: 200.25, customFields: {} },
      ],
      customers: [{ id: "company", name: "Company buyer", contactType: "company", creditLimit: 100, creditBalance: 90 }],
      customerProductPrices: [{ customerId: "company", productId: "cotton", price: 80.75 }],
    },
    rolls: [roll("MTR-001", "cotton", "metre", 80, 0), roll("MTR-002", "cotton", "metre", 30, 10), roll("YRD-001", "linen", "yard", 75, 0), roll("HOLD-001", "cotton", "metre", 100, 0, "quarantined")],
    reservations: [{ id: "order-1", orderReference: "ORDER-RESERVED", rollId: "MTR-002", productId: "cotton", quantity: 10, lengthUnit: "metre", customerId: "company", customerName: "Company buyer", dyeLot: "LOT-MTR-002", status: "active" }],
    ...overrides,
  };
}
const names = {
  en: { select: "Available fabric rolls", quantity: "Measured quantity", add: "Add roll allocation", review: "Review payment", full: "Full roll", finalize: "Finalize Textile sale" },
  si: { select: "ලබා ගත හැකි රෙදි රෝල්", quantity: "මැනූ ප්‍රමාණය", add: "රෝල් කොටස එකතු කරන්න", review: "ගෙවීම පරීක්ෂා කරන්න", full: "සම්පූර්ණ රෝල", finalize: "රෙදි අලෙවිය අවසන් කරන්න" },
  ta: { select: "கிடைக்கும் துணி Rolls", quantity: "அளவிடப்பட்ட அளவு", add: "Roll ஒதுக்கீட்டைச் சேர்", review: "கட்டணத்தை மறுபரிசீலனை செய்", full: "முழு Roll", finalize: "துணி விற்பனையை முடி" },
};
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/") {
    const locale = url.searchParams.get("locale") ?? "en";
    const scenario = url.searchParams.get("scenario") ?? "loaded";
    const overrides = scenario === "empty" ? { empty: true } : scenario === "error" ? { failLoads: true } : scenario === "cashier" ? { role: "cashier" } : scenario === "readonly" ? { readOnly: true } : {};
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="${locale}" class="${fontClasses}"><head><base href="/_next/static/chunks/"><style>${css}</style></head><body><div id="app"></div><script>window.textileFixture=${JSON.stringify(data(locale, overrides)).replaceAll("<", "\\u003c")}</script><script src="/fixture.js"></script></body></html>`);
    return;
  }
  if (url.pathname === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(javascript); return; }
  const directory = url.pathname.startsWith("/images/") ? path.join(root, "public") : path.join(root, ".next");
  const file = path.resolve(directory, url.pathname.replace(/^\/_next\//, "").replace(/^\//, ""));
  if (!file.startsWith(`${directory}/`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const checks = [];
function assert(condition, message) { if (!condition) throw new Error(message); }
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.LAKBIZ_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  const context = await browser.newContext();
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => { browserErrors.push(error.message); console.error("Fixture browser:", error.message); });
  async function open(locale = "en", scenario = "loaded", width = 1440) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${origin}/?locale=${locale}&scenario=${scenario}`);
    if (scenario === "loaded" || scenario === "cashier" || scenario === "readonly") await page.locator(".textile-roll-option").first().waitFor();
    else await page.locator('[data-ui="pro-empty-state"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
  }
  async function add(id, quantity, locale = "en") {
    // Catalogue changes retain the current product filter; use the real fabric selector.
    await page.locator("select").filter({ has: page.locator('option[value="cotton"]') }).selectOption("");
    await page.getByPlaceholder(locale === "en" ? "Roll number, barcode or dye lot" : locale === "si" ? "රෝල් අංකය, barcode හෝ dye lot" : "Roll எண், பார்கோடு அல்லது dye lot").fill("");
    await page.locator(".textile-roll-option").filter({ hasText: id }).click();
    await page.getByLabel(names[locale].quantity, { exact: true }).fill(String(quantity));
    await page.getByRole("button", { name: names[locale].add, exact: true }).click();
  }
  async function layoutCheck(label) {
    const failures = await page.evaluate(() => {
      const errors = [];
      if (document.documentElement.scrollWidth > innerWidth + 1) errors.push("Horizontal page overflow");
      for (const element of document.querySelectorAll(".textile-roll-option,.textile-bill-summary,.textile-allocation-row,.workspace-metric")) {
        if (element.scrollWidth > element.clientWidth + 1) errors.push(`Overflow: ${element.className}`);
      }
      if (document.querySelector("main").textContent.includes("9876.54")) errors.push("Private cost appears in checkout");
      return errors;
    });
    assert(!failures.length, `${label}: ${failures.join("; ")}`);
    checks.push(label);
    await page.screenshot({ path: path.join(output, `${label}.png`), fullPage: true });
  }
  for (const locale of Object.keys(names)) for (const width of [360, 390, 768, 1440]) {
    await open(locale, "loaded", width);
    assert(await page.locator(".textile-roll-option").count() === 3, "Quarantined roll must be excluded");
    await layoutCheck(`${locale}-${width}-empty-cart`);
    await add("MTR-001", 2, locale);
    await add("YRD-001", 2, locale);
    assert((await page.locator('[data-ui="textile-bill-summary"]').textContent()).includes("651.50"), "Mixed-unit sale total must remain exact");
    assert(await page.locator(".textile-allocation-row").count() === 2, "Metre and yard allocations remain separate");
    await layoutCheck(`${locale}-${width}-mixed-cart`);
    if (width < 1280) {
      await page.getByRole("button", { name: names[locale].review, exact: true }).click();
      await page.waitForFunction(() => {
        const payment = document.querySelector("#textile-settlement").getBoundingClientRect();
        return payment.y >= 0 && payment.y < innerHeight / 2;
      });
    }
  }
  await open();
  await page.locator(".textile-roll-option").filter({hasText:"MTR-001"}).click();
  await page.getByPlaceholder("Roll number, barcode or dye lot").fill("BC-YRD-001");
  assert(await page.getByLabel("Physical roll *", {exact:false}).inputValue() === "YRD-001", "Exact scanner match must cross the previous fabric filter");
  checks.push("scanner-cross-fabric-selection");
  await open();
  await add("MTR-002", 1);
  assert(await page.getByRole("button", { name: "Full roll", exact: true }).isDisabled(), "Reserved material must block full-roll mode");
  checks.push("reserved-roll-full-mode-blocked");
  await open();
  await page.getByLabel("Reserved order (optional)").selectOption("order-1");
  assert(await page.getByLabel("Measured quantity", { exact: true }).inputValue() === "10", "Reservation quantity must be preserved");
  assert(await page.getByLabel("Customer", { exact: false }).inputValue() === "company", "Reservation customer must be preserved");
  assert(await page.getByPlaceholder("Roll number, barcode or dye lot").isDisabled(), "Reserved order locks scanner selection");
  assert(await page.locator(".textile-roll-option").first().isDisabled(), "Reserved order locks catalogue selection");
  await page.getByLabel("Reserved order (optional)").selectOption("");
  assert(await page.getByLabel("Customer", { exact: false }).inputValue() === "", "Clearing reservation must clear customer");
  checks.push("reservation-selection-and-reset");
  await open();
  await add("MTR-001", 2);
  await page.getByLabel("Split payment", { exact: true }).check();
  await page.getByLabel("Second amount", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Finalize Textile sale", exact: true }).click();
  await page.waitForFunction(() => window.textileFixture.checkouts?.length === 1);
  const input = await page.evaluate(() => window.textileFixture.checkouts[0].input);
  assert(input.allocations[0].quantity === 2 && input.allocations[0].unitPrice === 125.5, "Measured allocation price and quantity changed");
  assert(input.tenders.some((t) => t.kind === "cash" && t.amount === 151) && input.tenders.some((t) => t.kind === "card" && t.amount === 100), "Split tender contract changed");
  checks.push("allocation-and-split-tender-captured");
  await open();
  await page.locator(".textile-roll-option").filter({hasText:"MTR-001"}).click();
  await page.getByRole("button", {name:"Wholesale cut",exact:true}).click();
  await page.getByLabel("Measured quantity", {exact:true}).fill("10");
  await page.getByRole("button", {name:"Add roll allocation",exact:true}).click();
  assert((await page.locator('[data-ui="textile-bill-summary"]').textContent()).includes("900.00"), "Wholesale minimum tier must remain applied");
  checks.push("wholesale-tier-price");
  await open();
  await page.locator(".textile-roll-option").filter({hasText:"MTR-001"}).click();
  await page.getByLabel("Customer", {exact:false}).selectOption("company");
  await page.getByLabel("Measured quantity", {exact:true}).fill("2");
  assert((await page.locator("main").textContent()).includes("80.75"), "Customer-specific price must remain applied");
  await page.getByLabel("Manager price override").fill("55.25");
  await page.getByRole("button", {name:"Add roll allocation",exact:true}).click();
  assert((await page.locator('[data-ui="textile-bill-summary"]').textContent()).includes("110.50"), "Authorized manual override must retain priority");
  checks.push("customer-and-manager-price-priority");
  await open();
  await add("MTR-002", 25);
  assert(await page.locator(".textile-allocation-row").count() === 0, "Over-allocation must not enter cart");
  assert((await page.getByRole("alert").textContent()).includes("20.000"), "Over-allocation must identify actual available length");
  checks.push("over-allocation-rejected");
  await open("en", "cashier");
  assert(await page.getByLabel("Manager price override").count() === 0, "Cashier must not see manager price override");
  await add("MTR-001", 2);
  await page.getByRole("button", { name: "Credit", exact: true }).click();
  await page.getByRole("button", { name: "Finalize Textile sale", exact: true }).click();
  assert((await page.getByRole("alert").textContent()).includes("customer account"), "Credit without customer must be rejected");
  assert(!(await page.evaluate(() => window.textileFixture.checkouts?.length)), "Invalid credit must not reach finalizer");
  checks.push("cashier-price-and-credit-boundaries");
  await open("en", "readonly");
  await add("MTR-001", 2);
  assert(await page.getByRole("button", { name: "Finalize Textile sale", exact: true }).isDisabled(), "Read-only checkout must remain disabled");
  checks.push("read-only-checkout-disabled");
  await open("en", "empty", 390);
  assert((await page.locator('[data-ui="pro-empty-state"]').textContent()).includes("No physical rolls available"), "Empty state missing");
  await layoutCheck("empty-inventory");
  await open("en", "error", 390);
  assert((await page.getByRole("alert").textContent()).includes("could not be loaded"), "Load failure must not present as empty inventory");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.locator(".textile-roll-option").first().waitFor();
  assert(await page.evaluate(() => window.textileFixture.rollLoads) === 2, "Retry must refetch roll availability");
  checks.push("load-error-retry");
  await open();
  for (let i = 0; i < 12; i++) await add("MTR-001", 1);
  await layoutCheck("desktop-twelve-allocations");
  await page.getByRole("button", { name: "Cheque", exact: true }).click();
  await page.getByLabel("Split payment", { exact: true }).check();
  await page.getByRole("button", { name: "Finalize Textile sale", exact: true }).scrollIntoViewIfNeeded();
  const button = await page.getByRole("button", { name: "Finalize Textile sale", exact: true }).boundingBox();
  assert(button.y >= 0 && button.y + button.height <= 1000, "Long desktop checkout must keep final action reachable");
  checks.push("long-cheque-checkout-reachable");
  assert(!browserErrors.length, `Browser errors: ${browserErrors.join("; ")}`);
  console.log(`Passed ${checks.length} textile UI scenarios. Actual component + isolated adapters; no real sale or authenticated backend certification.`);
} finally {
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(checks, null, 2));
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
