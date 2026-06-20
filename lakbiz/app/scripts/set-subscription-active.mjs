/**
 * Mark a shop's subscription as active (ends the trial countdown).
 *
 * Usage (PowerShell):
 *   cd app
 *   $env:SHOP_EMAIL="ac@test.com"
 *   $env:SUPABASE_DB_PASSWORD="your-db-password"
 *   node scripts/set-subscription-active.mjs
 */

import pg from "pg";

const PROJECT_REF = "zestppstpwjxriwcuykc";
const email = process.env.SHOP_EMAIL;
if (!email) throw new Error("Set SHOP_EMAIL");

const url =
  process.env.DATABASE_URL ??
  `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(
    process.env.SUPABASE_DB_PASSWORD ?? "",
  )}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`;

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const { rows, rowCount } = await client.query(
  `update public.subscriptions s
     set status = 'active', trial_ends_at = null, updated_at = now()
     from public.org_members m
     join auth.users u on u.id = m.user_id
     where m.organization_id = s.organization_id
       and lower(u.email) = lower($1)
   returning s.organization_id, s.plan_id, s.status`,
  [email],
);

console.log(`Updated ${rowCount} subscription(s):`, JSON.stringify(rows));
await client.end();
