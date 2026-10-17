/** Local SSR fixtures of actual banner components. Run after npm run build. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.LAKBIZ_QA_PLAYWRIGHT ?? "playwright");
const root = path.resolve(import.meta.dirname, "..");
const output = process.env.LAKBIZ_UI_QA_DIR ?? "/tmp/lakbiz-industry-banners";
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
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const base = specifier.startsWith("@/")
        ? path.join(root, `src/${specifier.slice(2)}`)
        : path.resolve(path.dirname(file), specifier);
      const target = [`${base}.tsx`, `${base}.ts`].find((p) => fs.existsSync(p));
      if (!target) throw new Error(`Cannot resolve fixture module ${specifier} from ${file}`);
      return load(target);
    }
    return require(specifier);
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { PageHeader } = load("src/components/ui/primitives.tsx");
const { ReferenceBanner, ProductPhoto } = load("src/components/demo/reference-visuals.tsx");
const { INDUSTRY_TEMPLATES } = load("src/lib/erp/industry-templates.ts");
const h = React.createElement;
const layoutHtml = fs.readFileSync(path.join(root, ".next/server/app/login.html"), "utf8");
const fontClasses = layoutHtml.match(/<html[^>]*class="([^"]*)"/)?.[1] ?? "";
const css = [...layoutHtml.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
  .map((match) => fs.readFileSync(path.join(root, ".next", match[1].replace(/^\/_next\//, "")), "utf8")).join("\n");
function fixture(industry) {
  const template = INDUSTRY_TEMPLATES.find((t) => t.id === industry);
  return renderToStaticMarkup(h("main", { className: "mx-auto max-w-6xl space-y-6 px-4 py-6" },
    h("div", { className: "erp-demo" }, h(ReferenceBanner, { template, title: template.nameEn, description: "Industry overview" })),
    h("div", { className: "erp-demo" }, h(ReferenceBanner, { template, title: "Inventory & Imports", description: "Shipments for this industry", imports: true })),
    h(PageHeader, { sector: industry, title: template.nameEn, description: "Live workspace header" }),
    industry === "textile" && h("div", {className:"flex gap-4",id:"textile-roll-varieties"}, ...["Cotton poplin","Indigo denim","Floral rayon","Linen blend"].map(name =>
      h(ProductPhoto,{key:name,industry,product:{name,category:name}})))));
}
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/") {
    const industry = url.searchParams.get("industry") ?? "grocery";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><html lang="en" class="${fontClasses}"><head><base href="/_next/static/chunks/"><style>${css}</style></head><body>${fixture(industry)}</body></html>`);
    return;
  }
  const directory = url.pathname.startsWith("/images/") ? path.join(root, "public") : path.join(root, ".next");
  const relative = url.pathname.replace(/^\/_next\//, "");
  const file = path.resolve(directory, relative.replace(/^\//, ""));
  if (!file.startsWith(`${directory}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
const results = [];
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.LAKBIZ_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  for (const template of INDUSTRY_TEMPLATES) for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://127.0.0.1:${server.address().port}/?industry=${template.id}`);
    await page.evaluate(() => document.fonts.ready);
    // Decode the actual local atlas before inspecting or capturing the banners.
    await page.evaluate(async () => { await Promise.all(["/images/industry-products-atlas.webp","/images/textile-fabric-rolls-atlas.webp"].map(async src => { const image = new Image(); image.src=src; await image.decode(); })); });
    const failures = await page.evaluate((industry) => {
      const errors = [];
      if (document.documentElement.scrollWidth > innerWidth + 1) errors.push("Page overflows viewport");
      const groups = [...document.querySelectorAll(".reference-banner-images,.live-industry-header-images")];
      const expected = [[industry], ["shipping", industry, "cartons"], [industry]];
      groups.forEach((group, index) => {
        const photos = [...group.querySelectorAll(".industry-banner-photo")];
        if (JSON.stringify(photos.map((photo) => photo.dataset.imageContext)) !== JSON.stringify(expected[index])) errors.push("Incorrect industry context");
        for (const photo of photos) {
          const bounds = photo.getBoundingClientRect();
          if (bounds.width < 10 || bounds.height < 10) errors.push("Banner photo collapsed");
          if (photo.getAttribute("preserveAspectRatio") !== "xMidYMid meet") errors.push("Photo proportions are not preserved");
        }
      });
      if (groups.length !== 3) errors.push("Missing demo, import or live banner");
      if (industry === "textile") {
        const textilePhotos = [...document.querySelectorAll('[data-image-context="textile"] image')];
        if (textilePhotos.length !== 3 || textilePhotos.some(photo => photo.getAttribute('href') !== '/images/textile-fabric-rolls-atlas.webp')) errors.push('Textile banner still uses the general garment atlas');
        const varieties = [...document.querySelectorAll('#textile-roll-varieties .reference-product-photo')];
        if (varieties.length !== 4 || varieties.some(photo => !photo.style.backgroundImage.includes('textile-fabric-rolls-atlas.webp')) || new Set(varieties.map(photo => photo.style.backgroundPosition)).size !== 4) errors.push('Fabric products do not show four roll varieties');
      }
      return errors;
    }, template.id);
    results.push({ industry: template.id, width, failures });
    await page.screenshot({ path: path.join(output, `${template.id}-${width}.png`), fullPage: true });
    if (failures.length) throw new Error(`${template.id}/${width}: ${failures.join("; ")}`);
  }
  if (browserErrors.length) throw new Error(browserErrors.join("; "));
  console.log(`Passed ${results.length} industry fixtures: 14 industries × 4 viewports, each with demo, import and live banners.`);
} finally {
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify(results, null, 2));
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
