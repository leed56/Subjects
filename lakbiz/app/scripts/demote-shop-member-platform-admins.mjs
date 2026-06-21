/**
 * Remove platform_admins rows for users who belong to a shop (org_members).
 * Platform admins should use separate accounts from shop owners.
 *
 * Usage:
 *   cd app
 *   node scripts/demote-shop-member-platform-admins.mjs          # dry-run
 *   node scripts/demote-shop-member-platform-admins.mjs --apply  # execute
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

const apply = process.argv.includes("--apply");
const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error("Set SUPABASE_DB_PASSWORD in app/.env.local or the environment.");
  process.exit(1);
}

const projectRef = "zestppstpwjxriwcuykc";
const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL ??
    `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const { rows } = await client.query(`
  select pa.user_id, pa.email, o.name as shop_name, om.role
  from public.platform_admins pa
  join public.org_members om on om.user_id = pa.user_id
  join public.organizations o on o.id = om.organization_id
  order by pa.email
`);

if (rows.length === 0) {
  console.log("No platform admins are also shop members. Nothing to do.");
  await client.end();
  process.exit(0);
}

console.log(
  apply ? "Removing shop members from platform_admins:" : "Would remove (dry-run):",
);
for (const row of rows) {
  console.log(`  ${row.email} — ${row.role} of "${row.shop_name}"`);
}

if (!apply) {
  console.log("\nRe-run with --apply to execute.");
  await client.end();
  process.exit(0);
}

const { rowCount } = await client.query(`
  delete from public.platform_admins pa
  using public.org_members om
  where om.user_id = pa.user_id
`);

console.log(`\nRemoved ${rowCount} row(s).`);
await client.end();
