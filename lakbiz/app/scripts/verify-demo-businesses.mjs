#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { assertLakBizTarget } from "./demo-catalog/importer.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!url || !serviceRole) throw new Error("Supabase URL and service-role key are required");
assertLakBizTarget(url);

const specs = [
  {
    sector: "pharmacy",
    name: "LakBiz Pharmacy Demo",
    ownerEmail: process.env.DEMO_PHARMACY_EMAIL ?? "",
    ownerPassword: process.env.DEMO_PHARMACY_PASSWORD ?? "",
    cashierEmail: process.env.DEMO_PHARMACY_CASHIER_EMAIL ?? "",
    cashierPassword: process.env.DEMO_PHARMACY_CASHIER_PASSWORD ?? "",
    minProducts: 1000,
  },
  {
    sector: "grocery",
    name: "LakBiz Grocery Demo",
    ownerEmail: process.env.DEMO_GROCERY_EMAIL ?? "",
    ownerPassword: process.env.DEMO_GROCERY_PASSWORD ?? "",
    cashierEmail: process.env.DEMO_GROCERY_CASHIER_EMAIL ?? "",
    cashierPassword: process.env.DEMO_GROCERY_CASHIER_PASSWORD ?? "",
    minProducts: 1000,
  },
];

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function login(email, password) {
  const client = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session) throw new Error(`Demo role sign-in failed: ${error?.message ?? "no session"}`);
  return { client, userId: data.user.id };
}

async function maskedFinanceCheck(spec, orgId) {
  const owner = await login(spec.ownerEmail, spec.ownerPassword);
  const cashier = await login(spec.cashierEmail, spec.cashierPassword);
  try {
    const { data: ownerProducts, error: ownerProductError } = await owner.client
      .from("products")
      .select("id,buy_price,custom_fields")
      .eq("organization_id", orgId)
      .limit(100);
    if (ownerProductError) throw new Error(`Owner product view failed: ${ownerProductError.message}`);
    const ownerFinancialProduct = (ownerProducts ?? []).find((row) => Number(row.buy_price) > 0 && row.custom_fields?.costSource);
    assert(ownerFinancialProduct, `${spec.name}: owner could not see any expected cost/provenance row`);

    const { data: cashierProduct, error: cashierProductError } = await cashier.client
      .from("products")
      .select("id,buy_price,custom_fields")
      .eq("organization_id", orgId)
      .eq("id", ownerFinancialProduct.id)
      .single();
    if (cashierProductError) throw new Error(`Cashier product view failed: ${cashierProductError.message}`);
    assert(Number(cashierProduct.buy_price) === 0, `${spec.name}: cashier buy_price was not masked`);
    assert(!Object.prototype.hasOwnProperty.call(cashierProduct.custom_fields ?? {}, "costSource"), `${spec.name}: cashier leaked costSource`);
    assert(!Object.prototype.hasOwnProperty.call(cashierProduct.custom_fields ?? {}, "costIsSynthetic"), `${spec.name}: cashier leaked costIsSynthetic`);

    const { data: ownerSales, error: ownerSalesError } = await owner.client
      .from("sales")
      .select("id,profit")
      .eq("organization_id", orgId)
      .limit(20);
    if (ownerSalesError) throw new Error(`Owner sales view failed: ${ownerSalesError.message}`);
    const ownerProfitSale = (ownerSales ?? []).find((row) => Number(row.profit) > 0);
    assert(ownerProfitSale, `${spec.name}: owner could not see expected positive demo profit`);

    const { data: cashierSale, error: cashierSaleError } = await cashier.client
      .from("sales")
      .select("id,profit")
      .eq("organization_id", orgId)
      .eq("id", ownerProfitSale.id)
      .single();
    if (cashierSaleError) throw new Error(`Cashier sales view failed: ${cashierSaleError.message}`);
    assert(Number(cashierSale.profit) === 0, `${spec.name}: cashier profit was not masked`);

    return { ownerUserId: owner.userId, cashierUserId: cashier.userId, financeMasking: "passed" };
  } finally {
    await owner.client.auth.signOut();
    await cashier.client.auth.signOut();
  }
}

