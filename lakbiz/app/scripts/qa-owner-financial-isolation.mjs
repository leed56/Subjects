/**
 * Production-safe financial isolation QA.
 *
 * Verifies LakBiz's absolute rule: only the organization OWNER may read
 * internal financial data. It performs read-only checks only — no production
 * data is modified.
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Credentials are intentionally supplied by env instead of being committed:
 *   QA_OWNER_EMAIL / QA_OWNER_PASSWORD
 *   QA_MANAGER_EMAIL / QA_MANAGER_PASSWORD
 *   QA_DATA_ENTRY_EMAIL / QA_DATA_ENTRY_PASSWORD
 *   QA_CASHIER_EMAIL / QA_CASHIER_PASSWORD
 *   QA_TECHNICIAN_EMAIL / QA_TECHNICIAN_PASSWORD
 *
 * Run:
 *   node scripts/qa-owner-financial-isolation.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const ROLE_CASES = [
  ["owner", "QA_OWNER_EMAIL", "QA_OWNER_PASSWORD"],
  ["manager", "QA_MANAGER_EMAIL", "QA_MANAGER_PASSWORD"],
  ["data_entry", "QA_DATA_ENTRY_EMAIL", "QA_DATA_ENTRY_PASSWORD"],
  ["cashier", "QA_CASHIER_EMAIL", "QA_CASHIER_PASSWORD"],
  ["technician", "QA_TECHNICIAN_EMAIL", "QA_TECHNICIAN_PASSWORD"],
];

let failures = 0;
const pass = (label, detail = "") => console.log(`PASS  ${label}${detail ? ` — ${detail}` : ""}`);
const fail = (label, detail = "") => {
  failures += 1;
  console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
};
const skipped = (label, detail = "") => console.log(`SKIP  ${label}${detail ? ` — ${detail}` : ""}`);

function maskedNumber(value) {
  return value == null || Number(value) === 0;
}

async function checkRole(expectedRole, email, password) {
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: signError } = await supabase.auth.signInWithPassword({ email, password });
  if (signError || !auth.user) {
    fail(`${expectedRole} sign-in`, signError?.message ?? "no user");
    return;
  }

  const { data: membership, error: memberError } = await supabase
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (memberError || !membership?.organization_id) {
    fail(`${expectedRole} membership`, memberError?.message ?? "no org membership");
    await supabase.auth.signOut();
    return;
  }
  if (membership.role !== expectedRole) {
    fail(`${expectedRole} role`, `account is ${membership.role}`);
    await supabase.auth.signOut();
    return;
  }
  pass(`${expectedRole} role`);

  const orgId = membership.organization_id;
  const shouldSeeMoney = expectedRole === "owner";

  const { data: capability, error: capabilityError } = await supabase.rpc(
    "can_see_org_financials",
    { org_id: orgId },
  );
  if (capabilityError) {
    fail(`${expectedRole} can_see_org_financials`, capabilityError.message);
  } else if (Boolean(capability) === shouldSeeMoney) {
    pass(`${expectedRole} financial capability`, String(Boolean(capability)));
  } else {
    fail(`${expectedRole} financial capability`, `expected ${shouldSeeMoney}, got ${Boolean(capability)}`);
  }

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, buy_price")
    .eq("organization_id", orgId)
    .limit(25);
  if (productsError) {
    fail(`${expectedRole} products read`, productsError.message);
  } else if (!shouldSeeMoney && (products ?? []).every((row) => maskedNumber(row.buy_price))) {
    pass(`${expectedRole} product buy cost masked`);
  } else if (shouldSeeMoney) {
    pass(`${expectedRole} product view reachable`, `${products?.length ?? 0} rows sampled`);
  } else {
    fail(`${expectedRole} product buy cost masked`, "non-zero buy_price returned");
  }

  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("id, profit")
    .eq("organization_id", orgId)
    .limit(25);
  if (salesError) {
    fail(`${expectedRole} sales read`, salesError.message);
  } else if (!shouldSeeMoney && (sales ?? []).every((row) => maskedNumber(row.profit))) {
    pass(`${expectedRole} sales profit masked`);
  } else if (shouldSeeMoney) {
    pass(`${expectedRole} sales view reachable`, `${sales?.length ?? 0} rows sampled`);
  } else {
    fail(`${expectedRole} sales profit masked`, "non-zero profit returned");
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("ac_jobs")
    .select("id, quoted_amount, deposit_amount, subcontract_cost")
    .eq("organization_id", orgId)
    .limit(25);
  if (jobsError) {
    fail(`${expectedRole} jobs read`, jobsError.message);
  } else if (!shouldSeeMoney && (jobs ?? []).every((row) =>
    maskedNumber(row.quoted_amount) &&
    maskedNumber(row.deposit_amount) &&
    maskedNumber(row.subcontract_cost)
  )) {
    pass(`${expectedRole} job money masked`);
  } else if (shouldSeeMoney) {
    pass(`${expectedRole} job financial view reachable`, `${jobs?.length ?? 0} rows sampled`);
  } else {
    fail(`${expectedRole} job money masked`, "quote/deposit/subcontract value leaked");
  }

  // Full-row owner ledgers: RLS should make them empty/unreadable to every
  // non-owner. An empty table alone cannot prove RLS, so the RPC capability
  // check above remains the authoritative assertion; these are regression
  // checks for accidental row exposure when the org does contain records.
  for (const table of ["purchases", "purchase_orders", "supplier_payments", "bank_accounts", "expenses", "contractor_payments"]) {
    const { data, error } = await supabase.from(table).select("*").eq("organization_id", orgId).limit(1);
    if (shouldSeeMoney) {
      if (error) fail(`${expectedRole} ${table}`, error.message);
      else pass(`${expectedRole} ${table} reachable`);
    } else if (error || !data?.length) {
      pass(`${expectedRole} ${table} hidden`);
    } else {
      fail(`${expectedRole} ${table} hidden`, "row returned to non-owner");
    }
  }

  await supabase.auth.signOut();
}

console.log("LakBiz owner-only financial isolation QA\n");
for (const [role, emailKey, passwordKey] of ROLE_CASES) {
  const email = process.env[emailKey];
  const password = process.env[passwordKey];
  if (!email || !password) {
    skipped(role, `${emailKey}/${passwordKey} not configured`);
    continue;
  }
  await checkRole(role, email, password);
}

console.log(`\n${failures ? `${failures} failure(s)` : "All configured role checks passed"}.`);
process.exit(failures ? 1 : 0);
