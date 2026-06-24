/**
 * Test sales cloud write as a shop owner (simulates browser sync).
 * Usage: node scripts/test-sync-sales.mjs admin@imt.com <password>
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

const email = process.argv[2] ?? "admin@imt.com";
const password = process.argv[3] ?? "test";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const supabase = createClient(url, anon);
const { data: auth, error: signErr } = await supabase.auth.signInWithPassword({
  email,
  password,
});
if (signErr || !auth.user) {
  console.error("Sign in failed:", signErr?.message ?? "no user");
  process.exit(1);
}

const { data: member } = await supabase
  .from("org_members")
  .select("organization_id")
  .eq("user_id", auth.user.id)
  .maybeSingle();
const orgId = member?.organization_id;
console.log("org:", orgId);

const testId = crypto.randomUUID();
const row = {
  id: testId,
  organization_id: orgId,
  bill_no: "TEST-SYNC",
  sale_date: new Date().toISOString(),
  subtotal: 100,
  output_vat: 0,
  discount: 0,
  total: 100,
  profit: 20,
  payment_method: "cash",
  customer_name: "Sync test",
  credit_amount: 0,
};

console.log("insert via sales view...");
const ins = await supabase.from("sales").insert([row]);
console.log("insert:", ins.error?.message ?? "OK");

if (!ins.error) {
  const upd = await supabase.from("sales").update({ total: 101 }).eq("id", testId);
  console.log("update:", upd.error?.message ?? "OK");
  const del = await supabase.from("sales").delete().eq("id", testId);
  console.log("delete:", del.error?.message ?? "OK");
}

// Check table grants
const pwd = process.env.SUPABASE_DB_PASSWORD;
const ref = "zestppstpwjxriwcuykc";
const dbUrl = `postgresql://postgres.${ref}:${encodeURIComponent(pwd)}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`;
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
const grants = await client.query(
  `select grantee, privilege_type
   from information_schema.role_table_grants
   where table_schema='public' and table_name='sales_base' and grantee='authenticated'
   order by privilege_type`,
);
console.log("sales_base grants:", grants.rows);
await client.end();
