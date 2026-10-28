\set ON_ERROR_STOP on
-- Execute only against the disposable, loopback-only PostgreSQL restore.
-- Fixtures, migration rehearsal and all test changes are rolled back.
begin;
do $$ begin
  if current_database() not in ('lakbiz_staging','lakbiz_staging_fresh') or inet_server_addr() <> '127.0.0.1'::inet then
    raise exception 'Refusing stock-history tests outside local lakbiz_staging';
  end if;
end $$;
create function pg_temp.assert_ok(ok boolean, label text) returns void
language plpgsql as $$ begin if ok is distinct from true then raise exception 'Assertion failed: %', label; end if; end $$;
create temp table before_stock_history as
select count(*) as rows, md5(coalesce(string_agg(to_jsonb(l)::text, '|' order by id),'')) as fingerprint from public.stock_logs l;

\ir ../../supabase/migrations/20261026083545_grocery_optional_mill_import_and_checkout_guards.sql
\ir ../../supabase/migrations/20261026090000_grocery_optional_meat_catalogue.sql
\ir ../../supabase/migrations/20261028072641_grocery_catalogue_readiness.sql
\ir ../../supabase/migrations/20261028081431_stock_movement_append_only.sql

select pg_temp.assert_ok((select b.rows=count(*) and b.fingerprint=md5(coalesce(string_agg(to_jsonb(l)::text,'|' order by l.id),'')) from public.stock_logs l cross join before_stock_history b group by b.rows,b.fingerprint),'migration preserves all history');
select pg_temp.assert_ok(not has_table_privilege('authenticated','public.stock_logs','UPDATE') and not has_table_privilege('authenticated','public.stock_logs','DELETE') and not has_table_privilege('authenticated','public.stock_logs','TRUNCATE'),'client mutation privileges revoked');

insert into auth.users(id) values ('28100000-0000-4000-8000-000000000001'),('28100000-0000-4000-8000-000000000002'),('28100000-0000-4000-8000-000000000003');
insert into public.organizations(id,name,sector) values ('28200000-0000-4000-8000-000000000001','Stock-history staging A','grocery'),('28200000-0000-4000-8000-000000000002','Stock-history staging B','grocery');
insert into public.subscriptions(organization_id,plan_id,status) values ('28200000-0000-4000-8000-000000000001','pro','active'),('28200000-0000-4000-8000-000000000002','pro','active');
insert into public.org_members(organization_id,user_id,role) values
('28200000-0000-4000-8000-000000000001','28100000-0000-4000-8000-000000000001','owner'),
('28200000-0000-4000-8000-000000000001','28100000-0000-4000-8000-000000000002','cashier'),
('28200000-0000-4000-8000-000000000002','28100000-0000-4000-8000-000000000003','owner');
set local request.jwt.claim.sub='28100000-0000-4000-8000-000000000001';
set local role authenticated;
insert into public.products(id,organization_id,name,category,sector_id,condition,buy_price,sell_price,stock_qty,unit,active,custom_fields)
values ('qa-history-rice','28200000-0000-4000-8000-000000000001','QA Rice','Rice','grocery','new',180,280,10,'kg',true,'{}');
insert into public.stock_logs(id,organization_id,product_id,product_name,log_type,qty,note,user_id)
values ('qa-history-opening','28200000-0000-4000-8000-000000000001','qa-history-rice','QA Rice','in',10,'Opening stock','28100000-0000-4000-8000-000000000002');
select pg_temp.assert_ok((select user_id='28100000-0000-4000-8000-000000000001'::uuid from public.stock_logs where id='qa-history-opening'),'server stamps real actor');
select pg_temp.assert_ok(public.grocery_catalogue_readiness('28200000-0000-4000-8000-000000000001') = '{"mill":true,"meat":true}'::jsonb,'owner sees installed catalogue functions');
select pg_temp.assert_ok((public.import_grocery_mill_catalogue('28200000-0000-4000-8000-000000000001')->>'added')::int=36,'mill import creates 36');
select pg_temp.assert_ok((public.import_grocery_mill_catalogue('28200000-0000-4000-8000-000000000001')->>'added')::int=0,'mill retry creates zero');
select pg_temp.assert_ok((public.import_grocery_meat_catalogue('28200000-0000-4000-8000-000000000001')->>'added')::int=9,'meat import creates 9');
select pg_temp.assert_ok((public.import_grocery_meat_catalogue('28200000-0000-4000-8000-000000000001')->>'added')::int=0,'meat retry creates zero');
select pg_temp.assert_ok((select count(*)=45 from public.products where organization_id='28200000-0000-4000-8000-000000000001' and id<>'qa-history-rice' and active=false and sell_price=0 and buy_price=0 and stock_qty=0 and not custom_fields ? 'barcode'),'import templates remain inactive, unpriced, unstocked and barcode-free');

