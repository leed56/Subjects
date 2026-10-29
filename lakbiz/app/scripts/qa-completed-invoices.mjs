import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

// Deliberately local-only. Clone the private restore; never use a real shop as
// a test target and never publish the clone or authentication data as artifacts.
const bin = process.env.LAKBIZ_PG_BIN ?? "C:/subject/.lakbiz-ledger-staging/pgsql/bin";
const db = `lakbiz_invoice_qa_${process.pid}`;
assert.match(db, /^lakbiz_invoice_qa_\d+$/);
const run = promisify(execFile);
const tool = (name) => path.join(bin, `${name}${process.platform === "win32" ? ".exe" : ""}`);
const args = ["-h", "127.0.0.1", "-p", "55433", "-U", "postgres"];
const command = async (name, extra, app = "invoice-qa") => (await run(tool(name), [...args, ...extra], {
  timeout: 60_000, maxBuffer: 3_000_000, env: { ...process.env, PGAPPNAME: app },
})).stdout.trim();
const sql = (text, app) => command("psql", ["-d", db, "-X", "-Atq", "-v", "ON_ERROR_STOP=1", "-c", text], app);
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const org = (sector) => `md5('invoice-qa:${sector}')::uuid`;
const user = (sector, role) => createHash("md5").update(`invoice-qa:${sector}:${role}`).digest("hex").replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
const owner = user("grocery", "owner");
const cashier = user("grocery", "cashier");
const outsider = "28400000-0000-4000-8000-000000000003";
const actor = (uid, statement) => `set role authenticated; set request.jwt.claim.sub=${literal(uid)}; ${statement}`;
const denied = (statement, code = "42501") => `do $deny$ begin begin ${statement}; set constraints all immediate; raise exception 'Unexpectedly accepted' using errcode='P9999'; exception when sqlstate '${code}' then null; end; end $deny$;`;
const legacy = (sector, id, changes = "") => `select public.record_completed_invoice(${org(sector)},
 jsonb_build_object('id',${literal(id)},'organization_id',${org(sector)},'bill_no',${literal(id)},'sale_date','2026-10-28T10:00:00Z','total',280,'subtotal',280,'output_vat',0,'discount',0,'profit',999999,'payment_method','cash')${changes},
 jsonb_build_array(jsonb_build_object('sale_id',${literal(id)},'organization_id',${org(sector)},'product_id',${sector === "car_sales" ? "null" : literal(`invoice-qa-${sector}`)},'product_name','QA Product','qty',1,'unit_price',280,'buy_price',999999,'line_order',0)))`;
const atomicLegacy = (id) => `select public.record_completed_invoice(${org("ac_hvac")},
 jsonb_build_object('id',${literal(id)},'organization_id',${org("ac_hvac")},'bill_no',${literal(id)},'sale_date','2026-10-28T10:00:00Z','total',280,'subtotal',280,'output_vat',0,'discount',0,'profit',999999,'payment_method','bank_transfer','customer_id','invoice-qa-ac-customer'),
 jsonb_build_array(jsonb_build_object('sale_id',${literal(id)},'organization_id',${org("ac_hvac")},'product_id','invoice-qa-ac_hvac','product_name','QA Product','qty',1,'unit_price',280,'buy_price',999999,'line_order',0)),
 jsonb_build_object('atomic_side_effects',true,'bank_transaction',jsonb_build_object('id',${literal(`${id}-bank`)},'account_id','invoice-qa-ac-bank','type','deposit','amount',280,'description','QA bank receipt','reference',${literal(id)},'txn_date','2026-10-28'),'stock_logs',jsonb_build_array(jsonb_build_object('id',${literal(`${id}-stock`)},'product_id','invoice-qa-ac_hvac','note',${literal(`Bill ${id}`)},'log_date','2026-10-28T10:00:00Z'))) )`;
const retail = (id, kind = "cash") => `select public.finalize_sale_with_private_tenders_v3(${org("grocery")},${literal(id)},'invoice-qa-customer',null,0,
 '[{"product_id":"invoice-qa-grocery","qty":1,"unit_price":280,"line_order":0}]',
 '[{"id":"${id}-tender","kind":"${kind}","amount":280}]')`;
