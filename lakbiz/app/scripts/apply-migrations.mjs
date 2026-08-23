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

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  buildMigrationNameCounts,
  migrationAppliedBy,
} from "./migration-state.mjs";

const PROJECT_REF = "zestppstpwjxriwcuykc";
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

const migrationsDir = join(__dirname, "..", "..", "supabase", "migrations");

/** Renamed migrations — treat legacy filename as already applied. */
const LEGACY_ALIASES = {
  "20250617000003_ac_service_lifecycle.sql":
    "20250617000002_ac_service_lifecycle.sql",
  "20250617000004_repair_org_policies.sql":
    "20250617000002_repair_and_org_app_data.sql",
  "20250621000006_remove_payment_provider.sql":
    "20250621000005_remove_payment_provider.sql",
};

/** Removed migrations — no longer in repo but may exist in schema_migrations. */
const REMOVED_MIGRATIONS = new Set([
  "20250617000001_org_app_data.sql",
]);

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
const migrationNameCounts = buildMigrationNameCounts(files);

async function ensureMigrationTable(client) {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function loadNativeMigrationNames(client) {
  try {
    const { rows } = await client.query(`
      select name
      from supabase_migrations.schema_migrations
      where name is not null and name <> ''
    `);
    return new Set(rows.map((row) => String(row.name)));
  } catch (error) {
    console.warn(
      "Warning: could not read Supabase native migration history; using the custom filename ledger only.",
      error instanceof Error ? error.message : error,
    );
    return new Set();
  }
}

/**
 * Older LakBiz databases may already have schema but no custom filename
 * ledger. Never mark every repository file as applied: that can swallow a
 * genuinely new migration. Bootstrap only filenames that are independently
 * proven by Supabase's native migration history.
 */
async function bootstrapPriorMigrations(client, nativeMigrationNames) {
  const { rows } = await client.query(
    "select count(*)::int as n from public.schema_migrations",
  );
  if (rows[0].n > 0) return;

  const { rows: orgAppData } = await client.query(`
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'organizations'
    limit 1
  `);
  if (orgAppData.length === 0) return;

  let bootstrapped = 0;
  for (const file of files) {
    const reason = migrationAppliedBy(file, {
      nativeMigrationNames,
      migrationNameCounts,
      legacyAliases: LEGACY_ALIASES,
    });
    if (reason !== "native") continue;
    await client.query(
      "insert into public.schema_migrations (filename) values ($1) on conflict do nothing",
      [file],
    );
    bootstrapped += 1;
  }

  for (const removed of REMOVED_MIGRATIONS) {
    await client.query(
      "insert into public.schema_migrations (filename) values ($1) on conflict do nothing",
      [removed],
    );
  }

  if (bootstrapped > 0) {
    console.log(
      `Bootstrapped ${bootstrapped} migration filename(s) from Supabase native history.`,
    );
  } else {
    console.warn(
      "Existing LakBiz schema detected but no native migration names could prove repository files applied; no migration was auto-marked.",
    );
  }
}

async function recordLegacyAliases(client, filename) {
  const legacy = LEGACY_ALIASES[filename];
  if (!legacy) return;
  await client.query(
    "insert into public.schema_migrations (filename) values ($1) on conflict do nothing",
    [legacy],
  );
}

const client = new pg.Client({
  connectionString: connectionString(),
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log(`Connected to ${PROJECT_REF}.`);

  await ensureMigrationTable(client);
  const nativeMigrationNames = await loadNativeMigrationNames(client);
  await bootstrapPriorMigrations(client, nativeMigrationNames);

  const { rows: appliedRows } = await client.query(
    "select filename from public.schema_migrations",
  );
  const applied = new Set(appliedRows.map((row) => row.filename));

  let appliedCount = 0;
  for (const file of files) {
    const appliedBy = migrationAppliedBy(file, {
      appliedFilenames: applied,
      nativeMigrationNames,
      migrationNameCounts,
      legacyAliases: LEGACY_ALIASES,
    });
    if (appliedBy) {
      const suffix = appliedBy === "native" ? " (Supabase native history)" : "";
      console.log(`skip ${file}${suffix}`);
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
      await recordLegacyAliases(client, file);
      await client.query("commit");
      applied.add(file);
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
        'platform_admins', 'business_templates'
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
