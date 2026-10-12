/** Browser fixtures of the actual stock page with isolated store/auth adapters.
 * Run after a production build. No database, financial write or live login occurs.
 * Requires the same Playwright/esbuild tooling as qa-textile-pos.mjs.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url);
const {build}=require(process.env.TEXTILE_QA_ESBUILD ?? 'esbuild');
const {chromium}=require(process.env.LAKBIZ_QA_PLAYWRIGHT ?? 'playwright');
const root=path.resolve(import.meta.dirname, '..');
const out=process.env.LAKBIZ_UI_QA_DIR ?? path.join(os.tmpdir(), 'lakbiz-stock-states');
fs.mkdirSync(out,{recursive:true});
const f='const f=window.fixture;';
const reactive=`import {useSyncExternalStore} from 'react';function subscribe(cb){window.addEventListener('fixturechange',cb);window.addEventListener('popstate',cb);return ()=>{window.removeEventListener('fixturechange',cb);window.removeEventListener('popstate',cb)}}function useFixture(){useSyncExternalStore(subscribe,()=>location.search+'|'+(window.fixtureVersion||0));return window.fixture}`;
const stubs={
 'next/navigation':`${reactive} export function useSearchParams(){useFixture();return new URLSearchParams(location.search)}`,
 'next/link':'import React from "react"; export default function Link({children,...p}){return <a {...p}>{children}</a>}',
 '@/components/shell/app-shell':'export function AppShell({children}){return <div className="min-w-0">{children}</div>}',
 '@/components/product-form':'export function ProductForm(){return <div>Product form fixture</div>}',
 '@/components/write-disabled-hint':`${f} export function WriteDisabledHint(){return f.readOnly?<p>Read only</p>:null}`,
 '@/lib/subscription/use-can-write':`${f} export function useWriteAccess(){return {canWrite:!f.readOnly,disabledHint:f.readOnly?'Read only':null}}`,
 '@/lib/subscription/subscription-provider':`${reactive} export function useSubscription(){const f=useFixture();return {org:{id:f.orgId||'shop-a',role:f.readOnly?'cashier':'owner',sector:'grocery',name:'QA shop',isAuthenticated:true},subscription:{planId:'starter'},canSeeFinancials:!f.readOnly,can:()=>false}}`,
 '@/lib/store/use-app-store':`${f} const mutate=async()=>{f.mutationCalls=(f.mutationCalls||0)+1;if(f.rejectMutation)throw new Error('Synthetic rejected mutation');return {ok:true}};export function useAppStore(){return {data:f.data,ready:f.ready,cloudSyncing:f.syncing,cloudSyncError:f.error,saveProductToCloud:mutate,deleteProductToCloud:mutate,stockInToCloud:mutate,stockOutToCloud:mutate,writeOffStockToCloud:mutate,returnStockToSupplierToCloud:mutate}}`,
 '@/lib/i18n/locale-provider':`import {translate} from ${JSON.stringify(root+'/src/lib/i18n/translations.ts')};${f}export function useLocale(){return {locale:f.locale,t:k=>translate(f.locale,k)}}`,
 '@/components/ui/toast':`${f} export function useToast(){return {toast:value=>{f.toasts??=[];f.toasts.push(value)}}}`,
};
const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import StockPage from ${JSON.stringify(root+'/src/app/stock/page.tsx')};createRoot(document.getElementById('app')).render(<StockPage/>);`,resolveDir:root,loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated',setup(b){b.onResolve({filter:/.*/},a=>{if(Object.hasOwn(stubs,a.path))return {path:a.path,namespace:'fixture'};if(a.path.startsWith('@/')){const p=root+'/src/'+a.path.slice(2);return {path:[p,p+'.tsx',p+'.ts'].find(x=>fs.existsSync(x)&&fs.statSync(x).isFile())}}});b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));}}]});
const layout=fs.readFileSync(root+'/.next/server/app/login.html','utf8');
const css=[...layout.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>fs.readFileSync(path.join(root,'.next',m[1].replace(/^\/_next\//,'')),'utf8')).join('\n');
const fontClasses=layout.match(/<html[^>]*class="([^"]*)"/)?.[1]??'';
const product={id:'p1',name:'QA product',sku:'QA-1',category:'Food',active:true,condition:'new',stockQty:999999,sellPrice:123456.78,buyPrice:98765.43,customFields:{},reorderLevel:2};
const base={business:{name:'QA shop',currency:'LKR'},products:[product],suppliers:[],purchaseOrders:[],purchases:[],sales:[],customers:[],stockMovements:[]};
let fixture;
const server=createServer((req,res)=>{if(req.url.startsWith('/images/')){res.end(fs.readFileSync(root+'/public'+req.url));return;}res.setHeader('Content-Type','text/html');res.end(`<html class="${fontClasses}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="app"></div><script>window.fixture=${JSON.stringify(fixture)}</script><script>${bundle.outputFiles[0].text.replace(/<\/script/g,'<\\/script')}</script></html>`)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.LAKBIZ_CHROMIUM_PATH,headless:true});
let passed=0;
function assert(value,message){if(!value)throw Error(message)}
try{
 if(!process.env.STOCK_NAV_ONLY)for(const width of [360,390,768,1440])for(const locale of ['en','si','ta']){
  const page=await browser.newPage({viewport:{width,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function open(extra){fixture={data:base,ready:true,syncing:false,error:null,readOnly:false,locale,...extra};await page.goto(`http://127.0.0.1:${server.address().port}/${extra.query?'?'+extra.query:''}`);await page.waitForTimeout(150);}
  await open({ready:false});await page.locator('[aria-busy="true"]').waitFor();assert(await page.locator('[data-ui="empty-state"]').count()===0,'Loading showed empty state');
  await open({data:{...base,products:[]},syncing:true});await page.locator('[aria-busy="true"]').waitFor();
  await open({data:{...base,products:[]},error:'Synthetic load failure'});await page.getByRole('alert').waitFor();assert(await page.getByRole('alert').getByRole('button').count()===1,'Missing retry');await page.getByRole('alert').getByRole('button').click();await page.getByRole('alert').waitFor();await page.screenshot({path:`${out}/${locale}-${width}-error.png`,fullPage:true});
  await open({data:{...base,products:[]},readOnly:true});await page.locator('[data-ui="empty-state"]').waitFor();assert(await page.locator('[data-ui="empty-state"] button').isDisabled(),'Read-only add enabled');await page.screenshot({path:`${out}/${locale}-${width}-readonly-empty.png`,fullPage:true});
  await open({query:'q=absent&filter=low-stock'});await page.locator('[data-ui="empty-state"] button').click();await page.locator('button:visible').filter({hasText:/^QA product$/}).waitFor();
  await open({data:{...base,products:[{...product,active:false}]}});await page.locator('[data-ui="empty-state"] button').click();await page.locator('button:visible').filter({hasText:/^QA product$/}).waitFor();
  await open({});await page.locator('button:visible').filter({hasText:/^QA product$/}).waitFor();
  const metrics=await page.locator('[data-ui="metric-card"]').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,overflow:n.scrollWidth>n.clientWidth+1})));
  assert(metrics.length===2,'Missing currency metrics');assert(metrics.every(m=>!m.overflow),'Currency metric overflow');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page horizontal overflow');
  await page.screenshot({path:`${out}/${locale}-${width}.png`,fullPage:true});
  await open({readOnly:true});assert(await page.locator('[data-ui="metric-card"]').count()===1,'Cost metric visible for operational role');assert(await page.locator('button:visible').filter({hasText:/^QA product$/}).isDisabled(),'Read-only edit enabled');
  assert(errors.length===0,errors.join('\n'));passed+=8;await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 fixture={data:{...base,products:[product,{...product,id:'p2',name:'Low stock product',sku:'LOW',stockQty:1}]},ready:true,syncing:false,error:null,readOnly:false,locale:'en'};
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForTimeout(300);
 if(errors.length)throw Error(errors.join('\n'));
 const search=page.getByRole('searchbox').first();
 const visibleProducts=()=>page.locator('button:visible').filter({hasText:/^(QA product|Low stock product)$/});
 async function navigate(query){await page.evaluate(q=>{history.pushState({},'',q?'/?'+q:'/');window.dispatchEvent(new Event('fixturechange'))},query);}
 await search.fill('QA product');assert(await search.inputValue()==='QA product','Typing lost value');
 await page.evaluate(()=>{window.fixtureVersion=1;window.dispatchEvent(new Event('fixturechange'))});assert(await search.inputValue()==='QA product','Unrelated rerender cleared search');passed++;
 await navigate('q=Low+stock+product');await page.waitForFunction(()=>document.querySelector('input').value==='Low stock product');assert(await visibleProducts().count()===1,'Navigation kept stale search');passed++;
 await navigate('filter=low-stock');await page.waitForFunction(()=>document.querySelector('input').value==='');assert(await visibleProducts().count()===1,'Low stock route did not filter');passed++;
 await navigate('');await page.waitForTimeout(100);assert(await visibleProducts().count()===2,'All stock route kept stale low-stock filter');passed++;
 await page.evaluate(()=>history.back());await page.waitForTimeout(150);assert(await visibleProducts().count()===1,'Back did not restore low-stock route');passed++;
 await page.evaluate(()=>history.back());await page.waitForFunction(()=>document.querySelector('input').value==='Low stock product');passed++;
 await page.evaluate(()=>history.forward());await page.waitForFunction(()=>document.querySelector('input').value==='');assert(await visibleProducts().count()===1,'Forward did not restore low-stock route');passed++;
 await navigate('');await search.fill('absent');await page.locator('[data-ui="empty-state"]').waitFor();
 await page.evaluate(()=>{window.fixture.orgId='shop-b';window.fixtureVersion++;window.dispatchEvent(new Event('fixturechange'))});await page.waitForFunction(()=>document.querySelector('input').value==='');assert(await visibleProducts().count()===2,'Shop change kept search');passed++;
 await search.fill('absent');await page.evaluate(()=>{window.fixture.readOnly=true;window.fixtureVersion++;window.dispatchEvent(new Event('fixturechange'))});await page.waitForFunction(()=>document.querySelector('input').value==='');assert(await page.locator('[data-ui="metric-card"]').count()===1,'Role reset exposed costs');passed++;
 await page.evaluate(()=>{window.fixture.readOnly=false;window.fixture.rejectMutation=true;window.fixtureVersion++;window.dispatchEvent(new Event('fixturechange'))});
 await page.getByRole('button',{name:'Stock in'}).first().click();
 const stockInDialog=page.getByRole('dialog');await stockInDialog.waitFor();
 const submitStockIn=stockInDialog.getByRole('button',{name:'Add stock'});await submitStockIn.click();
 await page.waitForFunction(()=>window.fixture.mutationCalls===1&&window.fixture.toasts?.length===1);
 assert(await stockInDialog.isVisible(),'Rejected stock mutation closed the draft');
 assert(await submitStockIn.isEnabled(),'Rejected stock mutation left the action busy');
 assert(await stockInDialog.getByRole('spinbutton').inputValue()==='1','Rejected stock mutation discarded quantity');passed++;
 assert(errors.length===0,errors.join('\n'));await page.close();
 fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ passed, languages: ["en", "si", "ta"], widths: [360, 390, 768, 1440], isolatedAdapters: true }, null, 2));
 console.log(`${passed} stock state/role/width/language checks passed; screenshots: ${out}`);
}finally{await browser.close();server.close();}