-- An identical retry uses DO NOTHING; it never invokes an UPDATE trigger.
insert into public.stock_logs(id,organization_id,product_id,product_name,log_type,qty,note)
values ('qa-history-opening','28200000-0000-4000-8000-000000000001','qa-history-rice','QA Rice','in',999,'Attempted rewrite') on conflict(id) do nothing;
select pg_temp.assert_ok((select count(*)=1 and max(qty)=10 and max(note)='Opening stock' from public.stock_logs where id='qa-history-opening'),'retry preserves original payload');

do $$ begin
  begin update public.stock_logs set qty=999 where id='qa-history-opening'; raise exception 'Owner update incorrectly accepted'; exception when insufficient_privilege then null; end;
  begin delete from public.stock_logs where id='qa-history-opening'; raise exception 'Owner delete incorrectly accepted'; exception when insufficient_privilege then null; end;
  begin truncate public.stock_logs; raise exception 'Truncate incorrectly accepted'; exception when insufficient_privilege then null; end;
end $$;

set local request.jwt.claim.sub='28100000-0000-4000-8000-000000000002';
do $$ begin
  begin update public.stock_logs set qty=999 where id='qa-history-opening'; raise exception 'Cashier update incorrectly accepted'; exception when insufficient_privilege then null; end;
  begin delete from public.stock_logs where id='qa-history-opening'; raise exception 'Cashier delete incorrectly accepted'; exception when insufficient_privilege then null; end;
end $$;
select public.finalize_sale_with_private_tenders_v3(
  '28200000-0000-4000-8000-000000000001','qa-history-sale',null,null,0,
  '[{"product_id":"qa-history-rice","qty":1,"unit_price":280,"line_order":0}]',
  '[{"id":"qa-history-cash","kind":"cash","amount":280}]');
select public.finalize_sale_with_private_tenders_v3(
  '28200000-0000-4000-8000-000000000001','qa-history-sale',null,null,0,
  '[{"product_id":"qa-history-rice","qty":1,"unit_price":280,"line_order":0}]',
  '[{"id":"qa-history-cash","kind":"cash","amount":280}]');
select pg_temp.assert_ok((select stock_qty=9 from public.products where id='qa-history-rice'),'sale deducts once');
select pg_temp.assert_ok((select count(*)=1 from public.stock_logs where product_id='qa-history-rice' and log_type='sale'),'one durable sale movement');

-- Another shop owner cannot read or append this shop's history.
set local request.jwt.claim.sub='28100000-0000-4000-8000-000000000003';
select pg_temp.assert_ok((select count(*)=0 from public.stock_logs where organization_id='28200000-0000-4000-8000-000000000001'),'cross-shop reads hidden');
do $$ begin
  begin
    insert into public.stock_logs(id,organization_id,product_id,product_name,log_type,qty) values ('qa-history-foreign','28200000-0000-4000-8000-000000000001','qa-history-rice','QA Rice','in',1);
    raise exception 'Cross-shop insert incorrectly accepted';
  exception when insufficient_privilege then null; end;
end $$;

-- Owner-approved returns append a movement and preserve original sale evidence.
set local request.jwt.claim.sub='28100000-0000-4000-8000-000000000001';
select public.process_sale_return('28200000-0000-4000-8000-000000000001','qa-history-sale','28300000-0000-4000-8000-000000000001','Inspected and approved','[{"line_order":0,"qty":1,"restock":true}]');
select public.process_sale_return('28200000-0000-4000-8000-000000000001','qa-history-sale','28300000-0000-4000-8000-000000000001','Inspected and approved','[{"line_order":0,"qty":1,"restock":true}]');
select pg_temp.assert_ok((select stock_qty=10 from public.products where id='qa-history-rice'),'return restores once');
select pg_temp.assert_ok((select count(*)=1 from public.stock_logs where product_id='qa-history-rice' and log_type='customer_return'),'one durable return movement');
select pg_temp.assert_ok((select qty=1 and unit_price=280 from public.sale_lines where sale_id='qa-history-sale'),'return preserves original sale line');

-- Defense in depth: even a SECURITY DEFINER function cannot rewrite history.
reset role;
do $$ begin
  begin update public.stock_logs set note='privileged rewrite' where id='qa-history-opening'; raise exception 'Privileged update incorrectly accepted'; exception when insufficient_privilege then null; end;
  begin delete from public.stock_logs where id='qa-history-opening'; raise exception 'Privileged delete incorrectly accepted'; exception when insufficient_privilege then null; end;
end $$;
rollback;
\echo 'Stock history rehearsal passed; all fixtures and migration changes rolled back.'
