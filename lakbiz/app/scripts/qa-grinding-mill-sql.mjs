import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const owner = '11111111-1111-4111-8111-111111111111';
const cashier = '22222222-2222-4222-8222-222222222222';
const shopA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const shopB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const shopC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const q = (s) => db.query(s);

await db.exec(`
create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
create table public.organizations(id uuid primary key, sector text);
create table public.org_members(organization_id uuid, user_id uuid, role text);
create table public.plans(id text primary key, max_products integer);
create table public.subscriptions(organization_id uuid primary key, plan_id text);
create table public.products_base(
  id text primary key, organization_id uuid not null, name text not null, sku text,
  category text, sector_id text, condition text, buy_price numeric default 0,
  sell_price numeric default 0, stock_qty numeric default 0, reorder_level numeric default 0,
  unit text, custom_fields jsonb default '{}'::jsonb, active boolean default true,
  notes text, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.sales_base(id text primary key, organization_id uuid, customer_id text);
create table public.sale_lines_base(id text primary key, organization_id uuid, sale_id text, product_id text, qty numeric, unit_price numeric);
create table public.customer_product_prices(organization_id uuid, customer_id text, product_id text, price numeric);
create function public.org_member_role_in(org_id uuid, roles text[]) returns boolean language sql stable
as $$select exists(select 1 from public.org_members m where m.organization_id=org_id and m.user_id=auth.uid() and m.role=any(roles))$$;
create function public.org_member_can_write_module(org_id uuid, module_key text) returns boolean language sql stable
as $$select exists(select 1 from public.org_members m where m.organization_id=org_id and m.user_id=auth.uid())$$;
insert into public.organizations values ('${shopA}','grocery'),('${shopB}','grocery'),('${shopC}','grocery');
insert into public.org_members values ('${shopA}','${owner}','owner'),('${shopB}','${owner}','owner'),('${shopC}','${owner}','owner'),('${shopA}','${cashier}','cashier');
insert into public.plans values ('ample',null),('small',10);
insert into public.subscriptions values ('${shopA}','ample'),('${shopB}','ample'),('${shopC}','small');
`);
await q(`select set_config('test.user_id','${owner}',false)`);
const migration = readFileSync('../supabase/migrations/20261026083545_grocery_optional_mill_import_and_checkout_guards.sql','utf8');
await db.exec(migration);
const meatMigration = readFileSync('../supabase/migrations/20261026090000_grocery_optional_meat_catalogue.sql','utf8');
await db.exec(meatMigration);

const call = async (shop) => (await q(`select public.import_grocery_mill_catalogue('${shop}') as result`)).rows[0].result;
assert.deepEqual(await call(shopA), { added:36, existing:0, total:36 });
assert.deepEqual(await call(shopA), { added:0, existing:36, total:36 });
await q('begin');
assert.deepEqual(await call(shopB), { added:36, existing:0, total:36 });
await q('rollback');
assert.equal((await q(`select count(*)::int as n from public.products_base where organization_id='${shopB}'`)).rows[0].n,0);
const simultaneous = await Promise.all([call(shopB), call(shopB)]);
assert.equal(simultaneous.reduce((sum, result) => sum + result.added, 0),36);
assert.equal((await q(`select count(*)::int as n from public.products_base where organization_id='${shopB}'`)).rows[0].n,36);
assert.equal((await q(`select count(*)::int as n from public.products_base where organization_id='${shopA}' and active=false and sell_price=0 and stock_qty=0 and custom_fields ? 'barcode'=false`)).rows[0].n, 36);
try { await call(shopC); assert.fail('cap should reject'); } catch (e) { assert.match(e.message,/product limit reached/); }
assert.equal((await q(`select count(*)::int as n from public.products_base where organization_id='${shopC}'`)).rows[0].n,0);
const callMeat = async (shop) => (await q(`select public.import_grocery_meat_catalogue('${shop}') as result`)).rows[0].result;
assert.deepEqual(await callMeat(shopA), { added:9, existing:0, total:9 });
assert.deepEqual(await callMeat(shopA), { added:0, existing:9, total:9 });
await q('begin');
assert.deepEqual(await callMeat(shopB), { added:9, existing:0, total:9 });
await q('rollback');
assert.equal((await q(`select count(*)::int as n from public.products_base where organization_id='${shopB}' and sku like 'GRC-MEAT-%'`)).rows[0].n,0);
const simultaneousMeat = await Promise.all([callMeat(shopB), callMeat(shopB)]);
assert.equal(simultaneousMeat.reduce((sum, result) => sum + result.added, 0),9);
assert.equal((await q(`select count(*)::int as n from public.products_base where organization_id='${shopA}' and sku like 'GRC-MEAT-%' and active=false and sell_price=0 and stock_qty=0 and custom_fields ? 'barcode'=false`)).rows[0].n, 9);
await q(`update public.plans set max_products=8 where id='small'`);
try { await callMeat(shopC); assert.fail('meat cap should reject'); } catch (e) { assert.match(e.message,/product limit reached/); }
assert.equal((await q(`select count(*)::int as n from public.products_base where organization_id='${shopC}'`)).rows[0].n,0);
await q(`update public.plans set max_products=10 where id='small'`);
assert.deepEqual(await callMeat(shopC), { added:9, existing:0, total:9 });
const product = (await q(`select id from public.products_base where organization_id='${shopA}' and sku='GRC-MILL-CHP-001'`)).rows[0].id;
await q(`insert into public.sales_base values ('sale-a','${shopA}',null)`);
const insertLine = (id,price) => q(`insert into public.sale_lines_base values ('${id}','${shopA}','sale-a','${product}',1,${price})`);
try { await insertLine('inactive',5); assert.fail('inactive item should reject'); } catch(e) { assert.match(e.message,/inactive, unpriced or unavailable/); }
await q(`update public.products_base set active=true, stock_qty=5 where id='${product}'`);
try { await insertLine('unpriced',5); assert.fail('unpriced item should reject'); } catch(e) { assert.match(e.message,/inactive, unpriced or unavailable/); }
await q(`update public.products_base set sell_price=500 where id='${product}'`);
await q(`update public.products_base set stock_qty=0 where id='${product}'`);
try { await insertLine('nostock',500); assert.fail('zero stock should reject'); } catch(e) { assert.match(e.message,/inactive, unpriced or unavailable/); }
await q(`update public.products_base set stock_qty=5 where id='${product}'`);
await q(`select set_config('test.user_id','${cashier}',false)`);
try { await callMeat(shopA); assert.fail('cashier meat import should reject'); } catch (e) { assert.match(e.message,/owner access/); }
try { await insertLine('override',1); assert.fail('cashier override should reject'); } catch(e) { assert.match(e.message,/cashier price override/); }
await insertLine('valid',500);
console.log('Local PostgreSQL rehearsal passed: atomic 36-item mill and 9-item meat imports, rollback/retry, queued simultaneous calls, shop isolation, cap rollback, owner-only import, inactive/unpriced/stock guards, cashier price guard.');
await db.close();
