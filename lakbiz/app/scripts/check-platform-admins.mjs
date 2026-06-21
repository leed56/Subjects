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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
if (!dbPassword) {
  console.error("Set SUPABASE_DB_PASSWORD in app/.env.local or the environment.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 });
const authUsers = listData?.users ?? [];

console.log("=== AUTH USERS ===");
for (const u of authUsers.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""))) {
  console.log(`${u.email}\t${u.id}`);
}

const client = new pg.Client({
  connectionString: `postgresql://postgres.zestppstpwjxriwcuykc:${encodeURIComponent(dbPassword)}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows: paRows } = await client.query(
  "select user_id, email from platform_admins order by email",
);
console.log("\n=== PLATFORM_ADMINS ===");
for (const row of paRows) {
  const match = authUsers.find((u) => u.id === row.user_id);
  const ok = match ? "OK" : "MISSING AUTH USER";
  console.log(`${row.email}\t${row.user_id}\t${ok}`);
}

await client.end();
