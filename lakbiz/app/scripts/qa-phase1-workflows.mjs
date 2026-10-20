import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url);
const {build,stop}=require(process.env.TEXTILE_QA_ESBUILD ?? 'esbuild');
const {chromium}=require(process.env.LAKBIZ_QA_PLAYWRIGHT ?? 'playwright');
const root=path.resolve(import.meta.dirname,'..');
const out=process.env.LAKBIZ_UI_QA_DIR ?? path.join(os.tmpdir(),'lakbiz-phase1-workflows');
fs.mkdirSync(out,{recursive:true});
const routes=['dashboard','customers','workforce','vehicles','teams','assets','expenses','schedule','stock/advanced','stock/advanced/queue','stock/advanced/returns','banking/pos-routing','pulse','stock/imports','stock/imports/shipments','stock/transfers','suppliers','suppliers/invoices']
 .filter(route=>!process.env.LAKBIZ_QA_ROUTES||process.env.LAKBIZ_QA_ROUTES.split(',').includes(route));
const f='const f=window.fixture;';
const mutate=`async function mutate(...args){f.calls.push(args);await new Promise(r=>setTimeout(r,80));if(f.rejectMutation)throw Error('Synthetic rejected request');return {ok:false,data:null,error:'Synthetic save failure'}}`;
const stubs={
 '@/lib/supabase/purchase-shipments':`${f}export function shipmentPendingAction(){return null}export async function listShipments(){return {items:[{id:'shipment',reference:'SHIP-001',status:'landed'}],hasMore:false}}export async function loadShipment(){return {organization_id:'fixture-org',shipment:{id:'shipment',organization_id:'fixture-org',purchase_order_id:'po',status:'landed',version:1},lines:[{line_id:'line',product_id:'p',product_name:'Fixture fabric',qty:10,received_qty:0}],receipts:[]}}export async function saveShipmentCommand(){throw Error('Synthetic save failure')}`,
 '@/lib/supabase/purchase-receiving':`export async function loadReceivingCatalogue(){return {enabled:true,lines:[{id:'line',qty_ordered:10,qty_received:0}]}}`,
 '@/lib/supabase/invoice-settlements':`${f}${mutate}export function cashSettlementPending(){return f.pendingCash===true}export async function loadInvoiceSettlement(){return {organization_id:'fixture-org',invoice_id:'invoice',number:'INV-001',invoice_date:'2026-10-16',total_minor:1000,paid_minor:0,payable_balance:10,payments:[],userId:'owner'}}export const saveInvoiceCashSettlement=mutate;export async function loadSupplierStatement(org,supplier,page){if(f.failStatement)throw Error('Statement load failed');return {organization_id:org,supplier_id:supplier,payable_balance:10,opening_minor:0,count:51,page,entries:[{identity:'invoice:invoice',date:'2026-10-17',label:'Invoice INV-001',amount_minor:1000,balance_minor:1000}]}}`,
 '@/lib/supabase/receipt-invoices':`${f}${mutate}export function invoicePending(){return f.pendingInvoice===true}export async function loadInvoiceWorkspace(){if(f.failLoads)throw Error('Synthetic invoice load failure');return {organizationId:'fixture-org',userId:'owner',enabled:true,receipts:[{organization_id:'fixture-org',receipt_id:'receipt',purchase_order_id:'po',received_at:'2026-10-16T10:00:00Z',request_lines:[{line_id:'line',qty:2}]}],invoices:[{id:"invoice",supplier_id:"s",supplier_invoice_no:"INV-001",invoice_date:"2026-10-16",total_minor:1000,input_vat_minor:0}],billed:[]}}export const saveReceiptInvoice=mutate;`,
 '@/lib/supabase/inventory-location-client':`${f}${mutate}export async function loadInventoryLocations(){if(f.failLoads)throw Error('Synthetic load failure');return {organizationId:'fixture-org',locations:[{id:'main',name:'Main stockroom',code:'MAIN',is_default:true,active:true},{id:'branch',name:'Branch',code:'BRANCH',active:true}],balances:[{id:'balance',location_id:'main',product_id:'p',qty_on_hand:10,qty_reserved:0,variant_id:null,lot_id:null}],units:[],transfers:[],reservations:[],enabled:true}}export async function inventoryOperation(...args){await mutate(...args)}export async function createStockLocation(...args){await mutate(...args)}export async function inspectInventoryProduct(){return []}`,
 'next/link':'import React from "react";export default function Link({children,...p}){return <a {...p}>{children}</a>}',
 'next/navigation':'export function useSearchParams(){return new URLSearchParams()}export function useRouter(){return {push(){},replace(){}}}export function usePathname(){return location.pathname}',
 '@/components/shell/app-shell':'export function AppShell({children}){return <div className="min-w-0">{children}</div>}',
 '@/components/auth-provider':'const user={id:"owner",email:"owner@example.com"};export function useAuth(){return {user,logout:async()=>{}}}',
 '@/lib/i18n/locale-provider':`import {translate} from ${JSON.stringify(root+'/src/lib/i18n/translations.ts')};${f}const t=k=>translate(f.locale,k);export function useLocale(){return {locale:f.locale,t}}`,
 '@/lib/subscription/use-can-write':`${f}export function useWriteAccess(){return {canWrite:!f.readOnly,disabledHint:f.readOnly?'Read only':null}}`,
 '@/components/write-disabled-hint':`${f}export function WriteDisabledHint(){return f.readOnly?<p>Read only</p>:null}`,
 '@/lib/subscription/subscription-provider':`${f}const org={id:'fixture-org',isAuthenticated:true,sector:'ac',name:'Fixture shop'};export function useSubscription(){return {org,orgRole:f.readOnly?'cashier':'owner',canSeeFinancials:!f.readOnly,can:()=>!f.readOnly,subscription:{planId:'pro'}}}`,
 '@/lib/store/use-app-store':`${f}${mutate}export function useAppStore(){return new Proxy({data:f.data,ready:true,pendingPurchaseAction:f.pendingPurchase===true,cloudSyncing:false,cloudSyncError:null,offlinePendingSync:false,offlinePendingChangeCount:0},{get:(target,key)=>key in target?target[key]:mutate})}`,
 '@/components/ui/toast':`${f}export function useToast(){return {toast:x=>f.toasts.push(x)}}`,
 '@/components/messaging/message-send-button':'export function MessageSendButton(){return null}',
 '@/lib/messaging/use-sms-api-configured':'export function useWhatsAppApiConfigured(){return false}export function useSmsApiConfigured(){return false}',
 '@/lib/messaging/use-notification-logs':'export function useNotificationLogs(){return []}',
};
const imports=routes.map((route,i)=>`import Page${i} from ${JSON.stringify(root+'/src/app/'+route+'/page.tsx')};`).join('\n');
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {emptyAppData} from ${JSON.stringify(root+'/src/lib/store/storage.ts')};${imports}
window.fixture.data={...emptyAppData(),...window.fixture.data};const pages=[${routes.map((_,i)=>'Page'+i).join(',')}];createRoot(document.getElementById('app')).render(React.createElement(pages[window.fixture.route]));`;
const bundle=await build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated',setup(b){
 b.onResolve({filter:/.*/},a=>{
  if(Object.hasOwn(stubs,a.path))return {path:a.path,namespace:'fixture'};
  if(a.path.startsWith('@/lib/supabase/')&&!a.path.endsWith('sync-watermark')){
   const file=root+'/src/'+a.path.slice(2)+'.ts';
   if(fs.existsSync(file)){const source=fs.readFileSync(file,'utf8');const names=[...source.matchAll(/export (?:async )?function (\w+)/g)].map(m=>m[1]);stubs[a.path]=`${f}${mutate}`+names.map(name=>name.startsWith('fetch')?`export async function ${name}(){if(f.failLoads)throw Error('Synthetic load failure');return {data:[],error:null,bankAccountId:null}}`:`export const ${name}=${/schemaUnavailable|isSupabaseConfigured/i.test(name)?'()=>false':'mutate'};`).join('\n');return {path:a.path,namespace:'fixture'};}
  }
  if(a.path.startsWith('@/')){const p=root+'/src/'+a.path.slice(2);return {path:[p,p+'.tsx',p+'.ts'].find(x=>fs.existsSync(x)&&fs.statSync(x).isFile())};}
 });b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));
}}]});
const layout=fs.readFileSync(root+'/.next/server/app/login.html','utf8');
const css=[...layout.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>fs.readFileSync(path.join(root,'.next',m[1].replace(/^\/_next\//,'')),'utf8')).join('\n');
let fixture;
const server=createServer((req,res)=>{if(req.url.startsWith('/images/')){res.end(fs.readFileSync(root+'/public'+req.url));return}res.setHeader('Content-Type','text/html');res.end(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="app"></div><script>window.fixture=${JSON.stringify(fixture)}</script><script>${bundle.outputFiles[0].text.replace(/<\/script/g,'<\\/script')}</script></html>`)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.LAKBIZ_CHROMIUM_PATH,headless:true});
const results=[];
function assert(value,message){if(!value)throw Error(message)}
try{
 for(const width of [390,768,1440])for(const route of routes){
  const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const customerData=route==='customers'?{customers:Array.from({length:19},(_,i)=>({id:`customer-${i}`,name:`Customer ${i+1}`,contactType:'individual',phone:`077000${String(i).padStart(4,'0')}`,address:'Colombo',creditBalance:0,creditLimit:10000}))}:{};
  const purchasingData=route.startsWith('suppliers')||route==='stock/imports/shipments'?{suppliers:[{id:'s',name:'Fixture supplier',payableBalance:0}],products:[{id:'p',name:'Fixture product',category:'General',sectorId:route==='stock/imports/shipments'?'textile':'ac',condition:'new',customFields:{},stockQty:10,buyPrice:5,sellPrice:10,active:true}],purchaseOrders:[{id:'po',poNo:'PO-001',supplierId:'s',supplierName:'Fixture supplier',date:'2026-10-16',expectedTotal:50,status:'pending',lines:[{id:'line',productId:'p',productName:'Fixture product',qtyOrdered:10,qtyReceived:0,unitCost:5,lengthUnit:'metre'}]}]}:{};
  fixture={route:routes.indexOf(route),locale:'en',data:{...customerData,...purchasingData},calls:[],toasts:[],rejectMutation:true};
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForTimeout(250);
  assert(!errors.length,`${route}: ${errors.join(';')}`);
  assert(await page.locator('main').count()>0,`${route}: no main`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,`${route} ${width}: page overflow`);
  await page.screenshot({path:path.join(out,route.replaceAll('/','-')+'-'+width+'.png'),fullPage:true});
  if(route==='stock/imports/shipments'){
   await page.getByRole('button',{name:/SHIP-001/}).click();
   await page.getByLabel('Shipment line').selectOption('line');
   await page.getByRole('button',{name:'Add roll'}).click();
   await page.getByLabel('Roll number').fill('QA-ROLL-01');
   await page.getByLabel('Length (metre)').fill('4.5');
   await page.getByRole('button',{name:'Confirm fabric receipt'}).click();
   await page.getByRole('alert').waitFor();
   assert(await page.getByLabel('Roll number').inputValue()==='QA-ROLL-01','Fabric roll draft lost after failed receipt');
   assert(await page.getByLabel('Length (metre)').inputValue()==='4.5','Fabric length draft lost after failed receipt');
   assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),`Fabric receipt ${width}: page overflow`);
  }
  if(['assets','teams','expenses'].includes(route)){
   const add=page.getByRole('button',{name:route==='assets'?'Add asset':route==='teams'?'Add crew':'Add expense',exact:true}).first();await add.click();
   const dialog=page.getByRole('dialog');await dialog.waitFor();
   if(route==='teams')await dialog.locator('input').first().fill('Preserved QA draft');
   if(route==='expenses')await dialog.locator('input[inputmode="decimal"]').fill('125');
   const save=dialog.getByRole('button',{name:route==='assets'?'Add asset':route==='teams'?'Add crew':'Add expense',exact:true});await save.click();
   await dialog.getByRole('alert').waitFor();assert(await save.isEnabled(),`${route}: saving lock stuck`);
   if(route==='teams')assert(await dialog.locator('input').first().inputValue()==='Preserved QA draft','Crew draft lost');
   assert(await page.evaluate(()=>window.fixture.calls.length)===1,`${route}: unexpected mutation calls`);
  }
  if(route==='stock/transfers'){
   await page.getByRole('combobox',{name:/^Source stock/}).selectOption('b:balance');
   await page.getByRole('combobox',{name:/^Destination/}).selectOption('branch');
   await page.getByLabel('Quantity',{exact:true}).fill('2');
   await page.getByLabel('Reason / notes',{exact:true}).fill('Keep this transfer draft');
   await page.getByRole('button',{name:'Create transfer draft',exact:true}).click();
   await page.getByRole('alert').waitFor();
   assert(await page.getByLabel('Quantity',{exact:true}).inputValue()==='2','Transfer quantity draft lost');
   assert(await page.getByLabel('Reason / notes',{exact:true}).inputValue()==='Keep this transfer draft','Transfer reason draft lost');
   assert(await page.getByRole('button',{name:'Create transfer draft',exact:true}).isEnabled(),'Transfer lock stuck');
   await page.evaluate(()=>{window.fixture.failLoads=true});
   await page.getByRole('button',{name:'Refresh',exact:true}).click();
   await page.getByText('Synthetic load failure',{exact:true}).waitFor();
   assert(await page.getByRole('button',{name:'Create transfer draft',exact:true}).count()===0,'Failed load leaves stale stock actions available');
   await page.evaluate(()=>{window.fixture.failLoads=false});
   await page.getByRole('button',{name:'Retry loading',exact:true}).click();
   await page.getByRole('combobox',{name:/^Source stock/}).waitFor();
   assert(await page.getByLabel('Quantity',{exact:true}).inputValue()==='2','Retry discarded the operator draft');
   fixture={...fixture,readOnly:true};await page.reload();
   await page.getByText('Stock operator access required',{exact:true}).waitFor();
  }
  if(route==='suppliers'){
   await page.getByRole('button',{name:'Ledger',exact:true}).filter({visible:true}).first().click();
   const statement=page.getByRole('dialog',{name:'Supplier statement'});await statement.getByRole('cell',{name:/Invoice INV-001/}).waitFor();
   await statement.getByRole('button',{name:'Next',exact:true}).click();await statement.getByText('Page 2 · 51 entries',{exact:true}).waitFor();
   await page.keyboard.press('Escape');assert(await statement.count()===0,'Statement Escape close failed');
   await page.evaluate(()=>{window.fixture.failStatement=true});
   await page.getByRole('button',{name:'Ledger',exact:true}).filter({visible:true}).first().click();
   await statement.getByRole('alert').waitFor();assert(await statement.getByRole('table').count()===0,'Failed statement falls back to incomplete legacy rows');
   await page.evaluate(()=>{window.fixture.failStatement=false});await statement.getByRole('button',{name:'Retry statement',exact:true}).click();await statement.getByRole('cell',{name:/Invoice INV-001/}).waitFor();
   await statement.getByRole('button',{name:'Close supplier statement',exact:true}).click();
   await page.getByRole('tab',{name:/Purchase orders/}).click();
   await page.getByRole('button',{name:'Receive',exact:true}).filter({visible:true}).first().click();
   const quantity=page.getByRole('spinbutton',{name:'Receive Fixture product',exact:true});await quantity.fill('3');
   const save=page.getByRole('button',{name:'Save',exact:true}).last();await save.click();
   await page.getByRole('alert').waitFor();
   assert(await quantity.inputValue()==='3','Receipt draft lost after rejected request');
   assert(await save.isEnabled(),'Receipt saving lock stuck');
   await page.screenshot({path:path.join(out,`suppliers-receipt-error-${width}.png`),fullPage:true});
   assert(await page.evaluate(()=>window.fixture.calls.length)===1,'Receipt submitted more than once');
   await page.getByRole('button',{name:'Close receiving',exact:true}).click();
   await page.getByRole('button',{name:'+ New purchase order',exact:true}).click();
   const ordered=page.getByRole('spinbutton',{name:'Order quantity Fixture product',exact:true});await ordered.fill('4');
   await page.getByRole('spinbutton',{name:'Order unit cost Fixture product',exact:true}).fill('7');
   await page.getByRole('button',{name:'Save',exact:true}).first().click();
   await page.getByRole('alert').waitFor();
   assert(await ordered.inputValue()==='4','Order draft lost after rejected request');
   assert(await page.getByRole('button',{name:'Save',exact:true}).first().isEnabled(),'Order saving lock stuck');
   assert(await page.evaluate(()=>window.fixture.calls.length)===2,'Order submitted more than once');
   fixture={...fixture,pendingPurchase:true,calls:[]};await page.reload();
   const recover=page.getByRole('button',{name:'Check pending purchase action',exact:true});await recover.click();
   await page.getByRole('alert').waitFor();assert(await recover.isEnabled(),'Pending recovery lock stuck');
   assert(await page.evaluate(()=>window.fixture.calls.length)===1,'Recovery submitted multiple actions');
  }
  if(route==='suppliers/invoices'){
   await page.getByRole('combobox',{name:/^Purchase order/}).selectOption('po');
   await page.getByRole('checkbox').check();
   await page.getByLabel('Supplier invoice number',{exact:true}).fill('Keep invoice 001');
   await page.getByLabel('Invoice date',{exact:true}).fill('2026-10-16');
   await page.getByRole('button',{name:'Record supplier invoice',exact:true}).click();
   await page.getByRole('alert').waitFor();
   assert(await page.getByLabel('Supplier invoice number',{exact:true}).inputValue()==='Keep invoice 001','Invoice draft lost');
   assert(await page.getByRole('button',{name:'Record supplier invoice',exact:true}).isEnabled(),'Invoice saving lock stuck');
   assert(await page.getByRole('checkbox').isChecked(),'Invoice receipt selection lost');
   await page.screenshot({path:path.join(out,`suppliers-invoices-rejected-${width}.png`),fullPage:true});
   fixture={...fixture,pendingInvoice:true,calls:[]};await page.reload();
   const check=page.getByRole('button',{name:'Check pending invoice',exact:true});await check.click();await page.getByRole('alert').waitFor();
   assert(await check.isEnabled(),'Invoice recovery lock stuck');
   fixture={...fixture,pendingInvoice:false,pendingCash:false,calls:[]};await page.reload();
   await page.getByRole('button',{name:'Review / pay cash',exact:true}).click();
   const cash=page.getByRole('region',{name:'Invoice cash settlement'});
   await cash.getByLabel('Cash amount (LKR)',{exact:true}).fill('3');await cash.getByLabel('Payment date',{exact:true}).fill('2026-10-17');
   await cash.getByLabel('Receipt reference / note',{exact:true}).fill('Keep this cash receipt');await cash.getByRole('button',{name:'Record cash payment',exact:true}).click();
   await cash.getByRole('alert').waitFor();assert(await cash.getByLabel('Cash amount (LKR)',{exact:true}).inputValue()==='3','Cash amount draft lost');
   assert(await cash.getByLabel('Receipt reference / note',{exact:true}).inputValue()==='Keep this cash receipt','Cash reference lost');
   assert(await cash.getByRole('button',{name:'Record cash payment',exact:true}).isEnabled(),'Cash saving lock stuck');
   await page.screenshot({path:path.join(out,`invoice-cash-rejected-${width}.png`),fullPage:true});
   fixture={...fixture,pendingCash:true,calls:[]};await page.reload();await page.getByRole('button',{name:'Review / pay cash',exact:true}).click();
   const cashCheck=cash.getByRole('button',{name:'Check pending cash payment',exact:true});await cashCheck.click();await cash.getByRole('alert').waitFor();assert(await cashCheck.isEnabled(),'Cash recovery lock stuck');
   fixture={...fixture,pendingInvoice:false,pendingCash:false,readOnly:true};await page.reload();
   await page.getByText('Owner access is required to review supplier costs and invoices.',{exact:true}).waitFor();
   assert(await page.getByRole('checkbox').count()===0,'Non-owner sees receipt details');
  }
  results.push({route,width,passed:true});await page.close();
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(`${results.length} production route fixtures passed; isolated adapters, no live writes.`);
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await browser.close();stop();}
