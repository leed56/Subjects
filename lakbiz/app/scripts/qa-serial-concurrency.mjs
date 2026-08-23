#!/usr/bin/env node
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const expectedHost = "zestppstpwjxriwcuykc.supabase.co";

if (!url || !serviceRole) throw new Error("Supabase URL and service-role key are required");
const parsed = new URL(url);
if (parsed.hostname !== expectedHost) {
  throw new Error(`Refusing concurrency QA: expected ${expectedHost}, got ${parsed.hostname}`);
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runId = String(process.env.GITHUB_RUN_ID ?? Date.now()).replace(/[^0-9A-Za-z_-]/g, "");
const tag = `serial-race-${runId}`;
const ownerEmail = `qa-owner-${tag}@example.invalid`;
const cashierEmail = `qa-cashier-${tag}@example.invalid`;
const password = `${randomBytes(18).toString("base64url")}A9!`;
const productId = `qa:${tag}:product`;
const unitId = randomUUID();
const price = 1200;

let ownerUserId = null;
let cashierUserId = null;
let orgId = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function must(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function cleanup() {
  if (orgId) {
    const tables = [
      "inventory_allocations",
      "stock_logs",
      "sale_tender_sources",
      "sale_tenders",
      "sale_lines_base",
      "sales_base",
      "inventory_units",
      "product_inventory_profiles",
      "products_base",
      "org_members",
      "subscriptions",
    ];
    for (const table of tables) {
      const { error } = await admin.from(table).delete().eq("organization_id", orgId);
      if (error) console.warn(`QA cleanup warning (${table}): ${error.message}`);
    }
    const { error: orgError } = await admin.from("organizations").delete().eq("id", orgId);
    if (orgError) console.warn(`QA cleanup warning (organizations): ${orgError.message}`);
  }
  for (const userId of [cashierUserId, ownerUserId]) {
    if (!userId) continue;
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.warn(`QA cleanup warning (auth user): ${error.message}`);
  }
}

async function createQaUser(email, metadata) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error || !data.user) throw new Error(`QA Auth createUser failed: ${error?.message ?? "no user returned"}`);
  return data.user.id;
}

async function login(email) {
  const client = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`QA sign-in failed: ${error?.message ?? "no session"}`);
  return client;
}

async function finalize(client, saleId, tenderId) {
  return client.rpc("finalize_sale_with_private_tenders_v3", {
    p_organization_id: orgId,
    p_sale_id: saleId,
    p_customer_id: null,
    p_customer_name: "Concurrency QA",
    p_discount: 0,
    p_lines: [
      {
        product_id: productId,
        qty: 1,
        unit_price: price,
        line_order: 0,
        unit_ids: [unitId],
      },
    ],
    p_tenders: [
      {
        id: tenderId,
        kind: "cash",
        amount: price,
        note: "Disposable simultaneous last-serial QA",
      },
    ],
  });
}

