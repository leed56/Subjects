/** Local visual fixtures of production components, never a public QA route.
 * Run after npm run build. Requires Playwright + an installed Chromium.
 * Optional LAKBIZ_CHROMIUM_PATH points at a local browser executable.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(import.meta.dirname, "..");
const output = process.env.LAKBIZ_UI_QA_DIR ?? "/tmp/lakbiz-workspace-surfaces";
fs.mkdirSync(output, { recursive: true });
const cache = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const compiledModule = { exports: {} };
  cache.set(file, compiledModule);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", code)((specifier) => {
    if (specifier.startsWith("@/")) {
      const base = `src/${specifier.slice(2)}`;
      return load([`${base}.tsx`, `${base}.ts`].find((p) => fs.existsSync(path.join(root, p))));
    }
    return require(specifier);
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { PageHeader, MetricCard, Panel, EmptyState } = load("src/components/ui/primitives.tsx");
const { ProPageHeader, ProStatCard, ProCard, ProEmptyState } = load("src/components/ui/pro-shell.tsx");
const { DataTable } = load("src/components/ui/table.tsx");
const h = React.createElement;
const copy = {
  en: ["Inventory & business performance", "Products across all branches", "Review stock alerts", "Stock value"],
  si: ["තොග සහ ව්‍යාපාර කාර්ය සාධනය", "සියලුම ශාඛාවල නිෂ්පාදන", "තොග ඇඟවීම් සමාලෝචනය කරන්න", "තොග වටිනාකම"],
  ta: ["சரக்கு மற்றும் வணிக செயல்திறன்", "அனைத்து கிளைகளிலும் உள்ள தயாரிப்புகள்", "சரக்கு எச்சரிக்கைகளை மதிப்பாய்வு செய்யவும்", "சரக்கு மதிப்பு"],
};
// Preserve Next's actual stylesheet order and font variables. Alphabetical
// chunk order would put component layers before Tailwind's base reset.
const layoutHtml = fs.readFileSync(path.join(root, ".next/server/app/login.html"), "utf8");
const fontClasses = layoutHtml.match(/<html[^>]*class="([^"]*)"/)?.[1] ?? "";
const css = [...layoutHtml.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
  .map((match) => fs.readFileSync(path.join(root, ".next", match[1].replace(/^\/_next\//, "")), "utf8")).join("\n");
function fixture(locale) {
  const [title, description, action, metric] = copy[locale];
  const actions = h("button", { className: "min-h-11 rounded-xl bg-teal-600 px-4 py-2 text-sm text-white" }, action);
  const metrics = h("div", { className: "grid grid-cols-2 gap-3 xl:grid-cols-4" },
    ...["default", "positive", "warning", "danger"].map((tone) => h(MetricCard, {
      key: tone, tone, label: metric, value: tone === "danger" ? "−LKR 12,450.00" : "LKR 1,245,330.00", hint: description,
    })));
  const columns = [
    { key: "product", header: "Product", render: (row) => row.product },
    { key: "sku", header: "SKU / Batch", render: (row) => row.sku },
    { key: "value", header: metric, align: "right", render: () => "LKR 1,245,330.00" },
  ];
  return renderToStaticMarkup(h("div", null,
    h("aside", { className: "hidden" }, h("a", { href: "/dashboard", "aria-current": "page" }, "Dashboard")),
    h("main", { className: "mx-auto max-w-6xl space-y-6 px-4 py-6" },
      h(PageHeader, { title, description, actions, metrics, sector: "cosmetics" }),
      h(ProPageHeader, { title, description, actions }),
      h("div", { className: "grid grid-cols-2 gap-3 lg:grid-cols-3" },
        ...["blue", "teal", "emerald", "amber", "rose", "slate"].map((tone) => h(ProStatCard, {
          key: tone, tone, label: metric, value: "LKR 999,999,999,999.99", hint: description,
        }))),
      h(Panel, { title, action: actions }, h(DataTable, { columns, rows: [{ id: "1", product: `${description} · Hydrating serum 30ml`, sku: "COS-VERY-LONG-BATCH-20261012-ABCDEFGHIJKLMN" }] })),
      h(ProCard, { title, action: actions }, h(ProEmptyState, { title: "No matching records", description, action: actions })),
      h(EmptyState, { title: "No records yet", description, action: actions }),
      h(ProCard, { title: "Utility override", className: "p-0" }, "Zero-padding panel"))));
}
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/") {
    const locale = url.searchParams.get("locale") ?? "en";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="${locale}" class="${fontClasses}"><head><base href="/_next/static/chunks/"><style>${css}</style></head><body>${fixture(locale)}</body></html>`);
    return;
  }
  const directory = url.pathname.startsWith("/images/") ? path.join(root, "public") : path.join(root, ".next");
  const relative = url.pathname.replace(/^\/_next\//, "");
  const file = path.resolve(directory, relative.replace(/^\//, ""));
  if (!file.startsWith(`${directory}/`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
const results = [];
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.LAKBIZ_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  for (const locale of Object.keys(copy)) for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`http://127.0.0.1:${server.address().port}/?locale=${locale}`);
    await page.evaluate(() => document.fonts.ready);
    const failures = await page.evaluate(() => {
      const errors = [];
      function contrastOnWhite(color) {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map((n) => Number(n) / 255)
          .map((n) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
        return 1.05 / (channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 + .05);
      }
      for (const text of document.querySelectorAll(".workspace-metric-label,.workspace-metric-value,.workspace-metric-hint,.workspace-panel-title")) {
        if (contrastOnWhite(getComputedStyle(text).color) < 4.5) errors.push("Text contrast below 4.5:1");
      }
      const values = [...document.querySelectorAll('[data-ui="metric-card"] .workspace-metric-value')].map((p) => p.textContent);
      if (values.some((value, index) => value !== (index === 3 ? "−LKR 12,450.00" : "LKR 1,245,330.00"))) errors.push("Displayed value changed");
      if (document.documentElement.scrollWidth > innerWidth + 1) errors.push("Page overflows viewport");
      for (const card of document.querySelectorAll(".workspace-metric,.workspace-panel,.workspace-header-actions,.workspace-table-mobile-row")) {
        if (card.getBoundingClientRect().width && card.scrollWidth > card.clientWidth + 1) errors.push(`Content overflows ${card.className}`);
      }
      for (const card of document.querySelectorAll(".workspace-metric")) {
        if (getComputedStyle(card).backgroundColor !== "rgb(255, 255, 255)") errors.push("Metric is not a white surface");
        if (parseFloat(getComputedStyle(card).paddingLeft) < 12) errors.push("Metric padding lost to CSS ordering");
      }
      const override = [...document.querySelectorAll(".workspace-panel")].find((panel) => panel.textContent.includes("Zero-padding panel"));
      if (getComputedStyle(override).paddingTop !== "0px") errors.push("Utility padding override lost");
      if (parseFloat(getComputedStyle(document.querySelector(".workspace-panel-title")).fontWeight) < 600) errors.push("Panel heading hierarchy lost");
      return errors;
    });
    await page.screenshot({ path: path.join(output, `${locale}-${width}.png`), fullPage: true });
    results.push({ locale, width, failures });
    if (failures.length) throw new Error(`${locale}/${width}: ${failures.join("; ")}`);
  }
  console.log(`Passed ${results.length} production-component fixtures: 3 languages × 4 viewports.`);
} finally {
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(results, null, 2));
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