async function verifyShop(spec) {
  const { data: orgs, error: orgError } = await admin
    .from("organizations")
    .select("id,name,sector")
    .eq("name", spec.name);
  if (orgError) throw new Error(`${spec.name}: organization lookup failed: ${orgError.message}`);
  assert((orgs ?? []).length === 1, `${spec.name}: expected exactly one organization, found ${(orgs ?? []).length}`);
  const org = orgs[0];
  assert(org.sector === spec.sector, `${spec.name}: sector ${org.sector} != ${spec.sector}`);

  const [{ count: productCount, error: productCountError }, { data: members, error: memberError }] = await Promise.all([
    admin.from("products_base").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
    admin.from("org_members").select("user_id,role").eq("organization_id", org.id),
  ]);
  if (productCountError) throw new Error(`${spec.name}: product count failed: ${productCountError.message}`);
  if (memberError) throw new Error(`${spec.name}: member lookup failed: ${memberError.message}`);
  assert((productCount ?? 0) >= spec.minProducts, `${spec.name}: product count ${(productCount ?? 0)} below ${spec.minProducts}`);
  assert((members ?? []).filter((m) => m.role === "owner").length === 1, `${spec.name}: expected exactly one owner`);
  assert((members ?? []).filter((m) => m.role === "cashier").length === 1, `${spec.name}: expected exactly one cashier`);

  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: platformAdmins, error: platformAdminError } = await admin.from("platform_admins").select("user_id").in("user_id", memberIds);
  if (platformAdminError) throw new Error(`${spec.name}: platform-admin isolation lookup failed: ${platformAdminError.message}`);
  assert((platformAdmins ?? []).length === 0, `${spec.name}: a demo shop member is also a platform admin`);

  const { count: customerCount } = await admin.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", org.id);
  const { count: supplierCount } = await admin.from("suppliers").select("id", { count: "exact", head: true }).eq("organization_id", org.id);
  const { count: saleCount } = await admin.from("sales_base").select("id", { count: "exact", head: true }).eq("organization_id", org.id);
  const { count: purchaseCount } = await admin.from("purchases").select("id", { count: "exact", head: true }).eq("organization_id", org.id);
  assert((customerCount ?? 0) >= 3, `${spec.name}: missing demo customers`);
  assert((supplierCount ?? 0) >= 2, `${spec.name}: missing demo suppliers`);
  assert((saleCount ?? 0) >= 5, `${spec.name}: missing demo sale/payment history`);
  assert((purchaseCount ?? 0) >= 3, `${spec.name}: missing demo purchase history`);

  let pharmacyInventory = null;
  if (spec.sector === "pharmacy") {
    const { data: lots, error: lotError } = await admin
      .from("inventory_lots")
      .select("product_id,status,expiry_date,qty_on_hand")
      .eq("organization_id", org.id);
    if (lotError) throw new Error(`${spec.name}: lot verification failed: ${lotError.message}`);
    const statuses = new Map();
    const availableByProduct = new Map();
    for (const lot of lots ?? []) {
      statuses.set(lot.status, (statuses.get(lot.status) ?? 0) + 1);
      if (lot.status === "available" && Number(lot.qty_on_hand) > 0) {
        const current = availableByProduct.get(lot.product_id) ?? [];
        current.push(lot);
        availableByProduct.set(lot.product_id, current);
      }
    }
    assert((statuses.get("expired") ?? 0) >= 1, "Pharmacy demo: missing expired batch fixture");
    assert((statuses.get("quarantine") ?? 0) >= 1, "Pharmacy demo: missing quarantine batch fixture");
    const fefoPair = [...availableByProduct.values()].find((rows) => rows.length >= 2 && new Set(rows.map((r) => r.expiry_date)).size >= 2);
    assert(fefoPair, "Pharmacy demo: missing two-valid-lot FEFO fixture");
    pharmacyInventory = {
      lots: (lots ?? []).length,
      expired: statuses.get("expired") ?? 0,
      quarantine: statuses.get("quarantine") ?? 0,
      fefoFixture: "passed",
    };
  }

  const roleCheck = await maskedFinanceCheck(spec, org.id);
  return {
    organizationId: org.id,
    sector: org.sector,
    products: productCount,
    customers: customerCount,
    suppliers: supplierCount,
    sales: saleCount,
    purchases: purchaseCount,
    members: (members ?? []).map((m) => m.role).sort(),
    pharmacyInventory,
    ...roleCheck,
  };
}

const report = {};
for (const spec of specs) {
  for (const [label, value] of Object.entries({
    ownerEmail: spec.ownerEmail,
    ownerPassword: spec.ownerPassword,
    cashierEmail: spec.cashierEmail,
    cashierPassword: spec.cashierPassword,
  })) {
    if (!value) throw new Error(`${spec.name}: missing ${label} environment value`);
  }
  report[spec.sector] = await verifyShop(spec);
}

console.log("LakBiz live demo verification PASSED");
console.log(JSON.stringify(report, null, 2));
