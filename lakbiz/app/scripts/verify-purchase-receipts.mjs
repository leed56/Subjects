/** Runs inside the isolated inventory authority fixture, never a live company. */
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function verifyPurchaseReceipts({db,Client,nativeUrl,org,owner,outsider,role}) {
  let checks=0;
  const pass=label=>{checks++; console.log(`PASS purchasing: ${label}`);};
  const scalar=async(sql,key)=>(await db.query(sql)).rows[0][key];
  async function rejects(sql,label) { await assert.rejects(()=>db.exec(sql)); await db.exec('rollback'); pass(label); }
  const line='51515151-5151-4515-8515-515151515151';
  const serialLine='59595959-5959-4595-8595-595959595959';
  const receipt='61616161-6161-4616-8616-616161616161';
  const nextReceipt='62626262-6262-4626-8626-626262626262';
  const payload=(qty,expected=0,id=line)=>JSON.stringify([{line_id:id,qty,expected_received:expected}]);
  const call=(key,lines,po='receipt-po',tenant=org)=>`select receive_purchase_order_atomic('${tenant}','${po}','${key}','${lines}') as result`;
  await db.exec(`reset role;
    alter table products_base add column buy_price numeric(14,2) not null default 0;
    create function can_see_org_financials(o uuid) returns boolean language sql stable as
      $$select public.org_member_role_in(o,array['owner'])$$;
    create or replace function org_member_can_write_module(o uuid,m text) returns boolean
      language sql stable security definer set search_path='' as
      $$select m in ('stock','suppliers') and exists(select 1 from public.org_members where organization_id=o and user_id=auth.uid())$$;
    insert into suppliers values('receipt-supplier','${org}');
    insert into products_base(id,organization_id,name,stock_qty) values('receipt-product','${org}','Receipt stock',0);
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20250709000001_purchase_orders.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20261016160646_purchase_order_receipt_authority.sql',import.meta.url),'utf8'));
  await db.exec(`grant select,insert,update,delete on purchase_orders,purchase_order_lines to authenticated;
    insert into purchase_orders(id,organization_id,po_no,supplier_id,supplier_name) values
      ('receipt-po','${org}','PO-001','receipt-supplier','Supplier');
    insert into purchase_order_lines(id,purchase_order_id,organization_id,product_id,product_name,qty_ordered,unit_cost)
      values('${line}','receipt-po','${org}','receipt-product','Receipt stock',10,8);
  `);
  await role(owner);
  await rejects(call(receipt,payload(4)),'receiving disabled by default');
  await db.exec(`reset role;insert into purchase_receipt_settings values('${org}',true)`);
  await db.exec(`update inventory_transfer_settings set enabled=false where organization_id='${org}'`);
  await role(owner);
  await rejects(call(receipt,payload(4)),'receiving cannot bypass inactive location authority');
  await db.exec(`reset role;update inventory_transfer_settings set enabled=true where organization_id='${org}'`);
  await role(outsider);
  await rejects(call(receipt,payload(4)),'another tenant cannot receive the order');
  await role(owner,'anon');
  await rejects(call(receipt,payload(4)),'anonymous execution is revoked');
  await role(owner);
  await rejects(`update purchase_receipt_settings set enabled=false`,'client cannot activate or deactivate authority');
  await rejects(`update purchase_order_lines set qty_received=9 where id='${line}'`,'legacy snapshot cannot overwrite enabled receipt lines');
  await rejects(call(receipt,payload(11)),'over-receiving is rejected rather than silently capped');
  await rejects(call(receipt,payload(1,0,'71717171-7171-4717-8717-717171717171')),'unknown stable line ID is rejected');
  await rejects(call(receipt,JSON.stringify([{line_id:line,qty:1,expected_received:0},{line_id:line,qty:1,expected_received:0}])),'duplicate receipt line IDs are rejected');
  for(const qty of ['NaN','Infinity',-1,0,0.0001]) await rejects(call(receipt,payload(qty)),`invalid quantity ${qty} is rejected`);
  const first=await scalar(call(receipt,payload(4)),'result');
  assert.equal(first.status,'partial');
  assert.equal(Number(await scalar("select stock_qty from products_base where id='receipt-product'",'stock_qty')),4);
  assert.equal(Number(await scalar("select qty_on_hand from inventory_location_balances where product_id='receipt-product'",'qty_on_hand')),4);
  assert.equal(Number(await scalar("select buy_price from products_base where id='receipt-product'",'buy_price')),8);
  assert.equal(await scalar("select user_id from stock_logs where product_id='receipt-product'",'user_id'),owner);
  pass('partial receipt updates order, source stock, cost and location together');
  assert.deepEqual(await scalar(call(receipt,payload(4)),'result'),first);
  assert.equal(Number(await scalar("select count(*) as n from stock_logs where product_id='receipt-product'",'n')),1);
  pass('same delivery retry returns the original result without duplicate stock or audit');
  await rejects(call(receipt,payload(5)),'changed replay payload is rejected');
  await rejects(call(nextReceipt,payload(2)),'stale expected received quantity is rejected');
  await db.exec(`reset role;insert into stock_logs(id,organization_id,product_id,product_name,log_type,qty)
    values('po-receipt:${nextReceipt}:${line}','${org}','receipt-product','Collision','purchase',0)`);
  await role(owner);
  await rejects(call(nextReceipt,payload(2,4)),'audit insertion failure rolls back the complete receipt');
  assert.equal(Number(await scalar("select stock_qty from products_base where id='receipt-product'",'stock_qty')),4);
  assert.equal(Number(await scalar("select qty_on_hand from inventory_location_balances where product_id='receipt-product'",'qty_on_hand')),4);
  assert.equal(Number(await scalar(`select qty_received from purchase_order_lines where id='${line}'`,'qty_received')),4);
  assert.equal(Number(await scalar(`select count(*) as n from purchase_order_receipts where receipt_id='${nextReceipt}'`,'n')),0);
  pass('failed receipt leaves neither partial quantities nor a replay marker');
  await db.exec(`reset role;delete from stock_logs where id='po-receipt:${nextReceipt}:${line}';
    insert into purchase_order_lines(id,purchase_order_id,organization_id,product_id,product_name,qty_ordered,unit_cost)
      values('${serialLine}','receipt-po','${org}','serial-product','Tracked',1,10)`);
  await role(owner);
  const mixed=JSON.stringify([{line_id:line,qty:1,expected_received:4},{line_id:serialLine,qty:1,expected_received:0}]);
  await rejects(call(nextReceipt,mixed),'tracked second line rolls back earlier simple line');
  assert.equal(Number(await scalar("select stock_qty from products_base where id='receipt-product'",'stock_qty')),4);
  pass('mixed unsupported receipt remains fully atomic');
  await db.exec(`reset role;delete from purchase_order_lines where id='${serialLine}';
    update org_members set role='cashier' where organization_id='${org}' and user_id='${owner}'`);
  await role(owner);
  await rejects(call(nextReceipt,payload(1,4)),'cashier cannot invoke financial receiving');
  assert.equal((await db.query(`update purchase_order_lines set qty_received=0 where id='${line}' returning id`)).rows.length,0);
  pass('RLS hides order lines from nonfinancial legacy writers');
  assert.equal(Number(await scalar('select count(*) as n from purchase_order_receipts','n')),0);
  pass('nonfinancial role cannot read receipt audit');
  await db.exec(`reset role;update org_members set role='owner' where organization_id='${org}' and user_id='${owner}'`);
  await role(owner);
  await db.exec(call(nextReceipt,payload(6,4)));
  assert.equal(await scalar("select status from purchase_orders where id='receipt-po'",'status'),'received');
  assert.equal(Number(await scalar("select stock_qty from products_base where id='receipt-product'",'stock_qty')),10);
  pass('final partial delivery completes the order with exact movement totals');
  assert.deepEqual(await scalar(call(receipt,payload(4)),'result'),first);
  pass('earlier delivery retry still returns its original result after order completion');
  await rejects(call('63636363-6363-4636-8636-636363636363',payload(1,10)),'completed order rejects new deliveries');
  await rejects('delete from purchase_order_receipts','receipt audit cannot be deleted by app');
  await db.exec(`reset role;update org_members set role='manager' where organization_id='${org}' and user_id='${owner}'`);
  await role(owner);
  await rejects(call('64646464-6464-4646-8646-646464646464',payload(1,10)),'manager cannot bypass owner-only financial authority');
  assert.equal(Number(await scalar('select count(*) as n from purchase_order_receipts','n')),0);
  pass('manager cannot read owner-only receipt audit');
  await db.exec(`reset role;update org_members set role='owner' where organization_id='${org}' and user_id='${owner}'`);
  await role(owner);

  if(nativeUrl) {
    await db.exec(`reset role;update purchase_orders set status='pending' where id='receipt-po';
      update purchase_order_lines set qty_received=0,qty_ordered=20 where id='${line}'`);
    async function race(sqls) {
      const clients=await Promise.all(sqls.map(async()=>{
        const client=new Client({connectionString:nativeUrl});await client.connect();
        await client.query(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`);return client;
      }));
      try{return await Promise.allSettled(sqls.map((sql,i)=>clients[i].query(sql)));}
      finally{await Promise.all(clients.map(client=>client.end()));}
    }
    let results=await race(['81818181-8181-4818-8818-818181818181','82828282-8282-4828-8828-828282828282'].map(key=>call(key,payload(7))));
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(Number(await scalar("select stock_qty from products_base where id='receipt-product'",'stock_qty')),17);
    pass('native Postgres: two devices cannot receive from the same stale order balance');
    const retry=call('83838383-8383-4838-8838-838383838383',payload(2,7));
    results=await race([retry,retry]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,2);
    assert.equal(Number(await scalar("select stock_qty from products_base where id='receipt-product'",'stock_qty')),19);
    pass('native Postgres: simultaneous identical retries commit one delivery');
  }
  console.log(`Purchase receipt authority: ${checks} checks passed.`);
}
