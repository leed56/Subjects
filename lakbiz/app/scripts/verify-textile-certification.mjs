#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { assertLakBizTarget } from "./demo-catalog/importer.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const organizationName = process.argv.find((arg) => arg.startsWith("--organization="))?.split("=").slice(1).join("=") || "True Textile";
const FIXTURE_VERSION = "lakbiz-textile-certification-v1";

if (!url || !serviceRole) throw new Error("Supabase URL and service-role key are required");
assertLakBizTarget(url);
const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const { data: organizations, error: orgError } = await admin.from("organizations").select("id,name,sector").eq("name", organizationName);
if (orgError) throw new Error(orgError.message);
assert((organizations ?? []).length === 1, `Expected exactly one ${organizationName} organization`);
const organization = organizations[0];
assert(organization.sector === "textile", "Certification organization is not Textile");

const [
  { data: products, error: productError },
  { data: rolls, error: rollError },
  { data: customers, error: customerError },
  { data: suppliers, error: supplierError },
  { data: terms, error: termsError },
] = await Promise.all([
  admin.from("products_base").select("id,unit,stock_qty,custom_fields").eq("organization_id", organization.id).contains("custom_fields", { fixture: FIXTURE_VERSION }),
  admin.from("textile_rolls").select("id,product_id,length_unit,remaining_length,status,is_remnant,dye_lot,source_reference").eq("organization_id", organization.id).eq("source_reference", FIXTURE_VERSION),
  admin.from("customers").select("id").eq("organization_id", organization.id).like("id", "qa-textile-customer-%"),
  admin.from("suppliers").select("id").eq("organization_id", organization.id).like("id", "qa-textile-supplier-%"),
  admin.from("textile_customer_terms").select("customer_id").eq("organization_id", organization.id).like("customer_id", "qa-textile-customer-%"),
]);
for (const error of [productError, rollError, customerError, supplierError, termsError]) {
  if (error) throw new Error(error.message);
}

assert(products.length === 20, `Expected 20 fixture products, found ${products.length}`);
assert(rolls.length === 40, `Expected 40 fixture rolls, found ${rolls.length}`);
assert(new Set(rolls.map((roll) => roll.dye_lot)).size >= 3, "Expected at least three dye lots");
assert(rolls.some((roll) => roll.length_unit === "metre"), "Missing metre rolls");
assert(rolls.some((roll) => roll.length_unit === "yard"), "Missing yard rolls");
assert(rolls.some((roll) => roll.status === "quarantined"), "Missing quarantined roll");
assert(rolls.some((roll) => roll.is_remnant), "Missing remnant fixture");
assert(customers.length === 6, `Expected six customers, found ${customers.length}`);
assert(suppliers.length === 3, `Expected three suppliers, found ${suppliers.length}`);
assert(terms.length === 5, `Expected five customer-term rows, found ${terms.length}`);

const rollIds = new Set(rolls.map((roll) => roll.id));
const { data: receipts, error: receiptError } = await admin
  .from("textile_roll_movements")
  .select("roll_id,movement_type")
  .eq("organization_id", organization.id)
  .eq("movement_type", "receipt")
  .in("roll_id", [...rollIds]);
if (receiptError) throw new Error(receiptError.message);
assert(new Set(receipts.map((row) => row.roll_id)).size === 40, "Every fixture roll must have a receipt audit movement");

console.log("LakBiz Textile certification fixture verification PASSED");
console.log(JSON.stringify({
  organizationId: organization.id,
  products: products.length,
  rolls: rolls.length,
  receiptMovements: receipts.length,
  customers: customers.length,
  suppliers: suppliers.length,
  customerTerms: terms.length,
  nextGate: "Run owner and cross-role journeys through the UI; fixture presence alone is not workflow certification.",
}, null, 2));
