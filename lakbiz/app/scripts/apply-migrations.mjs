/**
 * Apply LakBiz SQL migrations to project zestppstpwjxriwcuykc.
 *
 * Requires the Postgres database password (NOT the anon/service API key):
 *   Supabase Dashboard → Project Settings → Database → Database password
 *
 * Usage (PowerShell):
 *   cd app
 *   $env:SUPABASE_DB_PASSWORD="your-db-password"
 *   node scripts/apply-migrations.mjs
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const PROJECT_REF = "zestppstpwjxriwcuykc";
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "..", "supabase", "migrations");

function connectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) {
    throw new Error(
      "Set SUPABASE_DB_PASSWORD or DATABASE_URL. API keys cannot run DDL migrations.",
    );
  }
  const host = process.env.SUPABASE_DB_HOST ?? "aws-1-ap-southeast-1.pooler.supabase.com";
  const port = process.env.SUPABASE_DB_PORT ?? "5432";
  const user = process.env.SUPABASE_DB_USER ?? `postgres.${PROJECT_REF}`;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

async function ensureMigrationTable(client) {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function bootstrapPriorMigrations(client) {
  const { rows } = await client.query(
    "select count(*)::int as n from public.schema_migrations",
  );
  if (rows[0].n > 0) return;

  const { rows: orgAppData } = await client.query(`
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'org_app_data'
    limit 1
  `);
  if (orgAppData.length === 0) return;

  for (const file of files) {
    if (file === "20250620000001_platform_admin.sql") continue;
    await client.query(
      "insert into public.schema_migrations (filename) values ($1) on conflict do nothing",
      [file],
    );
  }

  console.log("Bootstrapped prior migrations (schema already present).");
}

const client = new pg.Client({
  connectionString: connectionString(),
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log(`Connected to ${PROJECT_REF}.`);

  await ensureMigrationTable(client);
  await bootstrapPriorMigrations(client);

  const { rows: appliedRows } = await client.query(
    "select filename from public.schema_migrations",
  );
  const applied = new Set(appliedRows.map((row) => row.filename));

  let appliedCount = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip ${file}`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`→ ${file}`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations (filename) values ($1)",
        [file],
      );
      await client.query("commit");
      appliedCount += 1;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  const { rows: tables } = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'plans', 'organizations', 'org_members', 'subscriptions',
        'org_app_data', 'platform_admins', 'business_templates'
      )
    order by table_name
  `);

  const { rows: templates } = await client.query(
    "select count(*)::int as n from public.business_templates",
  );

  console.log(
    "LakBiz tables:",
    tables.map((row) => row.table_name).join(", ") || "(none)",
  );
  console.log(`Business templates: ${templates[0]?.n ?? 0}`);
  console.log(
    appliedCount === 0 ? "No new migrations." : `Applied ${appliedCount} migration(s).`,
  );
  console.log("Done.");
} finally {
  await client.end().catch(() => {});
}
