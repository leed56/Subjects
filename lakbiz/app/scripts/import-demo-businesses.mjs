#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  assertLakBizTarget,
  ensureDemoShop,
  importCatalog,
  seedDemoHistory,
} from "./demo-catalog/importer.mjs";

const args = new Set(process.argv.slice(2));
const valueArg = (name, fallback) => {
  const prefix = `${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

const apply = args.has("--apply");
const catalogPath = valueArg("--catalog", "/tmp/lakbiz-sri-lanka-demo-catalog.json");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const specs = [
  {
    sector: "pharmacy",
    name: "LakBiz Pharmacy Demo",
    phone: "0110000201",
    ownerEmail: process.env.DEMO_PHARMACY_EMAIL ?? "",
    ownerPassword: process.env.DEMO_PHARMACY_PASSWORD ?? "",
  },
  {
    sector: "grocery",
    name: "LakBiz Grocery Demo",
    phone: "0110000202",
    ownerEmail: process.env.DEMO_GROCERY_EMAIL ?? "",
    ownerPassword: process.env.DEMO_GROCERY_PASSWORD ?? "",
  },
];

async function main() {
  const payload = JSON.parse(await readFile(catalogPath, "utf8"));
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.pharmacy) || !Array.isArray(payload.grocery)) {
    throw new Error("Unsupported or invalid LakBiz demo catalog file");
  }

  const summary = {
    generatedAt: payload.generatedAt,
    pharmacy: payload.pharmacy.length,
    grocery: payload.grocery.length,
    sourceCounts: payload.sourceCounts,
    mode: apply ? "APPLY" : "DRY-RUN",
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log("Dry run only. Re-run with --apply and server-side secrets to create/update demo shops.");
    return;
  }

  if (!url || !serviceRole) throw new Error("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply");
  assertLakBizTarget(url);

  for (const spec of specs) {
    if (!spec.ownerEmail || !spec.ownerPassword) {
      throw new Error(`Missing ${spec.sector === "pharmacy" ? "DEMO_PHARMACY" : "DEMO_GROCERY"}_EMAIL/PASSWORD`);
    }
    if (spec.ownerPassword.length < 12) throw new Error(`${spec.name} password must be at least 12 characters`);
  }

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const final = {};
  for (const spec of specs) {
    const products = payload[spec.sector];
    const shop = await ensureDemoShop(admin, spec);
    const catalog = await importCatalog(admin, shop.orgId, spec.sector, products);
    const history = await seedDemoHistory(admin, shop.orgId, spec.sector, products);
    final[spec.sector] = { ...shop, ...catalog, ...history };
    console.log(`${spec.name}:`, final[spec.sector]);
  }

  console.log("Demo import completed. Credentials were read from environment only and were not written to the repository.");
  console.log(JSON.stringify(final, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
