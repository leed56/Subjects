import { createHash } from "node:crypto";
import { stableHash, syntheticStock } from "./core.mjs";
import { buildDemoLotRows, ensureTrackedDemoStock } from "./lot-fixtures.mjs";

export const LAKBIZ_PROJECT_REF = "zestppstpwjxriwcuykc";
export const LAKBIZ_PROJECT_HOST = `${LAKBIZ_PROJECT_REF}.supabase.co`;

export function assertLakBizTarget(url) {
  const parsed = new URL(url);
  if (parsed.hostname !== LAKBIZ_PROJECT_HOST) {
    throw new Error(`Refusing demo import: expected ${LAKBIZ_PROJECT_HOST}, got ${parsed.hostname}`);
  }
}

export function chunk(rows, size = 200) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export function uuidFromSeed(seed) {
  const hex = createHash("sha256").update(String(seed)).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function daysFromNow(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return dateOnly(d);
}

function daysAgo(days) {
  return daysFromNow(-days);
}

export function shouldTrackLot(product) {
  if (product.productKind === "medicine") return true;
  if (product.department === "Wellness") return true;
  if (product.category === "Baby Nutrition") return true;
  return false;
}

export function productDbRow(orgId, sector, product) {
  const stockQty = syntheticStock(product.id);
  return {
    id: product.id,
    organization_id: orgId,
    name: product.productName,
    sku: `${product.source.toUpperCase()}-${stableHash(product.sourceProductId).toUpperCase()}`,
    category: product.category,
    sector_id: sector,
    buy_price: product.buyPrice ?? 0,
    sell_price: product.sellPrice ?? 0,
    stock_qty: stockQty,
    reorder_level: 5,
    unit: product.unit || "pcs",
    condition: "new",
    active: product.active !== false,
    notes: `DEMO catalog. Product facts sourced from ${product.source}; stock/history are synthetic demo data.`,
    custom_fields: {
      demoData: true,
      source: product.source,
      sourceUrl: product.sourceUrl,
      sourceProductId: product.sourceProductId,
      retrievedAt: product.retrievedAt,
      department: product.department,
      subcategory: product.subcategory,
      productKind: product.productKind,
      taxonomyMethod: product.taxonomyMethod,
      brand: product.brand,
      genericName: product.genericName,
      strength: product.strength,
      dosageForm: product.dosageForm,
      packSize: product.packSize,
      manufacturer: product.manufacturer,
      manufacturingCountry: product.manufacturingCountry,
      localAgent: product.localAgent,
      barcode: product.barcode,
      regulatoryRegistrationNumber: product.registrationNumber,
      regulatoryRegistrationDate: product.registrationDate,
      regulatoryValidity: product.registrationValidity,
      regulatorySchedule: product.regulatorySchedule,
      regulatorySourceStatus: product.regulatorySourceStatus,
      sourcePriceDate: product.sourcePriceDate,
      costSource: product.costSource,
      costIsSynthetic: product.costSource === "synthetic_demo",
      stockIsSynthetic: true,
    },
  };
}

export function inventoryProfileRow(orgId, product) {
  const lot = shouldTrackLot(product);
  return {
    product_id: product.id,
    organization_id: orgId,
    tracking_mode: lot ? "lot" : "simple",
    variant_axes: [],
    fefo_enabled: lot,
    require_serial_on_sale: false,
    allow_negative_stock: false,
  };
}

export function inventoryLotRow(orgId, product, index, stockQty) {
  const nearExpiry = index % 31 === 1;
  const expired = index === 0;
  const expiryDate = expired ? daysAgo(20) : nearExpiry ? daysFromNow(45) : daysFromNow(180 + (index % 540));
  const status = expired ? "expired" : "available";
  const batch = `DEMO-${stableHash(`${product.id}:batch`).toUpperCase()}`;
  return {
    id: uuidFromSeed(`${orgId}:${product.id}:demo-lot`),
    organization_id: orgId,
    product_id: product.id,
    variant_id: null,
    batch_no: batch,
    manufactured_date: daysAgo(180 + (index % 420)),
    expiry_date: expiryDate,
    received_date: daysAgo(20 + (index % 70)),
    supplier_id: null,
    qty_received: stockQty,
    qty_on_hand: stockQty,
    status,
    notes: expired
      ? "DEMO synthetic expired batch for expiry/quarantine workflow testing; batch/date are not source-derived."
      : nearExpiry
        ? "DEMO synthetic near-expiry batch for FEFO workflow testing; batch/date are not source-derived."
        : "DEMO synthetic batch/expiry. Product master provenance remains source-derived.",
  };
}

async function upsertChunks(client, table, rows, options = {}) {
  for (const batch of chunk(rows)) {
    const { error } = await client.from(table).upsert(batch, options);
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

async function findAuthUser(client, email) {
  let page = 1;
  while (page <= 10) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Auth listUsers failed: ${error.message}`);
    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
  }
  return null;
}

export async function ensureDemoShop(client, spec) {
  const { data: existingOrgs, error: orgError } = await client
    .from("organizations")
    .select("id,name,sector")
    .eq("name", spec.name);
  if (orgError) throw new Error(`organization lookup failed: ${orgError.message}`);
  if ((existingOrgs ?? []).length > 1) throw new Error(`Refusing import: duplicate organization name ${spec.name}`);
  if (existingOrgs?.[0]) {
    if (existingOrgs[0].sector !== spec.sector) throw new Error(`Existing ${spec.name} has sector ${existingOrgs[0].sector}, expected ${spec.sector}`);
    const { data: members, error: memberError } = await client.from("org_members").select("user_id,role").eq("organization_id", existingOrgs[0].id);
    if (memberError) throw new Error(`membership lookup failed: ${memberError.message}`);
    const ownerMember = (members ?? []).find((member) => member.role === "owner");
    if (!ownerMember) throw new Error(`Existing ${spec.name} has no owner; refusing to adopt it`);
    const configuredOwner = await findAuthUser(client, spec.ownerEmail);
    if (!configuredOwner || configuredOwner.id !== ownerMember.user_id) {
      throw new Error(`Existing ${spec.name} is not owned by configured demo owner ${spec.ownerEmail}; refusing to adopt it`);
    }
    const { data: adminRow, error: adminError } = await client.from("platform_admins").select("user_id").eq("user_id", configuredOwner.id).maybeSingle();
    if (adminError) throw new Error(`platform admin lookup failed: ${adminError.message}`);
    if (adminRow) throw new Error(`Refusing to use platform-admin identity ${spec.ownerEmail} as a shop owner`);
    return { orgId: existingOrgs[0].id, created: false, ownerUserId: configuredOwner.id };
  }

  const existingUser = await findAuthUser(client, spec.ownerEmail);
  if (existingUser) {
    const { data: memberships, error: membershipError } = await client.from("org_members").select("organization_id,role").eq("user_id", existingUser.id);
    if (membershipError) throw new Error(`owner membership lookup failed: ${membershipError.message}`);
    if ((memberships ?? []).length) throw new Error(`Owner email ${spec.ownerEmail} is already attached to another shop`);
    const { data: adminRow, error: adminError } = await client.from("platform_admins").select("user_id").eq("user_id", existingUser.id).maybeSingle();
    if (adminError) throw new Error(`platform admin lookup failed: ${adminError.message}`);
    if (adminRow) throw new Error(`Refusing to use platform-admin identity ${spec.ownerEmail} as a shop owner`);
  }

  let owner = existingUser;
  let createdAuthUser = false;
  if (!owner) {
    const { data, error } = await client.auth.admin.createUser({
      email: spec.ownerEmail,
      password: spec.ownerPassword,
      email_confirm: true,
      user_metadata: { full_name: spec.name, lakbiz_demo: true, sector: spec.sector },
    });
    if (error || !data.user) throw new Error(`Auth createUser failed for ${spec.ownerEmail}: ${error?.message ?? "no user returned"}`);
    owner = data.user;
    createdAuthUser = true;
  }

  try {
    const end = new Date();
    end.setUTCFullYear(end.getUTCFullYear() + 10);
    const { data: orgId, error } = await client.rpc("provision_shop", {
      p_owner_id: owner.id,
      p_name: spec.name,
      p_phone: spec.phone ?? null,
      p_sector: spec.sector,
      p_plan_id: "business",
      p_status: "active",
      p_trial_ends_at: null,
      p_period_end: end.toISOString(),
    });
    if (error || !orgId) throw new Error(error?.message ?? "provision_shop returned no organization id");
    return { orgId, created: true, ownerUserId: owner.id };
  } catch (error) {
    if (createdAuthUser) await client.auth.admin.deleteUser(owner.id);
    throw error;
  }
}

export async function ensureDemoStaff(client, spec) {
  let user = await findAuthUser(client, spec.email);
  let createdAuthUser = false;

  if (user) {
    const { data: adminRow, error: adminError } = await client.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminError) throw new Error(`platform admin lookup failed: ${adminError.message}`);
    if (adminRow) throw new Error(`Refusing to use platform-admin identity ${spec.email} as demo staff`);

    const { data: memberships, error: membershipError } = await client
      .from("org_members")
      .select("organization_id,role")
      .eq("user_id", user.id);
    if (membershipError) throw new Error(`staff membership lookup failed: ${membershipError.message}`);
    if ((memberships ?? []).length) {
      const membership = memberships[0];
      if (membership.organization_id !== spec.orgId || membership.role !== spec.role) {
        throw new Error(`Demo staff ${spec.email} is already attached to another shop/role`);
      }
      return { userId: user.id, created: false, role: spec.role };
    }
  }

  if (!user) {
    const { data, error } = await client.auth.admin.createUser({
      email: spec.email,
      password: spec.password,
      email_confirm: true,
      user_metadata: { full_name: spec.displayName, lakbiz_demo: true, demo_role: spec.role },
    });
    if (error || !data.user) throw new Error(`Auth createUser failed for ${spec.email}: ${error?.message ?? "no user returned"}`);
    user = data.user;
    createdAuthUser = true;
  }

  try {
    const { error } = await client.from("org_members").insert({
      organization_id: spec.orgId,
      user_id: user.id,
      role: spec.role,
    });
    if (error) throw new Error(`org_members insert failed for ${spec.email}: ${error.message}`);
    return { userId: user.id, created: true, role: spec.role };
  } catch (error) {
    if (createdAuthUser) await client.auth.admin.deleteUser(user.id);
    throw error;
  }
}

export async function importCatalog(client, orgId, sector, products) {
  const rows = products.map((product) => productDbRow(orgId, sector, product));
  const tracked = sector === "pharmacy" ? products.filter(shouldTrackLot) : [];
  const trackedIndexById = new Map(tracked.map((product, index) => [product.id, index]));

  // Keep the first three pharmacy workflow fixtures well-stocked enough to
  // demonstrate expired+valid, FEFO near+later, and quarantine+valid lots.
  for (const row of rows) {
    const trackedIndex = trackedIndexById.get(row.id);
    if (trackedIndex != null) row.stock_qty = ensureTrackedDemoStock(row.stock_qty, trackedIndex);
  }

  await upsertChunks(client, "products_base", rows, { onConflict: "id" });

  let lotRows = 0;
  if (sector === "pharmacy") {
    const profiles = products.map((product) => inventoryProfileRow(orgId, product));
    await upsertChunks(client, "product_inventory_profiles", profiles, { onConflict: "product_id" });

    const rowById = new Map(rows.map((row) => [row.id, row]));
    const lots = tracked.flatMap((product, index) =>
      buildDemoLotRows(orgId, product, index, rowById.get(product.id)?.stock_qty ?? 0),
    );
    await upsertChunks(client, "inventory_lots", lots, { onConflict: "id" });
    lotRows = lots.length;
  }

  return { products: rows.length, trackedProducts: tracked.length, trackedLots: lotRows };
}

function demoCustomers(orgId, sector) {
  const prefix = `demo:${sector}`;
  return [
    { id: `${prefix}:customer:1`, organization_id: orgId, name: "Demo Customer - Nimal Perera", phone: "0770000101", address: "Colombo, Sri Lanka", credit_balance: 0, credit_limit: 25000, contact_type: "individual" },
    { id: `${prefix}:customer:2`, organization_id: orgId, name: "Demo Customer - Fathima Ameen", phone: "0770000102", address: "Dehiwala, Sri Lanka", credit_balance: 0, credit_limit: 15000, contact_type: "individual" },
    { id: `${prefix}:customer:3`, organization_id: orgId, name: "DEMO Corporate Customer", phone: "0110000103", address: "Colombo, Sri Lanka", credit_balance: 0, credit_limit: 50000, contact_type: "company", contact_person: "Demo Contact" },
  ];
}

function demoSuppliers(orgId, sector) {
  const prefix = `demo:${sector}`;
  if (sector === "pharmacy") {
    return [
      { id: `${prefix}:supplier:spc`, organization_id: orgId, name: "State Pharmaceuticals Corporation", address: "Colombo, Sri Lanka", payable_balance: 0, contact_person: "DEMO reference supplier" },
      { id: `${prefix}:supplier:wholesale`, organization_id: orgId, name: "DEMO Health & Wellness Distributor (Synthetic)", address: "Colombo, Sri Lanka", payable_balance: 0, contact_person: "Synthetic demo supplier" },
    ];
  }
  return [
    { id: `${prefix}:supplier:fmcg`, organization_id: orgId, name: "DEMO FMCG Distributor (Synthetic)", address: "Colombo, Sri Lanka", payable_balance: 0, contact_person: "Synthetic demo supplier" },
    { id: `${prefix}:supplier:fresh`, organization_id: orgId, name: "DEMO Fresh Produce Supplier (Synthetic)", address: "Sri Lanka", payable_balance: 0, contact_person: "Synthetic demo supplier" },
  ];
}

function saleDate(daysBack) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysBack);
  d.setUTCHours(10, 30, 0, 0);
  return d.toISOString();
}

export async function seedDemoHistory(client, orgId, sector, products) {
  const customers = demoCustomers(orgId, sector);
  const suppliers = demoSuppliers(orgId, sector);
  await upsertChunks(client, "customers", customers, { onConflict: "id" });
  await upsertChunks(client, "suppliers", suppliers, { onConflict: "id" });

  const saleable = products.filter((product) => !shouldTrackLot(product) && Number(product.sellPrice) > 0).slice(0, 12);
  const purchasable = products.filter((product) => Number(product.buyPrice) > 0).slice(0, 12);
  if (saleable.length < 4 || purchasable.length < 4) {
    return { customers: customers.length, suppliers: suppliers.length, purchases: 0, sales: 0 };
  }

  const purchases = [];
  const purchaseLines = [];
  for (let p = 0; p < 3; p += 1) {
    const selected = purchasable.slice(p * 3, p * 3 + 3);
    const total = selected.reduce((sum, product) => sum + Number(product.buyPrice || 0) * 12, 0);
    const id = `demo:${sector}:purchase:${p + 1}`;
    const supplier = suppliers[p % suppliers.length];
    purchases.push({ id, organization_id: orgId, grn_no: `DEMO-GRN-${String(p + 1).padStart(3, "0")}`, purchase_date: saleDate(25 - p * 5), supplier_id: supplier.id, supplier_name: supplier.name, subtotal: total, input_vat: 0, total, payment_method: p === 2 ? "credit" : "cash", credit_amount: p === 2 ? total : 0, note: "Synthetic demo purchase history; product/cost provenance remains in product master." });
    selected.forEach((product, index) => purchaseLines.push({ id: uuidFromSeed(`${id}:${product.id}`), purchase_id: id, organization_id: orgId, product_id: product.id, product_name: product.productName, qty: 12, unit_cost: product.buyPrice || 0, line_order: index }));
  }
  // Keep supplier liability consistent with the synthetic credit purchases.
  for (const purchase of purchases) {
    if (Number(purchase.credit_amount) <= 0 || !purchase.supplier_id) continue;
    const supplier = suppliers.find((row) => row.id === purchase.supplier_id);
    if (supplier) supplier.payable_balance = Number(supplier.payable_balance || 0) + Number(purchase.credit_amount);
  }

  await upsertChunks(client, "purchases", purchases, { onConflict: "id" });
  await upsertChunks(client, "purchase_lines", purchaseLines, { onConflict: "id" });
  await upsertChunks(client, "suppliers", suppliers, { onConflict: "id" });

  let bankAccount = null;
  if (sector === "pharmacy") {
    bankAccount = {
      id: `demo:${sector}:bank:1`, organization_id: orgId, bank_name: "Commercial Bank of Ceylon - DEMO",
      branch: "Colombo (Synthetic demo)", account_name: "LakBiz Pharmacy Demo", account_number: "DEMO-000001", balance: 125000,
    };
    await upsertChunks(client, "bank_accounts", [bankAccount], { onConflict: "id" });
  }

  const methods = ["cash", "card", "credit", "bank_transfer", "cheque"];
  const sales = [];
  const lines = [];
  const tenders = [];
  const tenderSources = [];
  const cheques = [];
  const bankTransactions = [];
  if (bankAccount) {
    bankTransactions.push({
      id: `demo:${sector}:banktxn:opening`,
      organization_id: orgId,
      account_id: bankAccount.id,
      type: "adjustment",
      amount: 125000,
      description: "Synthetic demo opening bank balance",
      reference: "DEMO-OPENING",
      txn_date: daysAgo(30),
    });
  }

  for (let s = 0; s < methods.length; s += 1) {
    const method = methods[s];
    const productA = saleable[(s * 2) % saleable.length];
    const productB = saleable[(s * 2 + 1) % saleable.length];
    const customer = customers[s % customers.length];
    const saleId = `demo:${sector}:sale:${s + 1}`;
    const totalA = Number(productA.sellPrice) * 2;
    const totalB = Number(productB.sellPrice);
    const total = Math.round((totalA + totalB) * 100) / 100;
    const cost = Number(productA.buyPrice || 0) * 2 + Number(productB.buyPrice || 0);
    const profit = Math.round((total - cost) * 100) / 100;
    const chequeId = method === "cheque" ? `demo:${sector}:cheque:${s + 1}` : null;
    sales.push({ id: saleId, organization_id: orgId, bill_no: `DEMO-${sector === "pharmacy" ? "PH" : "GR"}-${String(s + 1).padStart(4, "0")}`, sale_date: saleDate(12 - s * 2), subtotal: total, output_vat: 0, total, profit, payment_method: method, customer_id: method === "cash" ? null : customer.id, customer_name: method === "cash" ? "Walk-in Customer" : customer.name, credit_amount: method === "credit" ? total : 0, cheque_id: chequeId, discount: 0 });
    [productA, productB].forEach((product, index) => lines.push({ id: uuidFromSeed(`${saleId}:${index}`), sale_id: saleId, organization_id: orgId, product_id: product.id, product_name: product.productName, qty: index === 0 ? 2 : 1, unit_price: product.sellPrice || 0, buy_price: product.buyPrice || 0, line_order: index }));
    const tenderId = `demo:${sector}:tender:${s + 1}`;
    tenders.push({ id: tenderId, organization_id: orgId, sale_id: saleId, kind: method, amount: total, note: "Synthetic demo payment history", created_by: null, created_at: saleDate(12 - s * 2) });

    if (method === "cheque") {
      cheques.push({ id: chequeId, organization_id: orgId, direction: "received", cheque_no: `DEMO${1000 + s}`, bank_name: "DEMO Bank", party_name: customer.name, customer_id: customer.id, amount: total, cheque_date: daysFromNow(14), post_dated: true, status: "pending", linked_sale_id: saleId, bank_account_id: null, note: "Synthetic demo cheque" });
      tenderSources.push({ tender_id: tenderId, organization_id: orgId, bank_account_id: null, cheque_id: chequeId, return_id: null });
    }
    if (method === "bank_transfer" && bankAccount) {
      tenderSources.push({ tender_id: tenderId, organization_id: orgId, bank_account_id: bankAccount.id, cheque_id: null, return_id: null });
      bankTransactions.push({ id: `demo:${sector}:banktxn:${s + 1}`, organization_id: orgId, account_id: bankAccount.id, type: "deposit", amount: total, description: "Synthetic demo POS transfer", reference: sales[s].bill_no, txn_date: daysAgo(12 - s * 2) });
    }
    if (method === "credit") customer.credit_balance = total;
  }

  if (bankAccount) {
    bankAccount.balance = bankTransactions.reduce((balance, transaction) => {
      const amount = Number(transaction.amount || 0);
      return ["withdrawal", "fee"].includes(transaction.type) ? balance - amount : balance + amount;
    }, 0);
    await upsertChunks(client, "bank_accounts", [bankAccount], { onConflict: "id" });
  }

  await upsertChunks(client, "sales_base", sales, { onConflict: "id" });
  await upsertChunks(client, "sale_lines_base", lines, { onConflict: "id" });
  await upsertChunks(client, "sale_tenders", tenders, { onConflict: "id" });
  if (cheques.length) await upsertChunks(client, "cheques", cheques, { onConflict: "id" });
  if (tenderSources.length) await upsertChunks(client, "sale_tender_sources", tenderSources, { onConflict: "tender_id" });
  if (bankTransactions.length) await upsertChunks(client, "bank_transactions", bankTransactions, { onConflict: "id" });
  await upsertChunks(client, "customers", customers, { onConflict: "id" });

  const logs = saleable.slice(0, 8).map((product, index) => ({
    id: `demo:${sector}:stocklog:${index + 1}`,
    organization_id: orgId,
    product_id: product.id,
    product_name: product.productName,
    log_type: index % 2 ? "sale" : "purchase",
    qty: index % 2 ? -1 : 12,
    note: "Synthetic demo stock-history event; current stock is a seeded snapshot and is not recalculated from this log.",
    log_date: saleDate(20 - index),
    related_supplier_id: index % 2 ? null : suppliers[0].id,
    user_id: null,
  }));
  await upsertChunks(client, "stock_logs", logs, { onConflict: "id" });

  return { customers: customers.length, suppliers: suppliers.length, purchases: purchases.length, sales: sales.length };
}
