/** Isolated PostgreSQL test. Never connects to a live Supabase project.
 * Install @electric-sql/pglite in a disposable directory and set LEDGER_TEST_MODULE
 * to its dist/index.js; otherwise uses a locally installed package.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
process.on("uncaughtException", (error) => {
  console.error(error.message, error.where ?? "");
  process.exit(1);
});
const { PGlite } = await import(
  process.env.LEDGER_TEST_MODULE ?? "@electric-sql/pglite"
);
const db = new PGlite();
const migration = fileURLToPath(
  new URL(
    "../../supabase/migrations/20261011062938_general_ledger_foundation.sql",
    import.meta.url,
  ),
);
const org = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  manager = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  outsider = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
await db.exec(`create role authenticated; create role anon; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create table public.organizations(id uuid primary key);
create table public.org_members(organization_id uuid,user_id uuid,role text);
create table public.test_entitlements(organization_id uuid,active boolean);
create function public.is_org_owner(o uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.org_members where organization_id=o and user_id=auth.uid() and role='owner')$$;
create function public.org_has_module(o uuid,m text) returns boolean language sql stable security definer set search_path='' as $$select m='banking' and exists(select 1 from public.test_entitlements where organization_id=o and active)$$;
insert into auth.users values('${owner}'),('${manager}'),('${outsider}');
insert into organizations values('${org}'),('${other}');
insert into org_members values('${org}','${owner}','owner'),('${org}','${manager}','manager'),('${other}','${outsider}','owner');
insert into test_entitlements values('${org}',true),('${other}',true);`);
await db.exec(await readFile(migration, "utf8"));
let count = 0;
function pass(label) {
  count++;
  console.log("PASS " + label);
}
async function role(user, roleName = "authenticated") {
  await db.exec(
    `reset role;set role ${roleName};select set_config('request.jwt.claim.sub','${user}',false);`,
  );
}
async function rejects(sql, label) {
  await assert.rejects(() => db.exec(sql));
  await db.exec("rollback");
  pass(label);
}
const lines = JSON.stringify([
  { accountCode: "1000", debitMinor: 12345, creditMinor: 0 },
  { accountCode: "3000", debitMinor: 0, creditMinor: 12345 },
]);
const key = "manual:12345678-1234-4234-8234-123456789abc";
const post = (source = key, body = lines, o = org, memo = "Opening cash") =>
  `select post_general_ledger_journal('${o}','${source}','2026-10-11','${memo}','${body}'::jsonb) as id`;
await role(owner);
await db.exec(
  `select initialize_general_ledger('${org}');select initialize_general_ledger('${org}');`,
);
assert.equal(
  (await db.query("select count(*)::int as n from ledger_accounts")).rows[0].n,
  14,
);
pass("initialize is idempotent");
const first = (await db.query(post())).rows[0].id;
assert.equal((await db.query(post())).rows[0].id, first);
pass("same-key retry posts once");
await rejects(
  post(key, lines, org, "Changed memo"),
  "changed payload cannot reuse source key",
);
await rejects(
  post(
    "manual:12345678-1234-4234-8234-123456789abd",
    lines.replace('12345,"creditMinor":0', '12346,"creditMinor":0'),
  ),
  "unbalanced journal rejected",
);
await rejects(
  post(
    "manual:12345678-1234-4234-8234-123456789abe",
    lines.replace("1000", "9999"),
  ),
  "unknown account rejected",
);
await rejects(
  post(
    "manual:12345678-1234-4234-8234-123456789abf",
    lines.replace("12345", "123.45"),
  ),
  "fractional minor units rejected",
);
assert.equal(
  (await db.query("select count(*)::int as n from journal_batches")).rows[0].n,
  1,
);
pass("failed postings leave no journal fragments");
const trial = (
  await db.query(`select * from get_general_ledger_trial_balance('${org}')`)
).rows;
assert.equal(
  trial.reduce((n, r) => n + Number(r.debit_minor), 0),
  12345,
);
assert.equal(
  trial.reduce((n, r) => n + Number(r.credit_minor), 0),
  12345,
);
pass("trial balance reconciles");
await rejects(
  `update journal_batches set memo='Changed' where id='${first}'`,
  "posted journal immutable",
);
await rejects(
  `insert into journal_lines(organization_id,batch_id,account_id,line_no,debit_minor) select '${org}','${first}',id,3,1 from ledger_accounts where code='1000'`,
  "cannot append to posted journal",
);
await rejects(
  `begin;insert into journal_batches(organization_id,source_key,journal_date,memo,request_payload) values('${org}','manual:12345678-1234-4234-8234-123456789ac0','2026-10-11','Incomplete','{}');commit`,
  "direct incomplete draft fails at commit",
);
await rejects(
  `begin;insert into journal_batches(organization_id,source_key,journal_date,memo,request_payload) values('${org}','manual:12345678-1234-4234-8234-123456789ac1','2026-10-11','Fraction','{}');insert into journal_lines(organization_id,batch_id,account_id,line_no,debit_minor) select '${org}',b.id,a.id,1,0.5 from journal_batches b cross join ledger_accounts a where b.source_key='manual:12345678-1234-4234-8234-123456789ac1' and a.code='1000';commit`,
  "direct fractional input fails without rounding",
);
await db.exec(
  `reset role;insert into ledger_accounts(id,organization_id,code,name,kind) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','${other}','1000','Other cash','asset');`,
);
await role(owner);
await rejects(
  `begin;insert into journal_batches(organization_id,source_key,journal_date,memo,request_payload) values('${org}','manual:12345678-1234-4234-8234-123456789ac2','2026-10-11','Cross tenant','{}');insert into journal_lines(organization_id,batch_id,account_id,line_no,debit_minor) select '${org}',id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd',1,100 from journal_batches where source_key='manual:12345678-1234-4234-8234-123456789ac2';commit`,
  "compound account reference rejects cross-tenant line",
);
await role(manager);
assert.equal(
  (await db.query("select count(*)::int as n from journal_lines")).rows[0].n,
  0,
);
pass("manager cannot read financial lines");
await rejects(post(), "manager cannot post");
await rejects(
  `select get_general_ledger_trial_balance('${org}')`,
  "manager cannot read trial balance RPC",
);
await role(outsider);
assert.equal(
  (await db.query("select count(*)::int as n from journal_batches")).rows[0].n,
  0,
);
pass("other tenant cannot read journals");
await rejects(post(), "other tenant cannot post");
await role("", "anon");
await rejects("select * from journal_batches", "anonymous access denied");
await db.exec(
  `reset role;update test_entitlements set active=false where organization_id='${org}';`,
);
await role(owner);
assert.equal(
  (await db.query("select count(*)::int as n from journal_batches")).rows[0].n,
  1,
);
pass("expired subscription retains owner read access");
await rejects(post(), "expired entitlement cannot post");
const attrs = (
  await db.query(
    "select proname,prosecdef from pg_proc where proname in ('post_general_ledger_journal','initialize_general_ledger','get_general_ledger_trial_balance')",
  )
).rows;
assert.equal(attrs.length, 3);
assert(attrs.every((r) => !r.prosecdef));
pass("all new RPCs use invoker security");
await db.close();
console.log(`${count} isolated PostgreSQL checks passed`);
