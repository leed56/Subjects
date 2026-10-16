/** Isolated PostgreSQL fixtures: no live connection or company inventory. */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

process.on("uncaughtException", error => {
  console.error(error.message, error.where ?? "");
  process.exit(1);
});

const { PGlite } = await import(process.env.INVENTORY_TEST_MODULE ?? "@electric-sql/pglite");
const db = new PGlite();
const org = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const outsider = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const simpleProduct = "a-simple-product";
const serialProduct = "serial-product";
const serialUnit = "77777777-7777-4777-8777-777777777777";

await db.exec(`
create role authenticated; create role anon; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create table organizations(id uuid primary key);
create table org_members(organization_id uuid, user_id uuid, role text);
grant select on org_members to authenticated;
create function org_member_can_write_module(o uuid, m text) returns boolean
language sql stable security definer set search_path='' as
  $$select m='stock' and exists(select 1 from public.org_members where organization_id=o and user_id=auth.uid())$$;
create function org_member_role_in(o uuid, roles text[]) returns boolean
language sql stable security definer set search_path='' as
  $$select exists(select 1 from public.org_members where organization_id=o and user_id=auth.uid() and role=any(roles))$$;
create function set_updated_at() returns trigger language plpgsql as
  $$begin new.updated_at=now(); return new; end$$;
create table products_base(
  id text primary key, organization_id uuid not null references organizations(id),
  name text not null, stock_qty numeric(14,3) not null default 0
);
create table product_inventory_profiles(
  product_id text primary key references products_base(id), organization_id uuid not null,
  tracking_mode text not null default 'simple'
);
create table product_variants(
  id uuid primary key, organization_id uuid not null, product_id text not null references products_base(id),
  stock_qty numeric(14,3) not null default 0
);
create table inventory_lots(
  id uuid primary key, organization_id uuid not null, product_id text not null references products_base(id),
  variant_id uuid, batch_no text not null, expiry_date date, qty_on_hand numeric(14,3) not null default 0,
  status text not null default 'available'
);
create table inventory_units(
  id uuid primary key, organization_id uuid not null, product_id text not null references products_base(id),
  variant_id uuid, lot_id uuid, serial_no text, imei text, secondary_imei text, barcode text,
  warranty_expiry date, status text not null default 'available', sale_id text, customer_id text,
  notes text, updated_at timestamptz not null default now()
);
grant select on products_base, inventory_units to authenticated;
insert into auth.users values ('${owner}'), ('${outsider}');
insert into organizations values ('${org}'), ('${other}');
insert into org_members values ('${org}','${owner}','owner'), ('${other}','${outsider}','owner');
insert into products_base values
  ('${simpleProduct}','${org}','Simple stock',10),
  ('${serialProduct}','${org}','Serialized stock',1),
  ('other-product','${other}','Other stock',5),
  ('lot-product','${org}','Lot stock',10),
  ('variant-product','${org}','Variant stock',8);
insert into product_inventory_profiles values
  ('${simpleProduct}','${org}','simple'),
  ('${serialProduct}','${org}','serial'),
  ('other-product','${other}','simple'),
  ('lot-product','${org}','lot'),
  ('variant-product','${org}','variant');
insert into product_variants values
  ('99999999-9999-4999-8999-999999999999','${org}','variant-product',8);
insert into inventory_lots(id,organization_id,product_id,batch_no,qty_on_hand)
  values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','${org}','lot-product','BATCH-001',10);
`);

