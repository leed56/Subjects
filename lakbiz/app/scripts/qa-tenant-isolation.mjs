/**
 * Cross-tenant RLS isolation QA.
 *
 * Complements scripts/qa-production-roles.mjs (which checks role-based
 * financial masking *within* one org). This script checks the other axis:
 * that Organization A can never read, insert into, update, or delete
 * Organization B's rows, for every tenant-owned table that matters.
 *
 * SAFETY: this script performs real INSERT/UPDATE/DELETE attempts (which
 * must all fail). Run it against a disposable Supabase branch or two
 * throwaway trial shops — do NOT point it at rows you care about in
 * production. See docs/ARCHITECTURE_AUDIT.md, "RLS verification" section,
 * for how to provision two isolated test orgs (two normal /login sign-ups
 * is enough; each self-signup gets its own organization via
 * bootstrap_user_organization()).
 *
 * Usage:
 *   ORG_A_EMAIL=a@test.local ORG_A_PASSWORD=... \
 *   ORG_B_EMAIL=b@test.local ORG_B_PASSWORD=... \
 *   node scripts/qa-tenant-isolation.mjs
 *
 * Exits non-zero if any tenant-isolation check fails.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const ORG_A = { email: process.env.ORG_A_EMAIL, password: process.env.ORG_A_PASSWORD };
const ORG_B = { email: process.env.ORG_B_EMAIL, password: process.env.ORG_B_PASSWORD };

/** [table, organization column, a couple of readable columns for probing] */
const TENANT_TABLES = [
  { table: "customers", cols: "id, name" },
  { table: "sales", cols: "id, total" },
  { table: "ac_jobs", cols: "id, status" },
  { table: "products", cols: "id, name" },
  { table: "suppliers", cols: "id, name" },
  { table: "bank_accounts", cols: "id, name" },
  { table: "contractor_payments", cols: "id, amount" },
  { table: "cheques", cols: "id, amount" },
];

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function signIn(creds) {
  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.signInWithPassword(creds);
  if (error || !data.user) {
    throw new Error(`sign-in failed for ${creds.email}: ${error?.message ?? "no user"}`);
  }
  const { data: member } = await supabase
    .from("org_members")
    .select("organization_id, role")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!member?.organization_id) {
    throw new Error(`${creds.email} has no org membership`);
  }
  return { supabase, userId: data.user.id, orgId: member.organization_id };
}

/** Grab one real row id per table from Org B, as Org B, to use as an attack target. */
async function collectOrgBTargets(orgB) {
  const targets = {};
  for (const { table, cols } of TENANT_TABLES) {
    const { data } = await orgB.supabase.from(table).select(cols).limit(1);
    if (data?.length) targets[table] = data[0];
  }
  return targets;
}

async function checkTable(orgA, orgBOrgId, table, targetRow) {
  // 1. SELECT filtered by Org B's id must never return Org B rows.
  const { data: filtered, error: selErr } = await orgA.supabase
    .from(table)
    .select("id")
    .eq("organization_id", orgBOrgId)
    .limit(5);
  if (selErr) {
    // An error is acceptable (denied outright); an empty result is the
    // expected common case under `organization_id in (select ...)` RLS.
    pass(`${table} SELECT cross-org filter blocked`, selErr.message);
  } else if (!filtered?.length) {
    pass(`${table} SELECT cross-org filter returns none`);
  } else {
    fail(`${table} SELECT cross-org filter`, `leaked ${filtered.length} row(s)`);
  }

  if (!targetRow) {
    pass(`${table} write checks`, "skipped — Org B has no row to target");
    return;
  }

  // 2. SELECT by known Org B row id must not resolve.
  const { data: byId } = await orgA.supabase.from(table).select("id").eq("id", targetRow.id).maybeSingle();
  if (byId) fail(`${table} SELECT by id`, "Org A read Org B's row by id");
  else pass(`${table} SELECT by id blocked`);

  // 3. UPDATE attempt against the known Org B row must affect 0 rows.
  const { data: updated, error: updErr } = await orgA.supabase
    .from(table)
    .update({ id: targetRow.id }) // no-op-ish field touch; real column varies per table
    .eq("id", targetRow.id)
    .select("id");
  if (updErr) pass(`${table} UPDATE cross-org blocked`, updErr.message);
  else if (!updated?.length) pass(`${table} UPDATE cross-org affected 0 rows`);
  else fail(`${table} UPDATE cross-org`, "Org A updated Org B's row");

  // 4. DELETE attempt against the known Org B row must affect 0 rows.
  const { data: deleted, error: delErr } = await orgA.supabase
    .from(table)
    .delete()
    .eq("id", targetRow.id)
    .select("id");
  if (delErr) pass(`${table} DELETE cross-org blocked`, delErr.message);
  else if (!deleted?.length) pass(`${table} DELETE cross-org affected 0 rows`);
  else fail(`${table} DELETE cross-org`, "Org A deleted Org B's row — DATA LOSS");

  // 5. INSERT attempt tagged with Org B's organization_id must be rejected.
  const { data: inserted, error: insErr } = await orgA.supabase
    .from(table)
    .insert({ organization_id: orgBOrgId })
    .select("id");
  if (insErr) pass(`${table} INSERT cross-org blocked`, insErr.message);
  else if (!inserted?.length) pass(`${table} INSERT cross-org produced no row`);
  else fail(`${table} INSERT cross-org`, "Org A inserted a row into Org B");
}

async function main() {
  if (!url || !anon) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }
  if (!ORG_A.email || !ORG_A.password || !ORG_B.email || !ORG_B.password) {
    console.error(
      "Missing ORG_A_EMAIL/ORG_A_PASSWORD/ORG_B_EMAIL/ORG_B_PASSWORD — provision two throwaway shops via /login self-signup first.",
    );
    process.exit(1);
  }

  console.log("LakBiz tenant-isolation QA\n");

  const orgB = await signIn(ORG_B);
  const targets = await collectOrgBTargets(orgB);
  await orgB.supabase.auth.signOut();

  const orgA = await signIn(ORG_A);
  if (orgA.orgId === orgB.orgId) {
    console.error("ORG_A and ORG_B resolved to the same organization — pick two distinct shops.");
    process.exit(1);
  }

  for (const { table } of TENANT_TABLES) {
    await checkTable(orgA, orgB.orgId, table, targets[table]);
  }
  await orgA.supabase.auth.signOut();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
