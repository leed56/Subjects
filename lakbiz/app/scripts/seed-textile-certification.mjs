#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assertLakBizTarget } from "./demo-catalog/importer.mjs";

const argv = process.argv.slice(2);
const args = new Set(argv);
const valueArg = (name, fallback = "") => {
  const prefix = `${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
};

const apply = args.has("--apply");
const organizationName = valueArg("--organization", "True Textile");
const confirmedOrganizationId = valueArg("--confirm-organization-id");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const FIXTURE_VERSION = "lakbiz-textile-certification-v1";

function deterministicUuid(key) {
  // Matches the UUIDs used by the connected Supabase fixture application so
  // a later service-role rerun updates the same rolls instead of colliding on
  // the organization + roll-number uniqueness guard.
  const hex = createHash("md5").update(`${FIXTURE_VERSION}:${key}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

const fabricNames = [
  "Premium Cotton Poplin White",
  "Premium Cotton Poplin Sky",
  "Linen Blend Natural",
  "Linen Blend Olive",
  "Viscose Twill Navy",
  "Viscose Twill Maroon",
  "School Uniform White",
  "School Uniform Blue",
  "Printed Lawn Floral",
  "Printed Lawn Geometric",
  "Rayon Challis Black",
  "Rayon Challis Teal",
  "Denim 10oz Indigo",
  "Denim 12oz Dark",
  "Saree Satin Ruby",
  "Saree Satin Emerald",
  "Curtain Jacquard Gold",
  "Curtain Jacquard Silver",
  "Cotton Voile Ivory",
  "Cotton Voile Rose",
];

const products = fabricNames.map((name, index) => {
  const unit = index < 14 ? "metre" : "yard";
  return {
    id: `qa-textile-product-${String(index + 1).padStart(2, "0")}`,
    name,
    sku: `TXT-QA-${String(index + 1).padStart(3, "0")}`,
    category: index < 6 ? "Apparel Fabric" : index < 14 ? "Uniform & Fashion" : "Saree & Interior",
    sector_id: "textile",
    buy_price: 0,
    sell_price: unit === "metre" ? 1450 + index * 55 : 1280 + index * 45,
    stock_qty: 0,
    reorder_level: 20,
    unit,
    condition: "new",
    active: true,
    notes: "LakBiz Textile certification fixture",
    custom_fields: {
      fixture: FIXTURE_VERSION,
      stockAuthority: "physical_rolls",
      lengthUnit: unit,
    },
  };
});

const suppliers = [
  ["qa-textile-supplier-01", "Pettah Fabric Imports", "0770001001", "Main Street, Colombo 11"],
  ["qa-textile-supplier-02", "South Asia Textile Traders", "0770001002", "Prince Street, Colombo 11"],
  ["qa-textile-supplier-03", "Lanka Mill Distributors", "0770001003", "Orugodawatta, Colombo 14"],
].map(([id, name, phone, address]) => ({
  id, name, phone, address, payable_balance: 0, contact_person: "QA Contact",
}));

const customers = [
  ["qa-textile-customer-01", "Nugegoda Fashion House", "company", 500000],
  ["qa-textile-customer-02", "Kandy Uniform Centre", "company", 350000],
  ["qa-textile-customer-03", "Galle Textile Mart", "company", 250000],
  ["qa-textile-customer-04", "Colombo Tailors", "company", 150000],
  ["qa-textile-customer-05", "Walk-in Retail Customer", "individual", 0],
  ["qa-textile-customer-06", "Kurunegala Drapery", "company", 300000],
].map(([id, name, contact_type, credit_limit], index) => ({
  id,
  name,
  contact_type,
  credit_limit,
  credit_balance: 0,
  phone: `07710020${String(index + 1).padStart(2, "0")}`,
  address: "Sri Lanka",
  contact_person: contact_type === "company" ? "Purchasing Manager" : null,
}));

const rolls = products.flatMap((product, productIndex) =>
  [0, 1].map((rollIndex) => {
    const n = productIndex * 2 + rollIndex + 1;
    const received = product.unit === "metre" ? 92 + (n % 8) * 4 : 100 + (n % 7) * 5;
    const damaged = n % 13 === 0 ? 1.5 : 0;
    const isRemnant = n === 9 || n === 32;
    const remaining = isRemnant ? 4.25 : received - damaged;
    return {
      id: deterministicUuid(`roll-${n}`),
      product_id: product.id,
      supplier_id: suppliers[n % suppliers.length].id,
      roll_no: `QA-R-${String(n).padStart(3, "0")}`,
      barcode: `889900${String(n).padStart(6, "0")}`,
      supplier_lot: `SUP-${String(Math.ceil(n / 5)).padStart(3, "0")}`,
      dye_lot: `DL-${String((productIndex % 3) + 1).padStart(2, "0")}`,
      shade: ["A", "B", "C"][productIndex % 3],
      width: productIndex % 4 === 0 ? 60 : 44,
      width_unit: "inch",
      length_unit: product.unit,
      received_length: received,
      remaining_length: remaining,
      reserved_length: 0,
      damaged_length: damaged,
      weight_kg: 18 + (n % 6),
      grade: n % 11 === 0 ? "B" : "A",
      rack_location: `R${(productIndex % 5) + 1}-B${rollIndex + 1}`,
      source_reference: FIXTURE_VERSION,
      status: n === 17 ? "quarantined" : isRemnant ? "opened" : "unopened",
      received_at: new Date(Date.UTC(2026, 6, 1 + (n % 24))).toISOString().slice(0, 10),
      notes: n === 17 ? "QA fixture: receiving inspection hold" : "LakBiz certification fixture",
      is_remnant: isRemnant,
      remnant_since: isRemnant ? "2026-08-01T00:00:00.000Z" : null,
      custody_status: "available",
    };
  }),
);

function fixtureSummary() {
  return {
    mode: apply ? "APPLY" : "DRY-RUN",
    organization: organizationName,
    fixture: FIXTURE_VERSION,
    products: products.length,
    rolls: rolls.length,
    metreRolls: rolls.filter((roll) => roll.length_unit === "metre").length,
    yardRolls: rolls.filter((roll) => roll.length_unit === "yard").length,
    dyeLots: new Set(rolls.map((roll) => roll.dye_lot)).size,
    remnants: rolls.filter((roll) => roll.is_remnant).length,
    quarantined: rolls.filter((roll) => roll.status === "quarantined").length,
    customers: customers.length,
    suppliers: suppliers.length,
  };
}

async function upsert(admin, table, rows, onConflict) {
  const { error } = await admin.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
}

async function main() {
  console.log(JSON.stringify(fixtureSummary(), null, 2));
  if (!apply) {
    console.log("Dry run only. No database rows were changed.");
    console.log("To apply, provide the production URL, service-role key, and the exact --confirm-organization-id value.");
    return;
  }

  if (!url || !serviceRole) {
    throw new Error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply");
  }
  assertLakBizTarget(url);
  if (!confirmedOrganizationId) throw new Error("--confirm-organization-id is required for --apply");

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: organizations, error: orgError } = await admin
    .from("organizations")
    .select("id,name,sector")
    .eq("name", organizationName);
  if (orgError) throw new Error(`Organization lookup failed: ${orgError.message}`);
  if ((organizations ?? []).length !== 1) {
    throw new Error(`Expected exactly one organization named ${organizationName}; found ${organizations?.length ?? 0}`);
  }
  const organization = organizations[0];
  if (organization.id !== confirmedOrganizationId) throw new Error("Confirmed organization ID does not match the live target");
  if (organization.sector !== "textile") throw new Error(`${organizationName} is not a Textile organization`);

  const { data: owners, error: ownerError } = await admin
    .from("org_members")
    .select("user_id,role")
    .eq("organization_id", organization.id)
    .eq("role", "owner");
  if (ownerError) throw new Error(`Owner lookup failed: ${ownerError.message}`);
  if ((owners ?? []).length !== 1) throw new Error("Certification target must have exactly one owner");
  const ownerId = owners[0].user_id;

  await upsert(admin, "suppliers", suppliers.map((row) => ({ ...row, organization_id: organization.id })), "id");
  await upsert(admin, "customers", customers.map((row) => ({ ...row, organization_id: organization.id })), "id");
  await upsert(admin, "products_base", products.map((row) => ({ ...row, organization_id: organization.id })), "id");
  await upsert(admin, "textile_settings", [{
    organization_id: organization.id,
    remnant_threshold: 5,
    reservation_hours: 48,
    updated_by: ownerId,
  }], "organization_id");
  await upsert(admin, "textile_customer_terms", customers.filter((row) => Number(row.credit_limit) > 0).map((row, index) => ({
    organization_id: organization.id,
    customer_id: row.id,
    payment_terms_days: [14, 30, 45][index % 3],
    credit_hold: false,
    hold_reason: null,
    collection_owner: ownerId,
    updated_by: ownerId,
  })), "customer_id");
  await upsert(admin, "textile_rolls", rolls.map((row) => ({
    ...row,
    organization_id: organization.id,
    created_by: ownerId,
  })), "id");
  await upsert(admin, "textile_roll_costs", rolls.map((roll, index) => ({
    roll_id: roll.id,
    organization_id: organization.id,
    unit_cost: 720 + index * 9,
    landed_unit_cost: 790 + index * 9,
  })), "roll_id");

  const stockByProduct = new Map();
  for (const roll of rolls) {
    if (roll.status === "quarantined") continue;
    stockByProduct.set(roll.product_id, (stockByProduct.get(roll.product_id) ?? 0) + roll.remaining_length);
  }
  for (const [id, stock] of stockByProduct) {
    const { error } = await admin
      .from("products_base")
      .update({ stock_qty: Number(stock.toFixed(3)) })
      .eq("organization_id", organization.id)
      .eq("id", id);
    if (error) throw new Error(`Product stock update failed for ${id}: ${error.message}`);
  }

  console.log("Textile certification fixture applied successfully.");
  console.log(JSON.stringify({ organizationId: organization.id, ...fixtureSummary() }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
