/**
 * Create or promote LakBiz platform super-admin(s).
 * Creates auth user if missing (email confirmed), then inserts platform_admins.
 *
 * Usage:
 *   cd app
 *   node scripts/create-platform-admin.mjs
 *
 * Env (reads app/.env.local automatically):
 *   SUPABASE_SERVICE_ROLE_KEY — required
 *   ADMIN_EMAIL — default: admin@lakbiz.lk
 *   ADMIN_PASSWORD — default: LakBiz@Admin2026 (change after first login)
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

const PROJECT_REF = "zestppstpwjxriwcuykc";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.ADMIN_EMAIL ?? "admin@lakbiz.lk").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "LakBiz@Admin2026";

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listData, error: listError } = await admin.auth.admin.listUsers({
  perPage: 1000,
});
if (listError) {
  console.error("Could not list users:", listError.message);
  process.exit(1);
}

let user = listData.users.find((u) => u.email?.toLowerCase() === email);

if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "platform_admin", created_by: "create-platform-admin script" },
  });
  if (error) {
    console.error("Could not create auth user:", error.message);
    process.exit(1);
  }
  user = data.user;
  console.log(`Created auth user: ${email}`);
} else {
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("Could not update user password:", error.message);
    process.exit(1);
  }
  console.log(`Auth user already exists: ${email} (password reset)`);
}

const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const dbUrl =
  process.env.DATABASE_URL ??
  (dbPassword
    ? `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(dbPassword)}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`
    : null);

if (!dbUrl) {
  console.error("Set SUPABASE_DB_PASSWORD to grant platform_admins row");
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query(
  `insert into public.platform_admins (user_id, email)
   values ($1, $2)
   on conflict (user_id) do update set email = excluded.email`,
  [user.id, email],
);

await client.end();

console.log("");
console.log("Platform admin ready:");
console.log(`  Email:    ${email}`);
console.log(`  Password: ${password}`);
console.log("  Login:    /login");
console.log("  Admin:    /admin");
console.log("");
console.log("Change the password after first login.");
