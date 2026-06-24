/**
 * Print subscription for a shop owner email.
 * Usage: node scripts/check-shop-subscription.mjs admin@imt.com
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

const email = (process.argv[2] ?? "admin@imt.com").trim().toLowerCase();
const pwd = process.env.SUPABASE_DB_PASSWORD;
const ref = "zestppstpwjxriwcuykc";
const url =
  process.env.DATABASE_URL ??
  `postgresql://postgres.${ref}:${encodeURIComponent(pwd)}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`;

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows } = await client.query(
  `select o.name, o.id as org_id, s.plan_id, s.status, s.billing_cycle,
          s.trial_ends_at, p.features->>'bulk_messaging' as bulk_messaging
   from auth.users u
   join public.org_members m on m.user_id = u.id and m.role = 'owner'
   join public.organizations o on o.id = m.organization_id
   join public.subscriptions s on s.organization_id = o.id
   join public.plans p on p.id = s.plan_id
   where lower(u.email) = lower($1)`,
  [email],
);

console.log(JSON.stringify(rows, null, 2));
await client.end();
