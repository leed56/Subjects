#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  classifyRetailProduct,
  exactMediVerifyMatch,
  extractSpcBrand,
  parseHealthguardProducts,
  parseMediVerifyResults,
  parseSparCollectionProducts,
  parseSpcRows,
  toNormalizedDemoProduct,
} from "./demo-catalog/core.mjs";

const args = new Set(process.argv.slice(2));
const valueArg = (name, fallback) => {
  const prefix = `${name}=`;
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
};

const outputPath = resolve(valueArg("--out", "/tmp/lakbiz-sri-lanka-demo-catalog.json"));
const maxGrocery = Number(valueArg("--max-grocery", "1600"));
const maxPharmacyRetail = Number(valueArg("--max-pharmacy-retail", "900"));
const verifyRegulatory = args.has("--verify-regulatory");
const delayMs = Math.max(250, Number(valueArg("--delay-ms", "500")));
const retrievedAt = new Date().toISOString();

const USER_AGENT = "LakBizDemoCatalog/1.0 (+public factual catalog research; no images/descriptions)";
const robotsCache = new Map();
let lastRequestAt = 0;

const HEALTHGUARD_TARGETS = [
  ["https://www.healthguard.lk/all-products/medical-devices", "Pharmaceutical", "Medical Devices", "Medical Devices"],
  ["https://www.healthguard.lk/all-products/personal-care", "Personal Care", "Personal Care", "Personal Care"],
  ["https://www.healthguard.lk/all-products/mother-baby", "Mother & Baby", "Baby Care", "Mother & Baby"],
  ["https://www.healthguard.lk/all-products/household", "Household & Health Convenience", "Household", "Household"],
  ["https://www.healthguard.lk/all-products/food-beverage", "Convenience Retail", "Food & Beverage", "Food & Beverage"],
  ["https://www.healthguard.lk/all-products/skin-care", "Personal Care", "Skin Care", "Skin Care"],
  ["https://www.healthguard.lk/all-products/hair-care", "Personal Care", "Hair Care", "Hair Care"],
  ["https://www.healthguard.lk/all-products/health/beauty-supplements", "Wellness", "Vitamins & Supplements", "Beauty Supplements"],
  ["https://www.healthguard.lk/all-products/health/health-devices", "Pharmaceutical", "Medical Devices", "Health Devices"],
];

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function throttle() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < delayMs) await sleep(delayMs - elapsed);
  lastRequestAt = Date.now();
}

function parseRobots(text) {
  const rules = [];
  let applies = false;
  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      applies = value === "*" || /lakbizdemocatalog/i.test(value);
      continue;
    }
    if (applies && key === "disallow" && value) rules.push(value);
  }
  return rules;
}

async function robotsAllows(url) {
  const target = new URL(url);
  if (!robotsCache.has(target.origin)) {
    await throttle();
    const robotsUrl = `${target.origin}/robots.txt`;
    try {
      const response = await fetch(robotsUrl, { headers: { "user-agent": USER_AGENT } });
      if (response.status === 404) robotsCache.set(target.origin, []);
      else if (!response.ok) robotsCache.set(target.origin, null);
      else robotsCache.set(target.origin, parseRobots(await response.text()));
    } catch {
      robotsCache.set(target.origin, null);
    }
  }
  const rules = robotsCache.get(target.origin);
  if (rules === null) return false;
  return !rules.some((rule) => target.pathname.startsWith(rule));
}

async function fetchText(url, { required = false } = {}) {
  if (!(await robotsAllows(url))) {
    const message = `robots policy unavailable/disallows source: ${url}`;
    if (required) throw new Error(message);
    console.warn(`SKIP ${message}`);
    return null;
  }
  await throttle();
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  if (response.status === 429) {
    const retryAfter = Math.min(30, Number(response.headers.get("retry-after") || "3"));
    await sleep(retryAfter * 1000);
    return fetchText(url, { required });
  }
  if (!response.ok) {
    const message = `${response.status} ${response.statusText}: ${url}`;
    if (required) throw new Error(message);
    console.warn(`SKIP ${message}`);
    return null;
  }
  return response.text();
}

function sourceKey(row) {
  return `${row.source}:${row.sourceProductId}`;
}

function mergeUnique(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = sourceKey(row);
    const current = map.get(key);
    if (!current) map.set(key, row);
    else map.set(key, { ...current, ...Object.fromEntries(Object.entries(row).filter(([, value]) => value != null)) });
  }
  return [...map.values()];
}

