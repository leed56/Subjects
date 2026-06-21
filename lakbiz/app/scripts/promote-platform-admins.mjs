/**
 * Promote explicit users to platform_admins (never shop owners from provisioning).
 *
 * Usage:
 *   cd app
 *   $env:PLATFORM_ADMIN_EMAILS="admin1@example.com,admin2@example.com"
 *   node scripts/promote-platform-admins.mjs
 *
 * Resolves emails via auth.users; skips users who are shop members (org_members).
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

const emails = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

if (emails.length === 0) {
  console.error("Set PLATFORM_ADMIN_EMAILS=comma,separated,emails");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SUPABASE_DB_PASSWORD;

if (!url || !serviceKey || !password) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const projectRef = url.match(/https:\/\/([^.]+)\./)?.[1] ?? "zestppstpwjxriwcuykc";
const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ??
    `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

for (const email of emails) {
  const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = listData?.users?.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    console.warn(`Skip (no auth user): ${email}`);
    continue;
  }

  const { rows: members } = await client.query(
    "select 1 from public.org_members where user_id = $1 limit 1",
    [user.id],
  );
  if (members.length > 0) {
    console.warn(`Skip (shop member — use a separate admin account): ${email}`);
    continue;
  }

  await client.query(
    `insert into public.platform_admins (user_id, email)
     values ($1, $2)
     on conflict (user_id) do update set email = excluded.email`,
    [user.id, email],
  );
  console.log(`Promoted: ${email}`);
}

const { rows } = await client.query(
  "select email from public.platform_admins order by email",
);
console.log("\nAll platform admins:", rows.map((r) => r.email).join(", "));

await client.end();