for (const name of [
  "20261016095255_inventory_locations_and_transfers.sql",
]) {
  await db.exec(await readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8"));
}

const main = (await db.query(`select id from inventory_locations where organization_id='${org}' and is_default`)).rows[0].id;
const otherMain = (await db.query(`select id from inventory_locations where organization_id='${other}' and is_default`)).rows[0].id;
const destination = "33333333-3333-4333-8333-333333333333";
await db.exec(`
insert into inventory_locations(id,organization_id,code,name,kind) values
  ('${destination}','${org}','BRANCH','Branch','shop');
insert into inventory_units(id,organization_id,product_id,serial_no,status,location_id)
values('${serialUnit}','${org}','${serialProduct}','SN-001','available','${main}');
`);

await db.exec(await readFile(new URL(
  "../../supabase/migrations/20261016104228_inventory_transfer_atomic_authority.sql",
  import.meta.url,
), "utf8"));

let checks = 0;
function pass(label) { checks++; console.log(`PASS ${label}`); }
async function role(user, name = "authenticated") {
  await db.exec(`reset role; set role ${name}; select set_config('request.jwt.claim.sub','${user}',false)`);
}
async function rejects(sql, label) {
  await assert.rejects(() => db.exec(sql));
  await db.exec("rollback");
  pass(label);
}
async function scalar(sql, field) { return (await db.query(sql)).rows[0][field]; }

const transfer = "44444444-4444-4444-8444-444444444444";
await role(owner);
assert.equal(Number(await scalar(
  `select qty_on_hand from inventory_location_balances where organization_id='${org}' and location_id='${main}' and product_id='${simpleProduct}'`,
  "qty_on_hand",
)), 10);
pass("existing simple stock reconciles into the default location");

await db.exec(`select create_inventory_transfer_draft(
  '${org}','${transfer}','${main}','${destination}',
  '[{"product_id":"${simpleProduct}","qty":4}]'::jsonb,'Branch replenishment'
)`);
await rejects(`select dispatch_inventory_transfer('${transfer}')`, "dispatch stays disabled until stock integration is certified");
await rejects(`insert into inventory_transfer_settings values('${org}',true)`, "app roles cannot enable transfer authority");
await db.exec(`reset role; insert into inventory_transfer_settings values('${org}',true)`);
await role(owner);
await db.exec(`select dispatch_inventory_transfer('${transfer}')`);
assert.equal(Number(await scalar(
  `select qty_on_hand from inventory_location_balances where location_id='${main}' and product_id='${simpleProduct}'`,
  "qty_on_hand",
)), 6);
assert.equal(Number(await scalar(`select stock_qty from products_base where id='${simpleProduct}'`, "stock_qty")), 10);
pass("dispatch removes source availability without changing aggregate stock");

await db.exec(`select mark_inventory_transfer_in_transit('${transfer}')`);
await db.exec(`select receive_inventory_transfer('${transfer}')`);
assert.equal(Number(await scalar(
  `select qty_on_hand from inventory_location_balances where location_id='${destination}' and product_id='${simpleProduct}'`,
  "qty_on_hand",
)), 4);
assert.equal(await scalar(`select status from inventory_transfers where id='${transfer}'`, "status"), "received");
pass("receipt atomically creates destination availability and completes custody");
await rejects(`select receive_inventory_transfer('${transfer}')`, "receipt cannot be replayed");

const excessive = "55555555-5555-4555-8555-555555555555";
await db.exec(`select create_inventory_transfer_draft(
  '${org}','${excessive}','${main}','${destination}',
  '[{"product_id":"${simpleProduct}","qty":7}]'::jsonb,null
)`);
await rejects(`select dispatch_inventory_transfer('${excessive}')`, "overselling a location is rejected");
assert.equal(Number(await scalar(
  `select qty_on_hand from inventory_location_balances where location_id='${main}' and product_id='${simpleProduct}'`,
  "qty_on_hand",
)), 6);
pass("failed dispatch rolls back every quantity change");

await rejects(`select create_inventory_transfer_draft(
  '${org}',gen_random_uuid(),'${main}','${otherMain}',
  '[{"product_id":"${simpleProduct}","qty":1}]'::jsonb,null
)`, "cross-organization destination is rejected");

const serialTransfer = "66666666-6666-4666-8666-666666666666";
await db.exec(`select create_inventory_transfer_draft(
  '${org}','${serialTransfer}','${main}','${destination}',
  '[{"product_id":"${serialProduct}","unit_id":"${serialUnit}","qty":1}]'::jsonb,null
)`);
await db.exec(`select dispatch_inventory_transfer('${serialTransfer}')`);
assert.equal(await scalar(`select custody_status from inventory_units where id='${serialUnit}'`, "custody_status"), "in_transit");
await db.exec("reset role");
await rejects(`update inventory_units set status='sold' where id='${serialUnit}'`, "in-transit serial cannot be sold by existing sale writers");
await role(owner);
await db.exec(`select mark_inventory_transfer_in_transit('${serialTransfer}')`);
await db.exec(`select receive_inventory_transfer('${serialTransfer}')`);
assert.equal(await scalar(`select location_id from inventory_units where id='${serialUnit}'`, "location_id"), destination);
assert.equal(await scalar(`select custody_status from inventory_units where id='${serialUnit}'`, "custody_status"), "available");
pass("serialized unit keeps exact identity through dispatch and receipt");

await rejects(`update inventory_transfers set status='draft' where id='${transfer}'`, "client cannot forge transfer status");
await rejects(`update inventory_transfer_lines set received_qty=0 where transfer_id='${transfer}'`, "client cannot forge movement quantities");
await rejects(`update inventory_location_balances set qty_on_hand=999 where location_id='${main}'`, "client cannot overwrite physical location stock");
await rejects(`select create_inventory_transfer_draft(
  '${org}',gen_random_uuid(),'${main}','${destination}',
  '[{"product_id":"${simpleProduct}","qty":"NaN"}]'::jsonb,null
)`, "NaN quantity is rejected");
await rejects(`select create_inventory_transfer_draft(
  '${org}',gen_random_uuid(),'${main}','${destination}',
  '[{"product_id":"${simpleProduct}","qty":1},{"product_id":"${simpleProduct}","qty":1}]'::jsonb,null
)`, "duplicate exact identities are rejected atomically");

const rollbackTransfer = "88888888-8888-4888-8888-888888888888";
await db.exec(`select create_inventory_transfer_draft(
  '${org}','${rollbackTransfer}','${main}','${destination}',
  '[{"product_id":"${serialProduct}","unit_id":"${serialUnit}","qty":1},{"product_id":"${simpleProduct}","qty":1}]'::jsonb,null
)`);
await rejects(`select dispatch_inventory_transfer('${rollbackTransfer}')`, "wrong-origin serial rejects the whole transfer");
assert.equal(Number(await scalar(
  `select qty_on_hand from inventory_location_balances where location_id='${main}' and product_id='${simpleProduct}'`,
  "qty_on_hand",
)), 6);
pass("multi-line failure preserves source balances");
assert.equal(await scalar(`select status from inventory_transfers where id='${rollbackTransfer}'`, "status"), "draft");
assert.equal(Number(await scalar(`select sum(dispatched_qty) as n from inventory_transfer_lines where transfer_id='${rollbackTransfer}'`, "n")), 0);
pass("multi-line failure rolls back prior movement counters and transfer status");

const lotTransfer = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
await db.exec(`select create_inventory_transfer_draft(
  '${org}','${lotTransfer}','${main}','${destination}',
  '[{"product_id":"lot-product","lot_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","qty":3},{"product_id":"variant-product","variant_id":"99999999-9999-4999-8999-999999999999","qty":2}]'::jsonb,null
)`);
await db.exec(`select dispatch_inventory_transfer('${lotTransfer}'); select mark_inventory_transfer_in_transit('${lotTransfer}'); select receive_inventory_transfer('${lotTransfer}')`);
assert.equal(Number(await scalar(`select qty_on_hand from inventory_location_balances where location_id='${destination}' and lot_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'`, "qty_on_hand")), 3);
assert.equal(Number(await scalar(`select qty_on_hand from inventory_location_balances where location_id='${destination}' and variant_id='99999999-9999-4999-8999-999999999999'`, "qty_on_hand")), 2);
pass("partial lot and variant custody moves preserve exact identities");

await db.exec(`select cancel_inventory_transfer('${excessive}')`);
await rejects(`select dispatch_inventory_transfer('${excessive}')`, "cancelled drafts cannot dispatch");
await role(outsider);
assert.equal(Number(await scalar(`select count(*) as n from inventory_location_balances where organization_id='${org}'`, "n")), 0);
pass("location balances are hidden from another tenant");

await role(outsider);
await rejects(`select create_inventory_transfer_draft(
  '${org}',gen_random_uuid(),'${main}','${destination}',
  '[{"product_id":"${simpleProduct}","qty":1}]'::jsonb,null
)`, "another tenant cannot create a transfer");
await role("", "anon");
await rejects(`select dispatch_inventory_transfer('${transfer}')`, "anonymous transfer RPC access is denied");

console.log(`Inventory transfer authority: ${checks} checks passed.`);
await db.close();