async function fetchSpc() {
  const url = "https://www.spc.lk/products.php";
  const html = await fetchText(url, { required: true });
  const rows = parseSpcRows(html, url);
  console.log(`SPC: ${rows.length} factual commercial items`);
  if (!verifyRegulatory) return rows;

  let verified = 0;
  for (const row of rows) {
    const brand = extractSpcBrand(row.productName);
    if (!brand) continue;
    const searchUrl = `https://mediverify.lk/search/similar/?direct=1&query=${encodeURIComponent(brand)}`;
    const page = await fetchText(searchUrl);
    if (!page) continue;
    const match = exactMediVerifyMatch(row, parseMediVerifyResults(page, searchUrl));
    if (match) {
      row.regulatory = match;
      verified += 1;
    }
  }
  console.log(`MediVerify: ${verified}/${rows.length} SPC rows enriched by unique exact-brand match`);
  return rows;
}

async function fetchSpar(maxProducts) {
  const rows = [];
  const seen = new Set();
  for (let page = 1; rows.length < maxProducts && page <= 180; page += 1) {
    const url = `https://spar2u.lk/collections/all?page=${page}`;
    const html = await fetchText(url);
    if (!html) break;
    const pageRows = parseSparCollectionProducts(html, url);
    let added = 0;
    for (const row of pageRows) {
      const key = sourceKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      row.taxonomy = { ...classifyRetailProduct(row.productName, "grocery"), taxonomyMethod: "normalization_heuristic" };
      rows.push(row);
      added += 1;
      if (rows.length >= maxProducts) break;
    }
    if (!added) break;
    if (page % 10 === 0) console.log(`SPAR2U: ${rows.length} unique products after page ${page}`);
  }
  return rows;
}

async function fetchHealthguard(maxProducts) {
  const rows = [];
  const seen = new Set();
  for (const [baseUrl, department, category, subcategory] of HEALTHGUARD_TARGETS) {
    for (let page = 1; rows.length < maxProducts && page <= 80; page += 1) {
      const separator = baseUrl.includes("?") ? "&" : "?";
      const url = `${baseUrl}${separator}p=${page}`;
      const html = await fetchText(url);
      if (!html) break;
      const pageRows = parseHealthguardProducts(html, url);
      let added = 0;
      for (const row of pageRows) {
        const key = sourceKey(row);
        if (seen.has(key)) continue;
        seen.add(key);
        const inferred = classifyRetailProduct(row.productName, "pharmacy");
        row.taxonomy = {
          department: inferred.department === "Wellness" && department !== "Wellness" ? department : inferred.department,
          category: inferred.category === "Preventive Care" ? category : inferred.category,
          subcategory: inferred.subcategory === "Health & Wellness" ? subcategory : inferred.subcategory,
          productKind: "retail",
          taxonomyMethod: "source_category_plus_normalization",
        };
        rows.push(row);
        added += 1;
        if (rows.length >= maxProducts) break;
      }
      if (!added) break;
    }
    console.log(`Healthguard: ${rows.length} unique non-SPC products after ${baseUrl}`);
    if (rows.length >= maxProducts) break;
  }
  return rows;
}

async function main() {
  console.log("LakBiz Sri Lanka demo catalog acquisition");
  console.log(`Retrieved at: ${retrievedAt}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Regulatory enrichment: ${verifyRegulatory ? "exact-match MediVerify enabled" : "disabled"}`);

  const [spc, spar, healthguard] = await Promise.all([
    fetchSpc(),
    fetchSpar(maxGrocery),
    fetchHealthguard(maxPharmacyRetail),
  ]);

  const pharmacyRaw = mergeUnique([...spc, ...healthguard]);
  const groceryRaw = mergeUnique(spar);
  const pharmacy = pharmacyRaw.map((row) => toNormalizedDemoProduct(row, "pharmacy", retrievedAt));
  const grocery = groceryRaw.map((row) => toNormalizedDemoProduct(row, "grocery", retrievedAt));

  const payload = {
    schemaVersion: 1,
    generatedAt: retrievedAt,
    limitations: {
      regulatory: "NMRA has publicly disclosed a medicine-registration database update limitation. Registration fields are populated only when an exact MediVerify match is obtained; otherwise they remain null.",
      retailerData: "Only public factual names/prices/identifiers are retained. Product descriptions and images are not copied.",
      taxonomy: "Retail taxonomy is normalized for LakBiz and is marked with taxonomyMethod; it is not represented as a regulator-supplied classification.",
    },
    sourceCounts: {
      spc: spc.length,
      healthguard: healthguard.length,
      spar2u: spar.length,
    },
    pharmacy,
    grocery,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`WROTE pharmacy=${pharmacy.length}, grocery=${grocery.length}`);
  console.log("No database changes were made by this acquisition script.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