const fingerprint = "select md5(coalesce(string_agg((to_jsonb(s)-'recorded_xid')::text,'|' order by id),'')) from public.sales_base s";
const results = [];
const check = async (name, work) => { await work(); results.push(name); console.log(`PASS ${name}`); };
await command("createdb", ["--template=lakbiz_staging_fresh", db]);
let success = false;
try {
  assert.equal(await sql("select inet_server_addr()='127.0.0.1'::inet"), "t");
  const before = await sql(fingerprint);
  for (const file of [
    "20261026083545_grocery_optional_mill_import_and_checkout_guards.sql",
    "20261026090000_grocery_optional_meat_catalogue.sql",
    "20261028072641_grocery_catalogue_readiness.sql",
    "20261028081431_stock_movement_append_only.sql",
    "20261028101819_completed_invoice_protection.sql",
    "20261029100000_atomic_legacy_invoice_side_effects.sql",
  ]) await command("psql", ["-d", db, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-1", "-f", path.resolve("../supabase/migrations", file)]);
  await check("migration preserves every existing invoice", async () => assert.equal(await sql(fingerprint), before));
  await sql(`begin;
    insert into auth.users(id) select md5('invoice-qa:'||s||':'||r)::uuid from unnest(array['grocery','ac_hvac','electricals','spare_parts','car_sales']) s cross join unnest(array['owner','cashier']) r;
    insert into auth.users(id) values ('${outsider}');
    insert into public.organizations(id,name,sector) select md5('invoice-qa:'||s)::uuid,'Invoice QA '||s,s from unnest(array['grocery','ac_hvac','electricals','spare_parts','car_sales']) s;
    insert into public.subscriptions(organization_id,plan_id,status) select md5('invoice-qa:'||s)::uuid,'pro','active' from unnest(array['grocery','ac_hvac','electricals','spare_parts','car_sales']) s;
    insert into public.org_members(organization_id,user_id,role) select md5('invoice-qa:'||s)::uuid,md5('invoice-qa:'||s||':owner')::uuid,'owner'::public.org_role from unnest(array['grocery','ac_hvac','electricals','spare_parts','car_sales']) s;
    insert into public.org_members(organization_id,user_id,role) select md5('invoice-qa:'||s)::uuid,md5('invoice-qa:'||s||':cashier')::uuid,'cashier'::public.org_role from unnest(array['grocery','ac_hvac','electricals','spare_parts']) s;
    insert into public.products_base(id,organization_id,name,category,sector_id,buy_price,sell_price,stock_qty,unit,active,custom_fields,condition)
      select 'invoice-qa-'||s,md5('invoice-qa:'||s)::uuid,'QA Product','QA',s,180,280,10,'pcs',true,'{}','new' from unnest(array['grocery','ac_hvac','electricals','spare_parts']) s;
    insert into public.vehicles_base(id,organization_id,stock_id,make,model,year,chassis_no,purchase_price,recondition_cost,ask_price)
      values('invoice-qa-vehicle',${org("car_sales")},'QA-001','QA','Vehicle',2025,'QA-CHASSIS',180,0,280);
    insert into public.customers(id,organization_id,name) values('invoice-qa-customer',${org("grocery")},'QA Customer');
    insert into public.customers(id,organization_id,name) values('invoice-qa-ac-customer',${org("ac_hvac")},'AC QA Customer');
    insert into public.bank_accounts(id,organization_id,bank_name,account_name,account_number,balance) values('invoice-qa-ac-bank',${org("ac_hvac")},'QA Bank','AC QA','0001',0);
    update public.sector_modules set allowed=false where sector_id='grocery' and module_key='banking';
    commit;`);
  await check("read-only readiness is role- and sector-scoped", async () => {
    assert.equal(await sql(actor(user("ac_hvac", "cashier"), `select public.completed_invoice_commit_ready(${org("ac_hvac")})`)), "t");
    assert.equal(await sql(actor(outsider, `select public.completed_invoice_commit_ready(${org("ac_hvac")})`)), "f");
    assert.equal(await sql(actor(cashier, `select public.completed_invoice_commit_ready(${org("grocery")})`)), "f");
  });
  await check("retail checkout and replay remain atomic", async () => {
    const first = JSON.parse(await sql(actor(cashier, retail("invoice-qa-retail"))));
    const second = JSON.parse(await sql(actor(cashier, retail("invoice-qa-retail"))));
    assert.equal(first.replayed, false); assert.equal(second.replayed, true);
    assert.equal(await sql("select stock_qty from public.products_base where id='invoice-qa-grocery'"), "9.000");
  });
  await check("external transfer can correct its new header before commit", async () => {
    const result = JSON.parse(await sql(actor(cashier, retail("invoice-qa-transfer", "bank_transfer"))));
    assert.equal(result.payment_method, "bank_transfer");
    assert.equal(await sql("select payment_method from public.sales_base where id='invoice-qa-transfer'"), "bank_transfer");
  });
  for (const sector of ["ac_hvac", "electricals", "spare_parts", "car_sales"]) {
    const id = sector === "car_sales" ? "invoice-qa-vehicle" : `invoice-qa-legacy-${sector}`;
    await check(`${sector} legacy invoice commits once with server-derived cost`, async () => {
      const uid = user(sector, sector === "car_sales" ? "owner" : "cashier");
      assert.equal(JSON.parse(await sql(actor(uid, legacy(sector, id)))).replayed, false);
      assert.equal(JSON.parse(await sql(actor(uid, legacy(sector, id)))).replayed, true);
      assert.equal(await sql(`select profit=100 and (select count(*)=1 from public.sale_lines_base where sale_id=${literal(id)}) from public.sales_base where id=${literal(id)}`), "t");
      await sql(actor(uid, denied(legacy(sector, id, "||'{\"total\":1}'::jsonb"))));
    });
  }
  await check("legacy invoice side effects commit atomically and replay idempotently", async () => {
    const query = actor(user("ac_hvac", "cashier"), atomicLegacy("invoice-qa-atomic-side"));
    const first = JSON.parse(await sql(query));
    const second = JSON.parse(await sql(query));
    assert.equal(first.replayed, false); assert.equal(second.replayed, true);
    assert.equal(await sql("select stock_qty from public.products_base where id='invoice-qa-ac_hvac'"), "9.000");
    assert.equal(await sql("select count(*) from public.stock_logs where id='invoice-qa-atomic-side-stock'"), "1");
    assert.equal(await sql("select count(*) from public.bank_transactions where id='invoice-qa-atomic-side-bank'"), "1");
    assert.equal(await sql("select balance from public.bank_accounts where id='invoice-qa-ac-bank'"), "280.00");
    assert.equal(await sql("select credit_balance from public.customers where id='invoice-qa-ac-customer'"), "0.00");
  });
  await check("owner and cashier cannot edit, delete or append completed invoice lines", async () => {
    for (const uid of [owner, cashier]) {
      for (const statement of [
        "update public.sales set total=1 where id='invoice-qa-retail'",
        "delete from public.sales where id='invoice-qa-retail'",
        "update public.sale_lines set unit_price=1 where sale_id='invoice-qa-retail'",
        "delete from public.sale_lines where sale_id='invoice-qa-retail'",
        `insert into public.sale_lines(sale_id,organization_id,product_id,product_name,qty,unit_price,buy_price,line_order) values('invoice-qa-retail',${org("grocery")},'invoice-qa-grocery','QA Product',1,280,180,1)`,
        "update public.sales_base set total=1 where id='invoice-qa-retail'",
        "select * from public.sale_lines_base",
      ]) await sql(actor(uid, denied(statement)));
    }
    await sql(denied("update public.sales_base set total=1 where id='invoice-qa-retail'"));
    await sql(denied("update public.sale_lines_base set qty=9 where sale_id='invoice-qa-retail'"));
    await sql(denied(`insert into public.sale_lines_base(sale_id,organization_id,product_id,product_name,qty,unit_price,buy_price,line_order) values('invoice-qa-retail',${org("grocery")},'invoice-qa-grocery','QA Product',1,280,180,1)`));
    await sql(actor(owner, denied("select public.bulk_update_masked_view_rows('sales','[{\"id\":\"invoice-qa-retail\",\"total\":1}]')")));
  });
  await check("empty headers and partial invoices cannot commit", async () => {
    const empty = `insert into public.sales(id,organization_id,bill_no,sale_date,subtotal,output_vat,discount,total,profit,payment_method,credit_amount) values('invoice-qa-empty',${org("ac_hvac")},'EMPTY',now(),280,0,0,280,100,'cash',0)`;
    await sql(actor(user("ac_hvac", "owner"), denied(empty)));
    await sql(denied(empty.replace("public.sales(", "public.sales_base("), "23514"));
    assert.equal(await sql("select count(*) from public.sales_base where id='invoice-qa-empty'"), "0");
  });
  await check("historical product/customer references are retained", async () => {
    await sql(denied("delete from public.products_base where id='invoice-qa-grocery'", "23503"));
    await sql(denied("delete from public.customers where id='invoice-qa-customer'", "23503"));
  });
  await check("shop isolation and retail-backdoor denial", async () => {
    await sql(actor(outsider, denied(legacy("ac_hvac", "invoice-qa-foreign"))));
    await sql(actor(owner, denied(legacy("grocery", "invoice-qa-backdoor"))));
    assert.equal(await sql(actor(outsider, "select count(*) from public.sales where id='invoice-qa-retail'")), "0");
  });
  await check("cashier price overrides are rejected by the legacy commit", async () => {
    const request = legacy("ac_hvac", "invoice-qa-price-override", "||'{\"total\":1}'::jsonb").replace("'unit_price',280", "'unit_price',1");
    await sql(actor(user("ac_hvac", "cashier"), denied(request)));
    assert.equal(await sql("select count(*) from public.sales_base where id='invoice-qa-price-override'"), "0");
  });
  await check("concurrent confirmations create one completed invoice", async () => {
    const query = actor(user("ac_hvac", "cashier"), legacy("ac_hvac", "invoice-qa-concurrent"));
    const replies = await Promise.all([sql(query), sql(query)]);
    assert.deepEqual(replies.map((row) => JSON.parse(row).replayed).sort(), [false, true]);
    assert.equal(await sql("select count(*) from public.sale_lines_base where sale_id='invoice-qa-concurrent'"), "1");
  });
  await check("interrupted header/line transaction rolls back and safely retries", async () => {
    await sql(`create function ledger_internal.qa_pause_invoice() returns trigger language plpgsql as $$ begin if new.sale_id='invoice-qa-interrupted' then perform pg_sleep(20); end if; return new; end $$;
      create trigger qa_pause_invoice before insert on public.sale_lines_base for each row execute function ledger_internal.qa_pause_invoice();`);
    const app = `invoice-qa-interrupt-${process.pid}`;
    const interrupted = sql(actor(user("ac_hvac", "cashier"), legacy("ac_hvac", "invoice-qa-interrupted")), app).then(() => "unexpected success", () => "terminated");
    let pid = "";
    for (let attempt = 0; attempt < 30; attempt += 1) {
      pid = await sql(`select pid from pg_stat_activity where datname=${literal(db)} and application_name=${literal(app)} and wait_event='PgSleep'`);
      if (pid) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.match(pid, /^\d+$/);
    assert.equal(await sql(`select pg_terminate_backend(${Number(pid)})`), "t");
    assert.equal(await interrupted, "terminated");
    assert.equal(await sql("select count(*) from public.sales_base where id='invoice-qa-interrupted'"), "0");
    await sql("drop trigger qa_pause_invoice on public.sale_lines_base; drop function ledger_internal.qa_pause_invoice()");
    assert.equal(JSON.parse(await sql(actor(user("ac_hvac", "cashier"), legacy("ac_hvac", "invoice-qa-interrupted")))).replayed, false);
  });
  await check("returns append evidence without mutating the original invoice", async () => {
    const query = `select public.process_sale_return(${org("grocery")},'invoice-qa-retail','28500000-0000-4000-8000-000000000001','Inspected return','[{"line_order":0,"qty":1,"restock":true}]')`;
    assert.equal(JSON.parse(await sql(actor(owner, query))).replayed, false);
    assert.equal(JSON.parse(await sql(actor(owner, query))).replayed, true);
    assert.equal(await sql("select stock_qty from public.products_base where id='invoice-qa-grocery'"), "9.000");
    assert.equal(await sql("select qty=1 and unit_price=280 from public.sale_lines_base where sale_id='invoice-qa-retail'"), "t");
  });
  await check("editing current product/customer details preserves historical invoice snapshots", async () => {
    await sql(actor(owner, "update public.products set sell_price=300,buy_price=190 where id='invoice-qa-grocery'; update public.customers set name='Renamed Customer' where id='invoice-qa-customer'"));
    assert.equal(await sql("select unit_price=280 and buy_price=180 from public.sale_lines_base where sale_id='invoice-qa-retail'"), "t");
    assert.equal(await sql("select customer_name='QA Customer' from public.sales_base where id='invoice-qa-retail'"), "t");
  });
  await check("creation registrations never survive a commit or enter a logical backup", async () => {
    assert.equal(await sql("select count(*) from ledger_internal.open_invoice_commits"), "0");
    await sql(actor(owner, denied("select * from ledger_internal.open_invoice_commits")));
  });
  await mkdir(".qa-sector-isolation/invoices", { recursive: true });
  await writeFile(".qa-sector-isolation/invoices/results.json", JSON.stringify({ localOnly: true, fullSupabaseServices: false, results }, null, 2));
  success = true;
} finally {
  if (success) await command("dropdb", ["--force", db]);
  else console.error(`Local diagnostic database retained: ${db}`);
}
