import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const require=createRequire(import.meta.url);
const {build}=require(process.env.TEXTILE_QA_ESBUILD ?? 'esbuild');
const {chromium}=require(process.env.LAKBIZ_QA_PLAYWRIGHT ?? 'playwright');
const root=path.resolve(import.meta.dirname,'..');
const out=process.env.LAKBIZ_UI_QA_DIR ?? path.join(os.tmpdir(),'lakbiz-phase1-workflows');
fs.mkdirSync(out,{recursive:true});
const routes=['workforce','vehicles','teams','assets','expenses','schedule','stock/advanced','stock/advanced/queue','stock/advanced/returns','banking/pos-routing','pulse','stock/imports'];
const f='const f=window.fixture;';
const mutate=`async function mutate(...args){f.calls.push(args);await new Promise(r=>setTimeout(r,80));if(f.rejectMutation)throw Error('Synthetic rejected request');return {ok:false,data:null,error:'Synthetic save failure'}}`;
const stubs={
 'next/link':'import React from "react";export default function Link({children,...p}){return <a {...p}>{children}</a>}',
 'next/navigation':'export function useSearchParams(){return new URLSearchParams()}export function useRouter(){return {push(){},replace(){}}}export function usePathname(){return location.pathname}',
 '@/components/shell/app-shell':'export function AppShell({children}){return <div className="min-w-0">{children}</div>}',
 '@/components/auth-provider':'export function useAuth(){return {user:{email:"owner@example.com"},logout:async()=>{}}}',
 '@/lib/i18n/locale-provider':`import {translate} from ${JSON.stringify(root+'/src/lib/i18n/translations.ts')};${f}const t=k=>translate(f.locale,k);export function useLocale(){return {locale:f.locale,t}}`,
 '@/lib/subscription/use-can-write':`${f}export function useWriteAccess(){return {canWrite:!f.readOnly,disabledHint:f.readOnly?'Read only':null}}`,
 '@/components/write-disabled-hint':`${f}export function WriteDisabledHint(){return f.readOnly?<p>Read only</p>:null}`,
 '@/lib/subscription/subscription-provider':`${f}const org={id:'fixture-org',isAuthenticated:true,sector:'ac',name:'Fixture shop'};export function useSubscription(){return {org,orgRole:f.readOnly?'cashier':'owner',canSeeFinancials:!f.readOnly,can:()=>!f.readOnly,subscription:{planId:'pro'}}}`,
 '@/lib/store/use-app-store':`${f}${mutate}export function useAppStore(){return new Proxy({data:f.data,ready:true,cloudSyncing:false,cloudSyncError:null},{get:(target,key)=>key in target?target[key]:mutate})}`,
 '@/components/ui/toast':`${f}export function useToast(){return {toast:x=>f.toasts.push(x)}}`,
 '@/components/messaging/message-send-button':'export function MessageSendButton(){return null}',
 '@/lib/messaging/use-sms-api-configured':'export function useWhatsAppApiConfigured(){return false}',
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
  fixture={route:routes.indexOf(route),locale:'en',data:{},calls:[],toasts:[],rejectMutation:true};
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForTimeout(250);
  assert(!errors.length,`${route}: ${errors.join(';')}`);
  assert(await page.locator('main').count()>0,`${route}: no main`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!overflow,`${route} ${width}: page overflow`);
  await page.screenshot({path:path.join(out,route.replaceAll('/','-')+'-'+width+'.png'),fullPage:true});
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
  results.push({route,width,passed:true});await page.close();
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(`${results.length} production route fixtures passed; isolated adapters, no live writes.`);
}finally{await browser.close();server.close();}
