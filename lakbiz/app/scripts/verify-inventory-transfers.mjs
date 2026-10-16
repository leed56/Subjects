/** Isolated PostgreSQL fixtures: no live connection or company inventory. */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

process.on("uncaughtException", error => {
  console.error(error.message, error.where ?? "");
  process.exit(1);
});

let db;
let Client;
const nativeUrl = process.env.INVENTORY_TEST_URL;
if (nativeUrl) {
  const target = new URL(nativeUrl);
  if (!["localhost","127.0.0.1","[::1]"].includes(target.hostname) || target.pathname !== "/lakbiz_inventory_test") {
    throw new Error("Native fixtures require a loopback lakbiz_inventory_test database; remote databases are refused.");
  }
  ({ Client } = await import(process.env.INVENTORY_PG_MODULE ?? "pg"));
  const client = new Client({ connectionString: nativeUrl });
  await client.connect();
  db = { exec: sql => client.query(sql), query: sql => client.query(sql), close: () => client.end() };
} else {
  const { PGlite } = await import(process.env.INVENTORY_TEST_MODULE ?? "@electric-sql/pglite");
  db = new PGlite();
}
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
create table stock_logs(
  id text primary key,organization_id uuid not null,product_id text not null,product_name text not null,
  log_type text not null check(log_type in ('in','out','sale','purchase','job_usage','job_return','supplier_return','write_off','customer_return')),
  qty numeric(14,3) not null,note text,log_date timestamptz not null default now(),
  related_job_id text,related_supplier_id text,user_id uuid
);
grant select on stock_logs to authenticated;
create table suppliers(id text primary key,organization_id uuid not null);
insert into suppliers values('foreign-supplier','${other}');
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
await db.exec(await readFile(new URL(
  "../../supabase/migrations/20261016105104_inventory_location_reconciliation.sql",
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
assert.equal(Number(await scalar(`select count(*) as n from get_inventory_location_reconciliation('${org}') where difference <> 0`, "n")), 0);
pass("opening custody balances reconcile for simple, variant, lot and serial stock");

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
assert.equal(Number(await scalar(`select count(*) as n from get_inventory_location_reconciliation('${org}') where difference <> 0`, "n")), 0);
pass("dispatched stock is counted in transit without a false shortage");

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
assert.equal(Number(await scalar(`select count(*) as n from get_inventory_location_reconciliation('${org}') where difference <> 0`, "n")), 0);
pass("received partial lots, variants and serial units still reconcile exactly");

await db.exec("reset role");
await db.exec(`update products_base set stock_qty=stock_qty-1 where id='${simpleProduct}'`);
await role(owner);
assert.equal(Number(await scalar(`select difference from get_inventory_location_reconciliation('${org}','${simpleProduct}') where identity_kind='product_total'`, "difference")), -1);
pass("legacy aggregate writes are reported as custody drift");
const staleTransfer = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
await db.exec(`select create_inventory_transfer_draft('${org}','${staleTransfer}','${main}','${destination}',
  '[{"product_id":"${simpleProduct}","qty":1}]'::jsonb,null)`);
await rejects(`select dispatch_inventory_transfer('${staleTransfer}')`, "drift blocks dispatch even when source location has enough stock");
await rejects(`select inventory_internal.dispatch_inventory_transfer('${staleTransfer}')`, "client cannot bypass reconciliation through private movement function");
await db.exec("reset role");
await db.exec(`update products_base set stock_qty=stock_qty+1 where id='${simpleProduct}'`);
await role(owner);

await db.exec(`select cancel_inventory_transfer('${excessive}')`);
await rejects(`select dispatch_inventory_transfer('${excessive}')`, "cancelled drafts cannot dispatch");
await role(outsider);
await rejects(`select * from get_inventory_location_reconciliation('${org}')`, "another tenant cannot read the reconciliation report");
assert.equal(Number(await scalar(`select count(*) as n from inventory_location_balances where organization_id='${org}'`, "n")), 0);
pass("location balances are hidden from another tenant");

await role(outsider);
await rejects(`select create_inventory_transfer_draft(
  '${org}',gen_random_uuid(),'${main}','${destination}',
  '[{"product_id":"${simpleProduct}","qty":1}]'::jsonb,null
)`, "another tenant cannot create a transfer");
await role("", "anon");
await rejects(`select * from get_inventory_location_reconciliation('${org}')`, "anonymous reconciliation access is denied");
await rejects(`select dispatch_inventory_transfer('${transfer}')`, "anonymous transfer RPC access is denied");

await db.exec("reset role");
await db.exec(await readFile(new URL(
  "../../supabase/migrations/20261016105637_inventory_location_operations.sql", import.meta.url,
), "utf8"));
await db.exec(`update products_base set stock_qty=stock_qty-1 where id='${simpleProduct}'`);
await role(owner);
assert.equal(Number(await scalar(`select qty_on_hand from inventory_location_balances where product_id='${simpleProduct}' and location_id='${main}'`, "qty_on_hand")), 5);
assert.equal(Number(await scalar(`select count(*) as n from get_inventory_location_reconciliation('${org}') where difference<>0`, "n")), 0);
pass("existing simple stock writes atomically update default-location custody");
const balance = await scalar(`select id from inventory_location_balances where product_id='${simpleProduct}' and location_id='${main}'`, "id");
const hold = "abababab-abab-4bab-8bab-abababababab";
await db.exec(`select reserve_inventory_stock('${org}','${hold}',4,'Customer hold','${balance}',null)`);
await db.exec("reset role");
await rejects(`update products_base set stock_qty=stock_qty-2 where id='${simpleProduct}'`, "existing sale or adjustment cannot consume held main-location stock");
await role(owner);
await rejects(`select reserve_inventory_stock('${org}',gen_random_uuid(),2,'Overbooking','${balance}',null)`, "reservation cannot overbook available balance");
await db.exec(`select release_inventory_reservation('${hold}');select release_inventory_reservation('${hold}')`);
assert.equal(Number(await scalar(`select qty_reserved from inventory_location_balances where id='${balance}'`, "qty_reserved")), 0);
pass("release is retry-safe and restores exact availability");
await db.exec("reset role");
await db.exec(`update inventory_lots set qty_on_hand=qty_on_hand-1 where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  update products_base set stock_qty=stock_qty-1 where id='lot-product'`);
await role(owner);
assert.equal(Number(await scalar(`select count(*) as n from get_inventory_location_reconciliation('${org}','lot-product') where difference<>0`, "n")), 0);
pass("existing lot sales/dispositions update custody without double-decrementing aggregate stock");
await db.exec("reset role");
await db.exec(`update product_variants set stock_qty=stock_qty+1 where id='99999999-9999-4999-8999-999999999999';
  update products_base set stock_qty=stock_qty+1 where id='variant-product'`);
await role(owner);
assert.equal(Number(await scalar(`select count(*) as n from get_inventory_location_reconciliation('${org}','variant-product') where difference<>0`, "n")), 0);
pass("variant receipts and returns replenish default custody without a second product decrement");
const unitHold = "acacacac-acac-4cac-8cac-acacacacacac";
await db.exec(`select reserve_inventory_stock('${org}','${unitHold}',1,'Serial hold',null,'${serialUnit}')`);
await db.exec("reset role");
await rejects(`update inventory_units set status='sold' where id='${serialUnit}'`, "reserved serialized identity cannot be sold outside release workflow");
await role(owner);
await db.exec(`select release_inventory_reservation('${unitHold}')`);
assert.equal(await scalar(`select status from inventory_units where id='${serialUnit}'`, "status"), "available");
pass("serialized hold release restores the same unit identity");
await db.exec("reset role");
await db.exec(`update inventory_location_balances set qty_on_hand=qty_on_hand+1 where id='${balance}'`);
await role(owner);
await rejects(`select reconcile_default_inventory_balance('${balance}',5,'Stale screen')`, "reconciliation rejects stale operator quantities");
await db.exec(`select reconcile_default_inventory_balance('${balance}',6,'Verified physical count against source')`);
assert.equal(Number(await scalar(`select count(*) as n from get_inventory_location_reconciliation('${org}','${simpleProduct}') where difference<>0`, "n")), 0);
assert.equal(Number(await scalar(`select count(*) as n from inventory_reconciliation_audit where balance_id='${balance}'`, "n")), 1);
pass("owner reconciliation repairs only location stock and preserves an immutable audit record");
await role(outsider);
await rejects(`select reserve_inventory_stock('${org}',gen_random_uuid(),1,'Wrong tenant','${balance}',null)`, "reservation rejects another tenant");
await rejects(`select reconcile_default_inventory_balance('${balance}',5,'Wrong tenant')`, "repair rejects another tenant");
await role(owner);
const command = JSON.stringify([{product_id:simpleProduct,command_key:'fixture-command',expected_qty:9,next_qty:10}]);
await db.exec(`select apply_inventory_stock_commands('${org}','${command}')`);
await db.exec(`select apply_inventory_stock_commands('${org}','${command}')`);
assert.equal(Number(await scalar(`select stock_qty from products_base where id='${simpleProduct}'`,"stock_qty")),10);
pass("atomic stock command replay cannot apply a receipt twice");
await rejects(`select apply_inventory_stock_commands('${org}','[{"product_id":"${simpleProduct}","command_key":"stale","expected_qty":9,"next_qty":8}]')`,"stale device quantity cannot overwrite newer cloud stock");
await rejects(`select apply_inventory_stock_commands('${org}','[{"product_id":"${simpleProduct}","command_key":"fixture-command","expected_qty":9,"next_qty":11}]')`,"replayed command key cannot carry changed quantities");
await rejects(`select apply_inventory_stock_commands('${org}','[{"product_id":"${simpleProduct}","command_key":"batch-first","expected_qty":10,"next_qty":11},{"product_id":"variant-product","command_key":"batch-fail","expected_qty":999,"next_qty":1000}]')`,"one stale stock command rolls back the entire batch");
assert.equal(Number(await scalar(`select stock_qty from products_base where id='${simpleProduct}'`,"stock_qty")),10);
assert.equal(Number(await scalar(`select count(*) as n from inventory_stock_commands where command_key='batch-first'`,"n")),0);
pass("failed command batch leaves neither a quantity change nor a replay marker");
await db.exec("reset role");
await db.exec("update inventory_lots set status='quarantine' where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'");
await role(owner);
const blockedBalance=await scalar(`select id from inventory_location_balances where lot_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' and location_id='${main}'`,"id");
await rejects(`select reserve_inventory_stock('${org}',gen_random_uuid(),1,'Blocked lot','${blockedBalance}',null)`,"quarantined lot cannot be promised by a customer hold");
await db.exec("reset role;update inventory_lots set status='available' where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'");
await role(owner);
await rejects(`select initialize_inventory_opening_custody('${org}','Too late')`,"opening custody cannot run after movement authority is enabled");
await db.exec(`reset role;update inventory_transfer_settings set enabled=false where organization_id='${org}';
  insert into products_base(id,organization_id,name,stock_qty) values('late-opening','${org}','Migrated opening',2)`);
await role(owner);
await db.exec(`select initialize_inventory_opening_custody('${org}','Verified unassigned stock at main location')`);
assert.equal(Number(await scalar("select qty_on_hand from inventory_location_balances where product_id='late-opening'","qty_on_hand")),2);
pass("owner opening review registers missing migrated custody without changing source stock");
await db.exec(`select initialize_inventory_opening_custody('${org}','Repeat verified opening review')`);
assert.equal(Number(await scalar("select count(*) as n from inventory_location_balances where product_id='late-opening'","n")),1);
pass("repeated opening review does not duplicate physical stock");
assert.equal(await scalar(`select location_id from inventory_units where id='${serialUnit}'`,"location_id"),destination);
assert.equal(Number(await scalar(`select qty_on_hand from inventory_location_balances where product_id='${simpleProduct}' and location_id='${destination}'`,"qty_on_hand")),4);
pass("opening review preserves existing branch and serialized custody");
await db.exec(`reset role;update inventory_transfer_settings set enabled=true where organization_id='${org}'`);
await role(owner);
const atomicLog=JSON.stringify([{product_id:simpleProduct,command_key:'stock-log:atomic-in',expected_qty:10,next_qty:11,
  stock_log:{id:'atomic-in',product_id:simpleProduct,log_type:'in',qty:1,user_id:outsider}}]);
await db.exec(`select apply_inventory_stock_commands('${org}','${atomicLog}');select apply_inventory_stock_commands('${org}','${atomicLog}')`);
assert.equal(Number(await scalar("select count(*) as n from stock_logs where id='atomic-in'","n")),1);
assert.equal(await scalar("select user_id from stock_logs where id='atomic-in'","user_id"),owner);
pass("stock quantity and server-stamped movement audit commit together and replay once");
const badLog=JSON.stringify([{product_id:simpleProduct,command_key:'stock-log:bad-date',expected_qty:11,next_qty:12,
  stock_log:{id:'bad-date',product_id:simpleProduct,log_type:'in',qty:1,log_date:'invalid-date'}}]);
await rejects(`select apply_inventory_stock_commands('${org}','${badLog}')`,"a failed stock-log insert rolls back the quantity and location change");
assert.equal(Number(await scalar(`select stock_qty from products_base where id='${simpleProduct}'`,"stock_qty")),11);
assert.equal(Number(await scalar("select count(*) as n from inventory_stock_commands where command_key='stock-log:bad-date'","n")),0);
pass("audit failure leaves no stock command marker or partial quantity update");
const foreignLog=JSON.stringify([{product_id:simpleProduct,command_key:'stock-log:foreign-supplier',expected_qty:11,next_qty:12,
  stock_log:{id:'foreign-supplier',product_id:simpleProduct,log_type:'in',qty:1,related_supplier_id:'foreign-supplier'}}]);
await rejects(`select apply_inventory_stock_commands('${org}','${foreignLog}')`,"stock movement audit cannot reference another tenant's supplier");
if (nativeUrl) {
  await db.exec("reset role");
  await db.exec(`insert into products_base(id,organization_id,name,stock_qty) values
    ('race-holds','${org}','Concurrent holds',10),
    ('race-sale','${org}','Concurrent sale',10),
    ('race-receipt','${org}','Concurrent receipt',10),
    ('race-command','${org}','Concurrent stock command',10)`);
  async function race(sqls) {
    const clients = await Promise.all(sqls.map(async () => {
      const client = new Client({ connectionString: nativeUrl });
      await client.connect();
      await client.query(`select set_config('request.jwt.claim.sub','${owner}',false)`);
      return client;
    }));
    try { return await Promise.allSettled(sqls.map((sql,i) => clients[i].query(sql))); }
    finally { await Promise.all(clients.map(client => client.end())); }
  }
  const raceBalance = await scalar(`select id from inventory_location_balances where product_id='race-holds'`, "id");
  const holdIds = ["12121212-1212-4212-8212-121212121212","13131313-1313-4313-8313-131313131313"];
  let outcomes = await race(holdIds.map(id => `select reserve_inventory_stock('${org}','${id}',7,'Concurrent hold','${raceBalance}',null)`));
  assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,1);
  assert.equal(Number(await scalar(`select qty_reserved from inventory_location_balances where id='${raceBalance}'`,"qty_reserved")),7);
  pass("native Postgres: simultaneous reservations cannot overbook");
  await role(owner);
  const saleRace = "14141414-1414-4414-8414-141414141414";
  await db.exec(`select create_inventory_transfer_draft('${org}','${saleRace}','${main}','${destination}',
    '[{"product_id":"race-sale","qty":7}]',null)`);
  outcomes=await race([
    `update products_base set stock_qty=stock_qty-7 where id='race-sale'`,
    `select dispatch_inventory_transfer('${saleRace}')`,
  ]);
  assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,1);
  assert.equal(Number(await scalar(`select count(*) as n from get_inventory_location_reconciliation('${org}','race-sale') where difference<>0`,"n")),0);
  pass("native Postgres: simultaneous sale and transfer cannot consume the same stock");
  const receiptRace="15151515-1515-4515-8515-151515151515";
  await db.exec(`select create_inventory_transfer_draft('${org}','${receiptRace}','${main}','${destination}',
    '[{"product_id":"race-receipt","qty":3}]',null);
    select dispatch_inventory_transfer('${receiptRace}');select mark_inventory_transfer_in_transit('${receiptRace}')`);
  outcomes=await race([`select receive_inventory_transfer('${receiptRace}')`,`select receive_inventory_transfer('${receiptRace}')`]);
  assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,1);
  assert.equal(Number(await scalar(`select qty_on_hand from inventory_location_balances where product_id='race-receipt' and location_id='${destination}'`,"qty_on_hand")),3);
  pass("native Postgres: simultaneous receipt retries credit destination exactly once");
  outcomes=await race(['first-device','second-device'].map(key=>`select apply_inventory_stock_commands('${org}',
    '[{"product_id":"race-command","command_key":"${key}","expected_qty":10,"next_qty":7}]')`));
  assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,1);
  assert.equal(Number(await scalar("select stock_qty from products_base where id='race-command'","stock_qty")),7);
  pass("native Postgres: two stale device snapshots cannot overwrite each other's stock");
}
console.log(`Inventory transfer authority: ${checks} checks passed.`);
const { verifyPurchaseReceipts } = await import('./verify-purchase-receipts.mjs');
await verifyPurchaseReceipts({db,Client,nativeUrl,org,other,owner,outsider,role});
await db.close();
