/**
 * Promote an existing auth user to LakBiz platform super-admin.
 *
 * Usage:
 *   cd app
 *   $env:SUPABASE_SERVICE_ROLE_KEY="..."
 *   $env:ADMIN_EMAIL="you@example.com"
 *   node scripts/seed-platform-admin.mjs
 */

import pg from "pg";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPABASE_DB_PASSWORD;
const projectRef = "zestppstpwjxriwcuykc";

if (!email) {
  console.error("Set ADMIN_EMAIL");
  process.exit(1);
}

const url =
  process.env.DATABASE_URL ??
  (password
    ? `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`
    : null);

if (!url) {
  console.error("Set DATABASE_URL or SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows } = await client.query(
  `select id from auth.users where lower(email) = lower($1) limit 1`,
  [email],
);

if (!rows[0]) {
  console.error(`No auth user for ${email}. Sign up once at /login first.`);
  await client.end();
  process.exit(1);
}

await client.query(
  `insert into public.platform_admins (user_id, email)
   values ($1, $2)
   on conflict (user_id) do update set email = excluded.email`,
  [rows[0].id, email],
);

console.log(`Platform admin granted to ${email}`);
console.log("Open /admin after signing in.");
await client.end();