try {
  console.log("LakBiz true two-client last-serial concurrency QA");
  console.log(`Target project: ${expectedHost}`);
  console.log(`Run tag: ${tag}`);

  ownerUserId = await createQaUser(ownerEmail, { lakbiz_qa: true, qa_type: "serial_concurrency_owner" });
  cashierUserId = await createQaUser(cashierEmail, { lakbiz_qa: true, qa_type: "serial_concurrency_cashier" });

  const periodEnd = new Date();
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
  const { data: provisionedOrg, error: provisionError } = await admin.rpc("provision_shop", {
    p_owner_id: ownerUserId,
    p_name: `LakBiz Concurrency QA ${runId}`,
    p_phone: null,
    p_sector: "mobile_shop",
    p_plan_id: "business",
    p_status: "active",
    p_trial_ends_at: null,
    p_period_end: periodEnd.toISOString(),
  });
  if (provisionError || !provisionedOrg) {
    throw new Error(`QA provision_shop failed: ${provisionError?.message ?? "no organization id"}`);
  }
  orgId = provisionedOrg;

  await must(
    admin.from("org_members").insert({ organization_id: orgId, user_id: cashierUserId, role: "cashier" }),
    "cashier membership insert",
  );

  await must(
    admin.from("products_base").insert({
      id: productId,
      organization_id: orgId,
      name: "QA Last IMEI Device",
      sku: `QA-IMEI-${runId}`,
      category: "Mobile Phones",
      sector_id: "mobile_shop",
      buy_price: 1000,
      sell_price: price,
      stock_qty: 1,
      reorder_level: 0,
      unit: "pcs",
      condition: "new",
      active: true,
      notes: "Disposable concurrency QA product; must be deleted after test.",
      custom_fields: { qaConcurrency: true, runId },
    }),
    "QA product insert",
  );

  await must(
    admin.from("product_inventory_profiles").insert({
      product_id: productId,
      organization_id: orgId,
      tracking_mode: "serial",
      variant_axes: [],
      fefo_enabled: false,
      require_serial_on_sale: true,
      allow_negative_stock: false,
    }),
    "QA inventory profile insert",
  );

  await must(
    admin.from("inventory_units").insert({
      id: unitId,
      organization_id: orgId,
      product_id: productId,
      serial_no: `QA-SERIAL-${runId}`,
      imei: `QA-IMEI-${runId}`,
      status: "available",
      notes: "Disposable last-serial concurrency fixture.",
    }),
    "QA serial unit insert",
  );

  const owner = await login(ownerEmail);
  const cashier = await login(cashierEmail);
  const saleA = `qa:${tag}:sale:a`;
  const saleB = `qa:${tag}:sale:b`;

  // Start both network requests before awaiting either result. These are two
  // independent authenticated Supabase clients/sessions racing the same unit.
  const requestA = finalize(owner, saleA, `qa:${tag}:tender:a`);
  const requestB = finalize(cashier, saleB, `qa:${tag}:tender:b`);
  const [resultA, resultB] = await Promise.all([requestA, requestB]);

  const results = [
    { label: "owner", saleId: saleA, data: resultA.data, error: resultA.error },
    { label: "cashier", saleId: saleB, data: resultB.data, error: resultB.error },
  ];
  const successes = results.filter((entry) => !entry.error && entry.data?.ok === true);
  const failures = results.filter((entry) => entry.error);

  assert(successes.length === 1, `Expected exactly one successful finalizer, got ${successes.length}`);
  assert(failures.length === 1, `Expected exactly one rejected finalizer, got ${failures.length}`);

  const winner = successes[0];
  const loser = failures[0];
  const loserText = `${loser.error?.message ?? ""} ${loser.error?.details ?? ""}`.toLowerCase();
  assert(
    loserText.includes("insufficient aggregate stock") || loserText.includes("no longer available"),
    `Losing transaction failed for an unexpected reason: ${loser.error?.message ?? "unknown"}`,
  );

  const product = await must(
    admin.from("products_base").select("stock_qty").eq("organization_id", orgId).eq("id", productId).single(),
    "post-race product read",
  );
  const unit = await must(
    admin.from("inventory_units").select("status,sale_id").eq("organization_id", orgId).eq("id", unitId).single(),
    "post-race serial read",
  );
  const sales = await must(
    admin.from("sales_base").select("id").eq("organization_id", orgId).in("id", [saleA, saleB]),
    "post-race sales read",
  );
  const tenders = await must(
    admin.from("sale_tenders").select("sale_id").eq("organization_id", orgId).in("sale_id", [saleA, saleB]),
    "post-race tenders read",
  );
  const allocations = await must(
    admin.from("inventory_allocations").select("reference_id,unit_id,qty").eq("organization_id", orgId).eq("unit_id", unitId),
    "post-race allocation read",
  );

  assert(Number(product.stock_qty) === 0, `Expected aggregate stock 0, got ${product.stock_qty}`);
  assert(unit.status === "sold", `Expected serialized unit sold, got ${unit.status}`);
  assert(unit.sale_id === winner.saleId, `Serialized unit points to ${unit.sale_id}, expected winning sale ${winner.saleId}`);
  assert((sales ?? []).length === 1 && sales[0].id === winner.saleId, "Losing transaction left a sale row behind");
  assert((tenders ?? []).length === 1 && tenders[0].sale_id === winner.saleId, "Losing transaction left a tender row behind");
  assert((allocations ?? []).length === 1 && allocations[0].reference_id === winner.saleId, "Expected exactly one serial allocation for the winning sale");

  console.log("CONCURRENCY_QA_PASSED");
  console.log(JSON.stringify({
    winnerRole: winner.label,
    loserRole: loser.label,
    loserCode: loser.error?.code ?? null,
    aggregateStock: Number(product.stock_qty),
    serialStatus: unit.status,
    persistedSales: sales.length,
    persistedTenders: tenders.length,
    persistedAllocations: allocations.length,
  }, null, 2));
} finally {
  await cleanup();
  console.log("Concurrency QA cleanup completed.");
}
