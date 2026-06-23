/**
 * Apply pending LakBiz SQL migrations via Supabase Management API.
 * Uses SUPABASE_ACCESS_TOKEN from app/.env.local (no DB password required).
 *
 * Usage: node scripts/apply-migrations-api.mjs
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_REF = "zestppstpwjxriwcuykc";
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
const migrationsDir = join(__dirname, "..", "..", "supabase", "migrations");

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

const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!accessToken) {
  console.error("Set SUPABASE_ACCESS_TOKEN in app/.env.local");
  process.exit(1);
}

async function runQuery(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${text}`);
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

await runQuery(`
  create table if not exists public.schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  );
`);

const appliedRows = await runQuery(
  "select filename from public.schema_migrations order by filename",
);
const applied = new Set(
  (Array.isArray(appliedRows) ? appliedRows : []).map((row) => row.filename),
);

let appliedCount = 0;
for (const file of files) {
  if (applied.has(file)) {
    console.log(`skip ${file}`);
    continue;
  }

  const sql = readFileSync(join(migrationsDir, file), "utf8");
  console.log(`→ ${file}`);
  await runQuery(sql);
  await runQuery(
    `insert into public.schema_migrations (filename) values ('${file.replace(/'/g, "''")}') on conflict do nothing`,
  );
  appliedCount += 1;
}

const plans = await runQuery(
  "select id, features->>'bulk_messaging' as bulk_messaging from public.plans order by id",
);

console.log("Plans bulk_messaging:", plans);
console.log(
  appliedCount === 0 ? "No new migrations." : `Applied ${appliedCount} migration(s).`,
);
console.log("Done.");
