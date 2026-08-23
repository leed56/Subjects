#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import {
  assertLakBizTarget,
  ensureDemoShop,
  ensureDemoStaff,
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
    cashierEmail: process.env.DEMO_PHARMACY_CASHIER_EMAIL ?? "",
    cashierPassword: process.env.DEMO_PHARMACY_CASHIER_PASSWORD ?? "",
  },
  {
    sector: "grocery",
    name: "LakBiz Grocery Demo",
    phone: "0110000202",
    ownerEmail: process.env.DEMO_GROCERY_EMAIL ?? "",
    ownerPassword: process.env.DEMO_GROCERY_PASSWORD ?? "",
    cashierEmail: process.env.DEMO_GROCERY_CASHIER_EMAIL ?? "",
    cashierPassword: process.env.DEMO_GROCERY_CASHIER_PASSWORD ?? "",
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
    roleAccountsPerShop: ["owner", "cashier"],
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log("Dry run only. Re-run with --apply and server-side secrets to create/update demo shops and role accounts.");
    return;
  }

  if (!url || !serviceRole) throw new Error("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply");
  assertLakBizTarget(url);

  for (const spec of specs) {
    const prefix = spec.sector === "pharmacy" ? "DEMO_PHARMACY" : "DEMO_GROCERY";
    if (!spec.ownerEmail || !spec.ownerPassword) throw new Error(`Missing ${prefix}_EMAIL/PASSWORD`);
    if (!spec.cashierEmail || !spec.cashierPassword) throw new Error(`Missing ${prefix}_CASHIER_EMAIL/CASHIER_PASSWORD`);
    if (spec.ownerEmail.toLowerCase() === spec.cashierEmail.toLowerCase()) throw new Error(`${spec.name} owner and cashier must use different Auth identities`);
    if (spec.ownerPassword.length < 12) throw new Error(`${spec.name} owner password must be at least 12 characters`);
    if (spec.cashierPassword.length < 12) throw new Error(`${spec.name} cashier password must be at least 12 characters`);
  }

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const final = {};
  for (const spec of specs) {
    const products = payload[spec.sector];
    const shop = await ensureDemoShop(admin, spec);
    const cashier = await ensureDemoStaff(admin, {
      orgId: shop.orgId,
      email: spec.cashierEmail,
      password: spec.cashierPassword,
      role: "cashier",
      displayName: `${spec.name} Cashier`,
    });
    const catalog = await importCatalog(admin, shop.orgId, spec.sector, products);
    const history = await seedDemoHistory(admin, shop.orgId, spec.sector, products);
    final[spec.sector] = { ...shop, cashier, ...catalog, ...history };
    console.log(`${spec.name}:`, final[spec.sector]);
  }

  console.log("Demo import completed. Credentials were read from environment only and were not written to the repository or logs.");
  console.log(JSON.stringify(final, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
