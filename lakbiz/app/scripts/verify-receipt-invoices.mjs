/** Receipt-linked invoice authority fixtures. Synthetic local companies only. */
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function verifyReceiptInvoices({db,Client,nativeUrl,org,owner,outsider,role}) {
  let checks=0;const pass=label=>{checks++;console.log(`PASS receipt invoices: ${label}`);};
  const scalar=async(sql,key)=>(await db.query(sql)).rows[0][key];
  async function rejects(sql,label){await assert.rejects(()=>db.exec(sql));await db.exec('rollback');pass(label);}
  await db.exec(`reset role;alter table suppliers add column payable_balance numeric(14,2) not null default 0;
    update suppliers set payable_balance=25 where id='receipt-supplier';grant select,update on suppliers to authenticated;`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261016172522_purchase_receipt_supplier_invoices.sql',import.meta.url),'utf8'));
  await role(owner);
  const orderId='a1010101-0101-4101-8101-010101010101';
  const deliveries=['a2020202-0202-4202-8202-020202020202','a3030303-0303-4303-8303-030303030303','a4040404-0404-4404-8404-040404040404'];
  const key='a5050505-0505-4505-8505-050505050505';
  await db.exec(`select create_purchase_order_atomic('${org}','${orderId}','${JSON.stringify({supplierId:'receipt-supplier',lines:[{productId:'receipt-product',qty:10,unitCost:8}]})}')`);
  const line=await scalar(`select id from purchase_order_lines where purchase_order_id='${orderId}'`,'id');
  const receive=(id,qty,expected)=>`select receive_purchase_order_atomic('${org}','${orderId}','${id}','${JSON.stringify([{line_id:line,qty,expected_received:expected}])}')`;
  await db.exec(receive(deliveries[0],3,0));await db.exec(receive(deliveries[1],2,3));
  const rates=ids=>ids.map(receipt_id=>({receipt_id,line_id:line,unit_cost:9.5}));
  const invoice=({id=key,ids=deliveries.slice(0,2),number=' INV-001 ',vat=8.55,lines=rates(ids),tenant=org}={})=>
    `select record_purchase_receipt_invoice_atomic('${tenant}','${id}',array[${ids.map(id=>`'${id}'::uuid`).join(',')}],'${number}','2026-10-16','${vat}','${JSON.stringify(lines)}') as result`;
  const beforeQty=Number(await scalar("select stock_qty from products_base where id='receipt-product'",'stock_qty'));
  const beforeCustody=Number(await scalar("select qty_on_hand from inventory_location_balances where product_id='receipt-product'",'qty_on_hand'));
  const beforeLogs=Number(await scalar('select count(*) as n from stock_logs','n'));
  await rejects(invoice(),'invoice authority starts disabled');
  await db.exec(`reset role;insert into purchase_invoice_settings values('${org}',true)`);
  await role(outsider);await rejects(invoice(),'another company owner cannot bill these deliveries');
  await role(owner,'anon');await rejects(invoice(),'anonymous invoice calls are revoked');
  await role(owner);
  await rejects('update purchase_invoice_settings set enabled=false','client cannot enable or disable invoice authority');
  await rejects(invoice({ids:[deliveries[0],deliveries[0]]}),'duplicate delivery IDs are rejected');
  await rejects(invoice({lines:[]}), 'missing invoice line rates are rejected');
  await rejects(invoice({lines:[...rates(deliveries.slice(0,2)),...rates([deliveries[0]])]}),'duplicate line rates are rejected');
  await rejects(invoice({lines:rates([deliveries[0]])}),'every selected delivery line must be billed');
  await rejects(invoice({lines:[...rates([deliveries[0]]),{receipt_id:deliveries[1],line_id:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',unit_cost:1}]}),'invented receipt line identity is rejected');
  for(const bad of ['NaN','Infinity',-1,0.001]) await rejects(invoice({vat:bad}),`invalid input VAT ${bad} is rejected`);
  for(const bad of ['NaN','Infinity',-1,1.001]) await rejects(invoice({lines:rates(deliveries.slice(0,2)).map((line,i)=>i?line:{...line,unit_cost:bad})}),`invalid invoice cost ${bad} is rejected`);
  assert.equal(Number(await scalar('select count(*) as n from purchase_receipt_invoices','n')),0);
  assert.equal(Number(await scalar("select payable_balance from suppliers where id='receipt-supplier'",'payable_balance')),25);
  pass('rejected invoices leave no allocations, documents or payable change');
  const first=await scalar(invoice(),'result');
  assert.equal(Number(first.subtotal_minor),4750);assert.equal(Number(first.input_vat_minor),855);assert.equal(Number(first.total_minor),5605);assert.equal(first.created_by,owner);
  assert.equal(Number(await scalar("select payable_balance from suppliers where id='receipt-supplier'",'payable_balance')),81.05);
  pass('two partial deliveries form one credit invoice with separate VAT and exact payable');
  assert.equal(Number(await scalar("select stock_qty from products_base where id='receipt-product'",'stock_qty')),beforeQty);
  assert.equal(Number(await scalar("select qty_on_hand from inventory_location_balances where product_id='receipt-product'",'qty_on_hand')),beforeCustody);
  assert.equal(Number(await scalar('select count(*) as n from stock_logs','n')),beforeLogs);
  assert.equal(Number(await scalar("select buy_price from products_base where id='receipt-product'",'buy_price')),8);
  pass('billing does not re-receive stock, write another stock log or rewrite receipt cost');
  assert.deepEqual(await scalar(invoice({ids:deliveries.slice(0,2).reverse(),number:'inv-001',lines:rates(deliveries.slice(0,2)).reverse()}),'result'),first);
  assert.equal(Number(await scalar("select payable_balance from suppliers where id='receipt-supplier'",'payable_balance')),81.05);
  pass('reordered identical retry returns original invoice without adding payable twice');
  await rejects(invoice({vat:9}),'same invoice key cannot carry changed amounts');
  await rejects(invoice({id:'a6060606-0606-4606-8606-060606060606',number:'INV-002'}),'another invoice cannot consume already billed receipts');
  await rejects(`update suppliers set payable_balance=0 where id='receipt-supplier'`,'legacy snapshot cannot overwrite the authoritative payable');
  await db.exec(`update suppliers set name=name where id='receipt-supplier'`);pass('nonfinancial supplier metadata remains editable');
  await rejects('delete from purchase_receipt_invoices','invoice audit is immutable to the application');
  await rejects('update purchase_receipt_invoice_lines set qty=99','invoice lines cannot be changed directly');
  await role(outsider);assert.equal(Number(await scalar('select count(*) as n from purchase_receipt_invoices','n')),0);pass('invoice amounts are hidden from other companies');
  await db.exec(`reset role;update org_members set role='manager' where organization_id='${org}' and user_id='${owner}'`);
  await role(owner);await rejects(invoice(),'manager cannot bypass owner financial authority');assert.equal(Number(await scalar('select count(*) as n from purchase_receipt_invoice_lines','n')),0);pass('manager cannot read invoice cost lines');
  await db.exec(`reset role;update org_members set role='owner' where organization_id='${org}' and user_id='${owner}'`);await role(owner);
  await db.exec(receive(deliveries[2],1,5));
  await rejects(invoice({id:'abababab-abab-4aba-8aba-abababababab',ids:[deliveries[2],'95959595-9595-4959-8959-959595959595'],number:'MIXED-ORDERS',vat:0}),'deliveries from different purchase orders cannot be combined');
  await rejects(invoice({id:'a7070707-0707-4707-8707-070707070707',ids:[deliveries[2]],number:'inv-001',vat:0}),'supplier invoice number cannot be repeated with different receipts');
  assert.equal(Number(await scalar(`select count(*) as n from purchase_invoice_receipts where receipt_id='${deliveries[2]}'`,'n')),0);pass('duplicate invoice-number failure rolls back receipt allocation');
  await db.exec(`reset role;update suppliers set payable_balance=999999999999.99 where id='receipt-supplier'`);await role(owner);
  await rejects(invoice({id:'a8080808-0808-4808-8808-080808080808',ids:[deliveries[2]],number:'OVERFLOW',vat:0}),'payable overflow rolls back invoice and every allocation');
  assert.equal(Number(await scalar(`select count(*) as n from purchase_receipt_invoices where supplier_invoice_no='OVERFLOW'`,'n')),0);
  assert.equal(Number(await scalar(`select count(*) as n from purchase_invoice_receipts where receipt_id='${deliveries[2]}'`,'n')),0);pass('failed payable posting leaves no document or receipt reservation');
  await db.exec(`reset role;update suppliers set payable_balance=81.05 where id='receipt-supplier'`);await role(owner);
  const fractional='b4040404-0404-4404-8404-040404040404';
  await db.exec(receive(fractional,0.333,6));
  const rounded=await scalar(invoice({id:'b5050505-0505-4505-8505-050505050505',ids:[fractional],number:'ROUNDING',vat:0,
    lines:[{receipt_id:fractional,line_id:line,unit_cost:0.05,qty:999999}]}),'result');
  assert.equal(Number(rounded.total_minor),2);assert.equal(rounded.currency,'LKR');
  assert.equal(Number(await scalar(`select qty from purchase_receipt_invoice_lines where receipt_id='${fractional}'`,'qty')),0.333);
  pass('three-decimal fabric quantity uses exact line rounding and ignores invented client quantities');
  assert.equal(Number(await scalar("select payable_balance from suppliers where id='receipt-supplier'",'payable_balance')),81.07);
  pass('fractional invoice adds exactly two minor units to the supplier payable');
  if(nativeUrl){
    await db.exec('reset role;alter table stock_logs add constraint invoice_fixture_supplier_fk foreign key(related_supplier_id) references suppliers(id)');
    await role(owner);
    async function race(sqls){const clients=await Promise.all(sqls.map(async()=>{const c=new Client({connectionString:nativeUrl});await c.connect();await c.query(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`);return c;}));
      try{return await Promise.allSettled(sqls.map((sql,i)=>clients[i].query(sql)));}finally{await Promise.all(clients.map(c=>c.end()));}}
    const retry=invoice({id:'a9090909-0909-4909-8909-090909090909',ids:[deliveries[2]],number:'RACE-RETRY',vat:0});
    let results=await race([retry,retry]);assert.equal(results.filter(row=>row.status==='fulfilled').length,2);
    assert.equal(Number(await scalar("select payable_balance from suppliers where id='receipt-supplier'",'payable_balance')),90.57);pass('native Postgres: simultaneous invoice retries add payable once');
    const next='b1010101-0101-4101-8101-010101010101';await db.exec(receive(next,1,6.333));
    results=await race(['b2020202-0202-4202-8202-020202020202','b3030303-0303-4303-8303-030303030303'].map((id,i)=>invoice({id,ids:[next],number:`RACE-COMPETE-${i}`,vat:0})));
    assert.equal(results.filter(row=>row.status==='fulfilled').length,1);assert.equal(Number(await scalar("select payable_balance from suppliers where id='receipt-supplier'",'payable_balance')),100.07);pass('native Postgres: competing invoices cannot bill the same receipt twice');
    const billable='c1010101-0101-4101-8101-010101010101',otherOrder='c2020202-0202-4202-8202-020202020202';
    await db.exec(receive(billable,0.5,7.333));
    await db.exec(`select create_purchase_order_atomic('${org}','${otherOrder}','${JSON.stringify({supplierId:'receipt-supplier',lines:[{productId:'receipt-product',qty:1,unitCost:8}]})}')`);
    const otherLine=await scalar(`select id from purchase_order_lines where purchase_order_id='${otherOrder}'`,'id');
    results=await race([invoice({id:'c3030303-0303-4303-8303-030303030303',ids:[billable],number:'INVOICE-VS-RECEIVE',vat:0}),
      `select receive_purchase_order_atomic('${org}','${otherOrder}','c4040404-0404-4404-8404-040404040404','${JSON.stringify([{line_id:otherLine,qty:1,expected_received:0}])}')`]);
    assert.equal(results.filter(row=>row.status==='fulfilled').length,2);
    assert.equal(Number(await scalar("select payable_balance from suppliers where id='receipt-supplier'",'payable_balance')),104.82);
    pass('native Postgres: invoice and another PO receipt share product/supplier locks without deadlock');
  }
  console.log(`Receipt invoice authority: ${checks} checks passed.`);
}
