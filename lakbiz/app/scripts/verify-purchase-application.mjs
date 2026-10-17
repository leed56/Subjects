import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function verifyPurchaseApplication({db,Client,nativeUrl,org,owner,outsider,role}) {
  let checks=0;const pass=label=>{checks++;console.log(`PASS purchase application: ${label}`);};
  const scalar=async(sql,key)=>(await db.query(sql)).rows[0][key];
  async function rejects(sql,label){await assert.rejects(()=>db.exec(sql));await db.exec('rollback');pass(label);}
  await db.exec(`reset role;alter table suppliers add column name text not null default 'Verified supplier';
    create table if not exists ac_jobs_base(id text primary key,organization_id uuid);
    grant insert,update,delete on stock_logs to authenticated;`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261016162304_purchase_order_application_authority.sql',import.meta.url),'utf8'));
  const id='91919191-9191-4919-8919-919191919191';
  const input={supplierId:'receipt-supplier',lines:[{productId:'receipt-product',qty:5,unitCost:12}]};
  const create=(orderId=id,body=input,tenant=org)=>`select create_purchase_order_atomic('${tenant}','${orderId}','${JSON.stringify(body)}') as id`;
  const snapshot=(orderId=id)=>`select get_purchase_order_authority_snapshot('${org}','${orderId}') as result`;
  await role(outsider);
  await rejects(create(),'foreign owner cannot create an order in this company');
  await role(owner,'anon');await rejects(create(),'anonymous order creation is denied');
  await role(owner);
  const before=Number(await scalar("select stock_qty from products_base where id='receipt-product'",'stock_qty'));
  await db.exec(create());
  const first=await scalar(snapshot(),'result');
  assert.equal(first.order.supplier_name,'Verified supplier');assert.equal(first.lines[0].product_name,'Receipt stock');
  assert.equal(first.order.expected_total,60);assert.equal(first.lines[0].qty_received,0);
  assert.equal(Number(await scalar("select stock_qty from products_base where id='receipt-product'",'stock_qty')),before);
  pass('atomic creation uses server names and creates no available stock');
  await db.exec(create());const replay=await scalar(snapshot(),'result');
  assert.equal(replay.lines[0].id,first.lines[0].id);
  assert.equal(Number(await scalar(`select count(*) as n from purchase_order_lines where purchase_order_id='${id}'`,'n')),1);
  pass('creation retry preserves the same order and stable line IDs');
  await rejects(create(id,{...input,lines:[{...input.lines[0],qty:6}]}),'creation key cannot be reused for changed quantities');
  await rejects(create('92929292-9292-4929-8929-929292929292',{...input,lines:[input.lines[0],input.lines[0]]}),'duplicate product creation rolls back');
  await rejects(create('93939393-9393-4939-8939-939393939393',{...input,lines:[input.lines[0],{productId:'other-product',qty:1,unitCost:1}]}),'foreign second product rolls back earlier order lines');
  assert.equal(Number(await scalar("select count(*) as n from purchase_orders where id='93939393-9393-4939-8939-939393939393'",'n')),0);
  pass('failed creation leaves neither header nor partial order lines');
  await rejects(create('94949494-9494-4949-8949-949494949494',{...input,supplierId:'foreign-supplier'}),'foreign supplier is rejected');
  const line=first.lines[0].id;
  const receipt=`select receive_purchase_order_atomic('${org}','${id}','95959595-9595-4959-8959-959595959595','${JSON.stringify([{line_id:line,qty:2,expected_received:0}])}')`;
  await db.exec(receipt);
  const received=await scalar(snapshot(),'result');
  assert.equal(received.order.status,'partial');assert.equal(received.lines[0].qty_received,2);
  assert.equal(received.products[0].stock_qty,before+2);assert.equal(received.products[0].buy_price,12);
  assert.equal(received.logs.length,1);assert.equal(received.logs[0].user_id,owner);
  pass('snapshot returns committed order, product quantities, costs and receipt audit');
  await rejects(`select cancel_purchase_order_atomic('${org}','${id}')`,'partly received order cannot be cancelled');
  await rejects(`update stock_logs set qty=99 where id='${received.logs[0].id}'`,'snapshot cannot overwrite receipt movement audit');
  await rejects(`delete from stock_logs where id='${received.logs[0].id}'`,'snapshot cannot prune receipt movement audit');
  await rejects(`insert into stock_logs(id,organization_id,product_id,product_name,log_type,qty) values('po-receipt:forged','${org}','receipt-product','Forged','purchase',1)`,'client cannot forge a server receipt audit ID');
  const cancelled='96969696-9696-4969-8969-969696969696';
  await db.exec(create(cancelled));await db.exec(`select cancel_purchase_order_atomic('${org}','${cancelled}');select cancel_purchase_order_atomic('${org}','${cancelled}')`);
  assert.equal((await scalar(snapshot(cancelled),'result')).order.status,'cancelled');
  pass('unreceived order cancellation is terminal and retry safe');
  await role(outsider);await rejects(snapshot(),'foreign owner cannot read another company snapshot');
  await role(owner);
  if(nativeUrl){
    const racing='97979797-9797-4979-8979-979797979797';
    async function race(sqls){
      const clients=await Promise.all(sqls.map(async()=>{const client=new Client({connectionString:nativeUrl});await client.connect();await client.query(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`);return client;}));
      try{return await Promise.allSettled(sqls.map((sql,i)=>clients[i].query(sql)));}finally{await Promise.all(clients.map(client=>client.end()));}
    }
    let results=await race([create(racing),create(racing)]);
    assert.equal(results.filter(row=>row.status==='fulfilled').length,2);
    assert.equal(Number(await scalar(`select count(*) as n from purchase_order_lines where purchase_order_id='${racing}'`,'n')),1);
    pass('native Postgres: simultaneous creation retries preserve a single order');
    const raceLine=(await scalar(snapshot(racing),'result')).lines[0].id;
    results=await race([`select cancel_purchase_order_atomic('${org}','${racing}')`,
      `select receive_purchase_order_atomic('${org}','${racing}','98989898-9898-4989-8989-989898989898','${JSON.stringify([{line_id:raceLine,qty:1,expected_received:0}])}')`]);
    assert.equal(results.filter(row=>row.status==='fulfilled').length,1);
    const final=await scalar(snapshot(racing),'result');
    assert.equal(final.lines[0].qty_received,final.order.status==='cancelled'?0:1);
    pass('native Postgres: cancellation and receiving cannot both succeed');
  }
  console.log(`Purchase application authority: ${checks} checks passed.`);
}
