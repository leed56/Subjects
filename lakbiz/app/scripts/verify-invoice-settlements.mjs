import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
export async function verifyInvoiceSettlements({db,Client,nativeUrl,org,owner,outsider,role}) {
  let count=0; const pass=label=>{count++;console.log(`PASS invoice settlements: ${label}`)};
  const scalar=async(sql,key)=>(await db.query(sql)).rows[0][key];
  async function rejects(sql,label){await assert.rejects(()=>db.exec(sql));await db.exec('rollback');pass(label)}
  await db.exec(`reset role;
    create table purchases(id text primary key,organization_id uuid,supplier_id text,grn_no text,purchase_date timestamptz,credit_amount numeric(14,2));
    create table supplier_payments(id text primary key,organization_id uuid,supplier_id text,method text,payment_date timestamptz,amount numeric(14,2));
    create table purchase_lines(id uuid primary key,organization_id uuid);
    grant select,insert,update,delete on purchases,purchase_lines,supplier_payments to authenticated;`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261017025855_purchase_invoice_cash_settlements.sql',import.meta.url),'utf8'));
  await role(owner);
  await rejects(`insert into supplier_payments values('forged','${org}','receipt-supplier','cash',now(),1)`,'enabled authority rejects direct legacy payment insertion');
  await rejects(`insert into purchases values('forged','${org}','receipt-supplier','FORGED',now(),1)`,'enabled authority rejects direct legacy GRN insertion');
  await rejects(`insert into purchase_lines values('d9999999-9999-4999-8999-999999999999','${org}')`,'enabled authority rejects legacy purchase-line insertion');
  const invoice='a5050505-0505-4505-8505-050505050505'; // existing 56.05 LKR invoice
  const id='d1010101-0101-4101-8101-010101010101';
  const pay=({key=id,bill=invoice,amount=10,date='2026-10-16',note=' Cash receipt 001 ',tenant=org}={})=>`select settle_purchase_invoice_cash_atomic('${tenant}','${key}','${bill}','${amount}','${date}','${note}') as result`;
  const before=Number(await scalar("select payable_balance from suppliers where id='receipt-supplier'",'payable_balance'));
  const stock=await scalar("select stock_qty from products_base where id='receipt-product'",'stock_qty');
  const logs=await scalar('select count(*) as n from stock_logs','n');
  await db.exec(`reset role;update purchase_invoice_settings set enabled=false where organization_id='${org}'`);await role(owner);
  await rejects(pay(),'disabled invoice authority blocks settlement');
  await db.exec(`reset role;update purchase_invoice_settings set enabled=true where organization_id='${org}'`);await role(outsider);
  await rejects(pay(),'another company cannot settle this invoice');
  await rejects(`select get_purchase_supplier_statement('${org}','receipt-supplier')`,'another company cannot read statement');
  await role(owner,'anon');await rejects(pay(),'anonymous settlement is revoked');
  await role(owner);
  for(const amount of [0,-1,'NaN','Infinity',0.001,56.06])await rejects(pay({amount}),`reject invalid or excessive payment ${amount}`);
  await rejects(pay({date:'2026-10-15'}),'payment cannot precede invoice');
  const first=await scalar(pay(),'result');assert.equal(Number(first.amount_minor),1000);assert.equal(first.note,'Cash receipt 001');assert.equal(first.created_by,owner);pass('cash settlement records exact amount and server actor');
  assert.equal(Number(await scalar("select payable_balance from suppliers where id='receipt-supplier'",'payable_balance')),before-10);pass('partial settlement decreases supplier payable once');
  assert.deepEqual(await scalar(pay(),'result'),first);assert.equal(Number(await scalar("select payable_balance from suppliers where id='receipt-supplier'",'payable_balance')),before-10);pass('identical retry returns original result without another payment');
  await rejects(pay({amount:11}),'changed replay payload is rejected');
  await rejects(`update purchase_invoice_cash_settlements set amount_minor=1`,'client cannot rewrite payment audit');
  await rejects(`delete from purchase_invoice_cash_settlements`,'client cannot delete settlement');
  let summary=await scalar(`select get_purchase_invoice_settlement('${org}','${invoice}') as result`,'result');
  assert.equal(Number(summary.paid_minor),1000);assert.equal(Number(summary.total_minor),5605);assert.equal(summary.payments.length,1);pass('invoice summary exposes paid and outstanding amounts');
  await db.exec(`reset role;update suppliers set payable_balance=0 where id='receipt-supplier'`);await role(owner);
  await rejects(pay({key:'d2020202-0202-4202-8202-020202020202',amount:1}),'inconsistent supplier payable blocks payment');
  assert.equal(Number(await scalar('select count(*) as n from purchase_invoice_cash_settlements','n')),1);pass('failed settlement leaves no audit row');
  await db.exec(`reset role;update suppliers set payable_balance=${before-10} where id='receipt-supplier';update org_members set role='manager' where user_id='${owner}' and organization_id='${org}'`);await role(owner);
  await rejects(pay(),'manager cannot settle owner invoices');
  assert.equal(Number(await scalar('select count(*) as n from purchase_invoice_cash_settlements','n')),0);pass('manager cannot read settlement amounts');
  await db.exec(`reset role;update org_members set role='owner' where user_id='${owner}' and organization_id='${org}';
    insert into purchases values('legacy-grn','${org}','receipt-supplier','GRN-OLD','2026-10-10T10:00:00Z',30);
    insert into supplier_payments values('legacy-pay','${org}','receipt-supplier','cash','2026-10-11T10:00:00Z',5);`);await role(owner);
  let statement=await scalar(`select get_purchase_supplier_statement('${org}','receipt-supplier') as result`,'result');
  assert(statement.entries.some(row=>row.identity==='grn:legacy-grn'&&Number(row.amount_minor)===3000));
  assert(statement.entries.some(row=>row.identity==='legacy-payment:legacy-pay'&&Number(row.amount_minor)===-500));
  assert(statement.entries.some(row=>row.identity===`invoice:${invoice}`&&Number(row.amount_minor)===5605));
  assert(statement.entries.some(row=>row.identity===`cash:${id}`&&Number(row.amount_minor)===-1000));
  assert(statement.entries.findIndex(row=>row.identity==='invoice:'+invoice) < statement.entries.findIndex(row=>row.identity==='cash:'+id));
  assert.equal(Number(statement.entries.at(-1).balance_minor),Math.round((before-10)*100));pass('statement combines legacy GRNs/payments and linked invoices/cash with a reconciled opening');
  await rejects(`select get_purchase_supplier_statement('${org}','receipt-supplier',-1)`,'invalid statement page is rejected');
  await db.exec(`reset role;insert into purchases select 'page-'||n,'${org}','receipt-supplier','GRN-PAGE-'||n,'2026-10-01T00:00:00Z'::timestamptz,0.01 from generate_series(1,55) n`);await role(owner);
  const page1=await scalar(`select get_purchase_supplier_statement('${org}','receipt-supplier',1) as result`,'result');
  statement=await scalar(`select get_purchase_supplier_statement('${org}','receipt-supplier',0) as result`,'result');
  assert.equal(statement.entries.length,50);assert.equal(new Set([...statement.entries,...page1.entries].map(row=>row.identity)).size,Number(statement.count));
  assert.equal(Number(page1.entries.at(-1).balance_minor),Math.round((before-10)*100));pass('stable statement pagination retains running balance across pages');
  if(nativeUrl){
    async function race(sqls){const clients=await Promise.all(sqls.map(async()=>{const c=new Client({connectionString:nativeUrl});await c.connect();await c.query(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`);return c}));try{return await Promise.allSettled(sqls.map((sql,i)=>clients[i].query(sql)))}finally{await Promise.all(clients.map(c=>c.end()))}}
    const retry=pay({key:'d3030303-0303-4303-8303-030303030303',amount:5});
    let results=await race([retry,retry]);assert.equal(results.filter(row=>row.status==='fulfilled').length,2);pass('native concurrent identical settlement retries both succeed with one posting');
    results=await race(['d4040404-0404-4404-8404-040404040404','d5050505-0505-4505-8505-050505050505'].map(key=>pay({key,amount:30})));
    assert.equal(results.filter(row=>row.status==='fulfilled').length,1);pass('native competing payments cannot exceed invoice outstanding');
    summary=await scalar(`select get_purchase_invoice_settlement('${org}','${invoice}') as result`,'result');assert.equal(Number(summary.paid_minor),4500);
  }else{await db.exec(pay({key:'d4040404-0404-4404-8404-040404040404',amount:30}));}
  assert.equal(await scalar("select stock_qty from products_base where id='receipt-product'",'stock_qty'),stock);
  assert.equal(await scalar('select count(*) as n from stock_logs','n'),logs);pass('settlement never receives or moves stock');
  console.log(`Invoice cash settlements: ${count} checks passed.`);
}
