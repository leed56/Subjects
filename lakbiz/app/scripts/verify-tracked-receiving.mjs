import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
export async function verifyTrackedReceiving({db,Client,nativeUrl,org,owner,outsider,role}){
 let count=0;const pass=label=>{count++;console.log(`PASS tracked receiving: ${label}`)};
 const scalar=async(sql,key)=>(await db.query(sql)).rows[0][key];
 async function rejects(sql,label){await assert.rejects(()=>db.exec(sql));await db.exec('rollback');pass(label)}
 await db.exec(`reset role;
 alter table products_base add column if not exists sector_id text not null default 'grocery';
 alter table product_inventory_profiles add column if not exists fefo_enabled boolean not null default false;
 alter table product_variants add column if not exists active boolean not null default true,add column if not exists label text not null default 'Variant';
 alter table inventory_lots alter column id set default gen_random_uuid();
 alter table inventory_lots add column if not exists manufactured_date date,add column if not exists received_date date not null default current_date,add column if not exists supplier_id text,add column if not exists qty_received numeric(14,3) not null default 0;
 update inventory_lots set qty_received=qty_on_hand;
 create unique index if not exists tracked_fixture_batch_uq on inventory_lots(organization_id,product_id,coalesce(variant_id::text,''),batch_no);
 alter table inventory_units alter column id set default gen_random_uuid();
 create table inventory_lot_costs(lot_id uuid primary key references inventory_lots(id),organization_id uuid,unit_cost numeric(14,2));
 create table inventory_unit_costs(unit_id uuid primary key references inventory_units(id),organization_id uuid,unit_cost numeric(14,2));grant select on product_variants,inventory_lots to authenticated;`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20260822000005_identity_registration_guard.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261017033040_purchase_tracked_receiving.sql',import.meta.url),'utf8'));
 const modes=['variant','lot','serial','variant_lot','variant_serial'];const orders=new Map();const variants=new Map();
 await db.exec(`insert into products_base(id,organization_id,name,stock_qty,buy_price) select 'tracked-'||m,'${org}',m,0,0 from unnest(array['variant','lot','serial','variant_lot','variant_serial'])m;
 insert into product_inventory_profiles(product_id,organization_id,tracking_mode) select 'tracked-'||m,'${org}',m from unnest(array['variant','lot','serial','variant_lot','variant_serial'])m;
 insert into product_variants(id,organization_id,product_id,label) select gen_random_uuid(),'${org}','tracked-'||m,'Blue' from unnest(array['variant','variant_lot','variant_serial'])m;`);
 await role(owner);
 for(const mode of modes){const id=await scalar(`select gen_random_uuid() as id`,'id');await db.exec(`select create_purchase_order_atomic('${org}','${id}','${JSON.stringify({supplierId:'receipt-supplier',lines:[{productId:'tracked-'+mode,qty:10,unitCost:7.5}]})}')`);const line=await scalar(`select id from purchase_order_lines where purchase_order_id='${id}'`,'id');orders.set(mode,{id,line});if(mode.startsWith('variant'))variants.set(mode,await scalar(`select id from product_variants where product_id='tracked-${mode}'`,'id'))}
 const receive=(mode,allocations,qty=2,expected=0,key='e1010101-0101-4101-8101-010101010101')=>`select receive_purchase_order_atomic('${org}','${orders.get(mode).id}','${key}','${JSON.stringify([{line_id:orders.get(mode).line,qty,expected_received:expected,...(allocations===undefined?{}:{allocations})}])}') as result`;
 await rejects(receive('serial',undefined),'tracked stock without physical identities is rejected');
 await rejects(receive('variant',[{qty:2}]),'variant receipt requires exact variant');
 await rejects(receive('lot',[{qty:1,batch_no:'short'}]),'identity quantities must match the received line');
 assert.equal(Number(await scalar("select stock_qty from products_base where id='tracked-lot'",'stock_qty')),0);pass('late identity failure rolls back product stock and custody');
 for(const mode of modes){const variant_id=variants.get(mode),allocations=mode.includes('serial')?[{qty:1,serial_no:mode+'-001',variant_id},{qty:1,imei:mode==='serial'?'356938035643809':'356938035643817',variant_id}]:[{qty:2,variant_id,...(mode.includes('lot')?{batch_no:'BATCH-'+mode,expiry_date:'2036-12-31'}:{})}];
  const key=await scalar('select gen_random_uuid() as id','id');const first=await scalar(receive(mode,allocations,2,0,key),'result');
  assert.equal(Number(await scalar(`select stock_qty from products_base where id='tracked-${mode}'`,'stock_qty')),2);
  assert.equal(Number(await scalar(`select sum(qty) as qty from purchase_receipt_identities where receipt_id='${key}'`,'qty')),2);
  assert.deepEqual(await scalar(receive(mode,allocations,2,0,key),'result'),first);
  if(mode.includes('serial'))assert.equal(Number(await scalar(`select count(*) as n from inventory_units where product_id='tracked-${mode}' and location_id is not null and custody_status='available'`,'n')),2);
  else assert.equal(Number(await scalar(`select sum(qty_on_hand) as qty from inventory_location_balances where product_id='tracked-${mode}'`,'qty')),2);
  pass(`${mode}: exact stock/custody/provenance commit together and retry once`);
 }
 await rejects(receive('serial',[{qty:1,serial_no:'serial-001'}],1,2),'already registered serial cannot be received twice');
 await rejects(receive('serial',[{qty:1,imei:'bad-imei'}],1,2),'invalid IMEI is rejected');
 await rejects(receive('variant',[{qty:1,variant_id:variants.get('variant_serial')}],1,2),'another product variant cannot be used');
 await rejects(receive('lot',[{qty:1,batch_no:'Expired',expiry_date:'2000-01-01'}],1,2),'expired incoming batch is rejected');
 const lot=await scalar("select id from inventory_lots where product_id='tracked-lot'",'id');
 await db.exec(receive('lot',[{qty:1,lot_id:lot}],1,2,'e2020202-0202-4202-8202-020202020202'));
 assert.equal(Number(await scalar(`select qty_on_hand from inventory_lots where id='${lot}'`,'qty_on_hand')),3);pass('additional partial delivery replenishes the same exact batch');
 const catalogue=await scalar(`select get_purchase_receiving_catalogue('${org}','${orders.get('variant').id}','${orders.get('variant').line}') as result`,'result');assert.equal(catalogue.variants[0].id,variants.get('variant'));pass('receiving catalogue returns only matching company/product identities');
 await role(outsider);await rejects(`select get_purchase_receiving_catalogue('${org}','${orders.get('variant').id}')`,'foreign owner cannot inspect receiving catalogue');await role(owner);
 await rejects('delete from purchase_receipt_identities','receipt provenance cannot be pruned by clients');
 await db.exec(`reset role;insert into inventory_units(organization_id,product_id,serial_no,secondary_imei,status) values('${org}','tracked-serial','SECONDARY-IMEI','356938035643825','sold')`);await role(owner);
 await rejects(receive('serial',[{qty:1,imei:'356938035643825'}],1,2),'IMEI already used as a secondary identifier cannot be received again');
 await db.exec(`reset role;update products_base set sector_id='textile' where id='tracked-variant'`);await role(owner);
 await rejects(receive('variant',[{qty:1,variant_id:variants.get('variant')}],1,2),'wholesale textile receipts preserve the specialist Fabric Rolls workflow');
 if(nativeUrl){const mode='variant_serial';const a=[{qty:1,variant_id:variants.get(mode),serial_no:'CONCURRENT-SERIAL'}];const call=receive(mode,a,1,2,'e3030303-0303-4303-8303-030303030303');
  const clients=await Promise.all([0,1].map(async()=>{const c=new Client({connectionString:nativeUrl});await c.connect();await c.query(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`);return c}));try{const results=await Promise.allSettled(clients.map(c=>c.query(call)));assert.equal(results.filter(r=>r.status==='fulfilled').length,2)}finally{await Promise.all(clients.map(c=>c.end()))}
  assert.equal(Number(await scalar("select count(*) as n from inventory_units where serial_no='CONCURRENT-SERIAL'",'n')),1);pass('native simultaneous tracked receipt retries create one physical unit');
 }
 console.log(`Tracked receiving: ${count} checks passed.`);
}
