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

const client = new pg.Client({
  connectionString: connectionString(),
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log(`Connected to ${PROJECT_REF}. Applying ${files.length} migration(s)…`);

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`→ ${file}`);
    await client.query(sql);
  }

  const { rows } = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('plans','organizations','org_members','subscriptions','org_app_data')
    order by table_name
  `);

  console.log("LakBiz tables:", rows.map((r) => r.table_name).join(", ") || "(none)");
  console.log("Done.");
} finally {
  await client.end().catch(() => {});
}
