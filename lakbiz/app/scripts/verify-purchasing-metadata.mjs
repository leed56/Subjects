import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
export async function verifyPurchasingMetadata({db,org,owner,outsider,role}){
 let count=0;const pass=label=>{count++;console.log(`PASS purchasing metadata: ${label}`)};
 const scalar=async(sql,key)=>(await db.query(sql)).rows[0][key];
 async function rejects(sql,label){await assert.rejects(()=>db.exec(sql));await db.exec('rollback');pass(label)}
 await db.exec(`reset role;alter table products_base add column if not exists sector_id text not null default 'grocery';alter table suppliers add column if not exists name text not null default 'Supplier',add column if not exists phone text,add column if not exists address text,add column if not exists vat_number text,add column if not exists contact_person text;grant insert,delete on suppliers to authenticated;`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261017032519_purchasing_metadata_adapters.sql',import.meta.url),'utf8'));
 const measurementLine=await scalar('select id from purchase_order_lines limit 1','id');
 assert.equal(await scalar(`select length_unit from purchase_order_lines where id='${measurementLine}'`,'length_unit'),null);pass('existing purchase lines keep their unit unknown');
 await db.exec(`update purchase_order_lines set length_unit='yard' where id='${measurementLine}'`);
 assert.equal(await scalar(`select length_unit from purchase_order_lines where id='${measurementLine}'`,'length_unit'),'yard');pass('a measured purchase line can preserve yards');
 await rejects(`update purchase_order_lines set length_unit='feet' where id='${measurementLine}'`,'unsupported fabric units are rejected');
 await db.exec(`update purchase_order_lines set length_unit=null where id='${measurementLine}'`);
 await db.exec(`insert into products_base(id,organization_id,name,stock_qty,buy_price,sector_id) values('fabric-unit-test','${org}','Fabric',0,0,'textile')`);
 await role(owner);
 const measuredId='acacacac-acac-4cac-8cac-acacacacacac';const measured={supplierId:'receipt-supplier',lines:[{productId:'fabric-unit-test',qty:10,unitCost:2,lengthUnit:'yard'}]};
 const createMeasured=`select create_purchase_order_atomic('${org}','${measuredId}','${JSON.stringify(measured)}')`;
 await db.exec(createMeasured);await db.exec(createMeasured);
 assert.equal(await scalar(`select length_unit from purchase_order_lines where purchase_order_id='${measuredId}'`,'length_unit'),'yard');pass('atomic purchase creation and retry preserve the selected fabric unit');
 await rejects(`select create_purchase_order_atomic('${org}','adadadad-adad-4dad-8dad-adadadadadad','${JSON.stringify({...measured,lines:[{...measured.lines[0],lengthUnit:'feet'}]})}')`,'invalid purchase unit cannot create an order');
 await role(owner);
 const payload=[{id:'receipt-supplier',organization_id:org,name:'Updated supplier',payable_balance:999999}];
 const save=rows=>`select save_purchase_supplier_metadata('${org}','${JSON.stringify(rows)}')`;
 const before=Number(await scalar("select payable_balance from suppliers where id='receipt-supplier'",'payable_balance'));
 await db.exec(save(payload));assert.equal(Number(await scalar("select payable_balance from suppliers where id='receipt-supplier'",'payable_balance')),before);pass('metadata edits preserve authoritative payable despite stale device balance');
 await db.exec(save([{id:'new-supplier',organization_id:org,name:'New supplier',payable_balance:0}]));assert.equal(Number(await scalar("select payable_balance from suppliers where id='new-supplier'",'payable_balance')),0);pass('new supplier starts with zero payable');
 await rejects(save([{id:'forged-opening',organization_id:org,name:'Supplier',payable_balance:100}]),'metadata cannot invent opening liabilities');
 await rejects(save([...payload,{...payload[0]}]),'duplicate supplier identities are rejected');
 await rejects(save([{...payload[0],organization_id:'22222222-2222-4222-8222-222222222222'}]),'foreign company payload is rejected');
 await rejects("delete from suppliers where id='new-supplier'",'enabled supplier accounts cannot be pruned directly');
 await rejects(`insert into suppliers(id,organization_id,name,payable_balance) values('forged','${org}','Supplier',1)`,'direct opening payable insert is blocked');
 await role(outsider);await rejects(save(payload),'foreign owner cannot change supplier metadata');
 await rejects(`select get_purchase_invoice_workspace('${org}')`,'foreign owner cannot read invoice history');
 await role(owner,'anon');await rejects(save(payload),'anonymous metadata calls are revoked');await role(owner);
 let value=await scalar(`select get_purchase_invoice_workspace('${org}') as result`,'result');assert.equal(value.organizationId,org);assert.equal(value.receipts.length,0);assert(value.invoiceCount>0);pass('owner workspace separates paginated invoices from explicit order receipt selection');
 const order=await scalar(`select purchase_order_id from purchase_receipt_invoices where organization_id='${org}' limit 1`,'purchase_order_id');
 value=await scalar(`select get_purchase_invoice_workspace('${org}','${order}') as result`,'result');
 for(const receipt of value.receipts)assert.equal(Number(await scalar(`select count(*) as n from purchase_invoice_receipts where organization_id='${org}' and receipt_id='${receipt.receipt_id}'`,'n')),0);
 pass('receipt selection excludes all previously billed deliveries');
 await rejects(`select get_purchase_invoice_workspace('${org}',null,-1,0)`,'invalid history page is rejected');
 await db.exec(`reset role;insert into purchase_receipt_invoices(organization_id,id,purchase_order_id,supplier_id,supplier_invoice_no,invoice_date,subtotal_minor,input_vat_minor,total_minor,request,created_by)
 select '${org}',gen_random_uuid(),'${order}','receipt-supplier','PAGINATION-'||n,'2026-10-17',0,0,0,'{}','${owner}' from generate_series(1,205) n`);await role(owner);
 const first=await scalar(`select get_purchase_invoice_workspace('${org}') as result`,'result'),second=await scalar(`select get_purchase_invoice_workspace('${org}',null,1) as result`,'result');
 assert.equal(first.invoices.length,25);assert.equal(second.invoices.length,25);assert(first.invoiceCount>200);assert.equal(new Set([...first.invoices,...second.invoices].map(row=>row.id)).size,50);pass('history exceeds 200 invoices with stable non-overlapping server pages');
 console.log(`Purchasing metadata adapters: ${count} checks passed.`);
}
