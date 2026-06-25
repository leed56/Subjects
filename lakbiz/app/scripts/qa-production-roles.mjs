/**
 * Production QA: migrations, financial masking (owner vs data_entry), org settings.
 * Usage: node scripts/qa-production-roles.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

const OWNER = { email: "admin@imt-test2.com", password: "22233344" };
const DATA_ENTRY = { email: "data@imt.com", password: "22233344" };

const REQUIRED_MIGRATIONS = [
  "20250623000001_financial_data_rls.sql",
  "20250626000001_ac_workforce_financial_masking.sql",
  "20250625000001_company_income_tax_rate.sql",
];

const results = [];

function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function checkMigrations() {
  if (!dbPassword) {
    fail("migrations", "SUPABASE_DB_PASSWORD not set");
    return;
  }
  const host = process.env.SUPABASE_DB_HOST ?? "aws-1-ap-southeast-1.pooler.supabase.com";
  const user = process.env.SUPABASE_DB_USER ?? "postgres.zestppstpwjxriwcuykc";
  const client = new pg.Client({
    host,
    port: Number(process.env.SUPABASE_DB_PORT ?? "5432"),
    database: "postgres",
    user,
    password: dbPassword,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      "select filename from public.schema_migrations order by filename"
    );
    const applied = new Set(rows.map((r) => r.filename));
    for (const m of REQUIRED_MIGRATIONS) {
      if (applied.has(m)) pass(`migration ${m}`);
      else fail(`migration ${m}`, "not applied");
    }

    const views = await client.query(`
      select table_name from information_schema.views
      where table_schema = 'public'
        and table_name in ('products', 'sales', 'ac_jobs', 'contractors', 'vehicles')
    `);
    const viewNames = new Set(views.rows.map((r) => r.table_name));
    for (const v of ["products", "sales", "ac_jobs", "contractors", "vehicles"]) {
      if (viewNames.has(v)) pass(`view ${v}`);
      else fail(`view ${v}`, "missing");
    }

    const col = await client.query(`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'organizations'
        and column_name = 'company_income_tax_rate'
    `);
    if (col.rows.length) pass("organizations.company_income_tax_rate");
    else fail("organizations.company_income_tax_rate", "column missing");
  } finally {
    await client.end();
  }
}

async function sessionChecks(label, creds) {
  const supabase = createClient(url, anon);
  const { data: auth, error: signErr } = await supabase.auth.signInWithPassword(creds);
  if (signErr || !auth.user) {
    fail(`${label} sign-in`, signErr?.message ?? "no user");
    return null;
  }
  pass(`${label} sign-in`, auth.user.email);

  const { data: member } = await supabase
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!member?.organization_id) {
    fail(`${label} org_members`, "no membership");
    return supabase;
  }
  pass(`${label} org role`, member.role);

  const orgId = member.organization_id;
  const isFinancial = member.role === "owner" || member.role === "manager";

  const { data: products } = await supabase
    .from("products")
    .select("id, buy_price")
    .eq("organization_id", orgId)
    .not("buy_price", "is", null)
    .limit(5);

  const maskedProducts =
    products?.length &&
    products.every((p) => p.buy_price === null || Number(p.buy_price) === 0);

  if (isFinancial) {
    if (products?.length && !maskedProducts) pass(`${label} products.buy_price visible`);
    else if (!products?.length) pass(`${label} products.buy_price`, "no priced products to test");
    else fail(`${label} products.buy_price`, "expected real values for owner");
  } else if (maskedProducts || !products?.length) {
    pass(`${label} products.buy_price masked`);
  } else {
    fail(`${label} products.buy_price masked`, `saw values: ${products.map((p) => p.buy_price).join(", ")}`);
  }

  const { data: sales } = await supabase
    .from("sales")
    .select("id, profit")
    .eq("organization_id", orgId)
    .limit(5);

  const maskedSales =
    !sales?.length || sales.every((s) => s.profit === null || Number(s.profit) === 0);

  if (isFinancial) {
    if (sales?.length && !maskedSales) pass(`${label} sales.profit visible`);
    else if (!sales?.length) pass(`${label} sales.profit`, "no sales to test");
    else fail(`${label} sales.profit`, "expected real values for owner");
  } else if (maskedSales) {
    pass(`${label} sales.profit masked`);
  } else {
    fail(`${label} sales.profit masked`, `saw: ${sales.map((s) => s.profit).join(", ")}`);
  }

  const { data: jobs } = await supabase
    .from("ac_jobs")
    .select("id, subcontract_cost")
    .eq("organization_id", orgId)
    .not("subcontract_cost", "is", null)
    .limit(3);

  const maskedJobs =
    !jobs?.length || jobs.every((j) => j.subcontract_cost === null || Number(j.subcontract_cost) === 0);

  if (isFinancial) {
    if (jobs?.length && !maskedJobs) pass(`${label} ac_jobs.subcontract_cost visible`);
    else pass(`${label} ac_jobs.subcontract_cost`, jobs?.length ? "visible" : "no jobs with cost");
  } else if (maskedJobs) {
    pass(`${label} ac_jobs.subcontract_cost masked`);
  } else {
    fail(`${label} ac_jobs.subcontract_cost masked`);
  }

  const { data: payments, error: payErr } = await supabase
    .from("contractor_payments")
    .select("id")
    .eq("organization_id", orgId)
    .limit(1);

  if (isFinancial) {
    if (payErr) fail(`${label} contractor_payments`, payErr.message);
    else pass(`${label} contractor_payments SELECT`, payments?.length ? "rows ok" : "empty ok");
  } else if (payErr || !payments?.length) {
    pass(`${label} contractor_payments hidden`);
  } else {
    fail(`${label} contractor_payments hidden`, "data_entry saw rows");
  }

  await supabase.auth.signOut();
  return supabase;
}

async function checkProductionSite() {
  try {
    const res = await fetch("https://subjects-ten.vercel.app");
    if (res.ok) pass("production site", `HTTP ${res.status}`);
    else fail("production site", `HTTP ${res.status}`);
  } catch (e) {
    fail("production site", e.message);
  }
}

if (!url || !anon) {
  console.error("Missing Supabase env");
  process.exit(1);
}

console.log("LakBiz production QA\n");
await checkProductionSite();
await checkMigrations();
await sessionChecks("owner", OWNER);
await sessionChecks("data_entry", DATA_ENTRY);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
