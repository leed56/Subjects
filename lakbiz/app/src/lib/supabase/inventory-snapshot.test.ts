import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyAppData } from "@/lib/store/storage";
import { syncProductSnapshot, syncProductsSnapshot, pushBusinessData } from "./business-sync";
import type { AppData } from "@/lib/store/types";

const state = vi.hoisted(() => ({ enabled: true, commandError: "", settingError: "", cloudQty: 10, writes: [] as {name:string;args:Record<string,unknown>}[] }));
vi.mock("./client", () => ({ createBrowserClient: () => ({
  from(table:string) {
    let offset=0;
    const builder = {
      select:()=>builder, eq:()=>builder, in:()=>builder,
      range:(from:number)=>{offset=from;return builder;},
      maybeSingle:async()=>({data:{enabled:state.enabled},error:state.settingError?{message:state.settingError,code:"NETWORK"}:null}),
      then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:offset===0&&table==="products"?[{id:"p",stock_qty:state.cloudQty}]:[],error:null}).then(resolve),
      insert:async(rows:unknown)=>{state.writes.push({name:`insert:${table}`,args:{rows}});return {error:null};},
      upsert:async(rows:unknown)=>{state.writes.push({name:`upsert:${table}`,args:{rows}});return {error:null};},
    };
    return builder;
  },
  rpc:async(name:string,args:Record<string,unknown>)=>{state.writes.push({name,args});return {data:null,error:name==="apply_inventory_stock_commands"&&state.commandError?{message:state.commandError}:null};},
}) }));

function snapshot():AppData {
  return { ...emptyAppData(), products:[{id:"p",name:"Product",stockQty:8,buyPrice:5,sellPrice:10,category:"",sectorId:"grocery",condition:"new",customFields:{},active:true} as AppData["products"][number]],
    stockLogs:[{id:"movement",productId:"p",productName:"Product",type:"out",qty:2,date:"2026-10-16T00:00:00Z"}] };
}
beforeEach(()=>{state.enabled=true;state.commandError="";state.settingError="";state.cloudQty=10;state.writes=[];});
describe("location authority stock snapshot integration",()=>{
  it("uses a durable compare-and-swap command and excludes stock from later metadata writes",async()=>{
    expect(await syncProductSnapshot("org",snapshot(),["p"],{stockLogIds:["movement"]})).toBeNull();
    expect(state.writes.find(row=>row.name==="apply_inventory_stock_commands")?.args.p_changes).toMatchObject([{product_id:"p",command_key:"stock-log:movement",expected_qty:10,next_qty:8,stock_log:{id:"movement",log_type:"out",qty:2}}]);
    expect(state.writes).toHaveLength(1);
  });
  it("preserves the existing behavior for organizations that have not enabled location authority",async()=>{
    state.enabled=false;
    expect(await syncProductSnapshot("org",snapshot(),["p"],{stockLogIds:["movement"]})).toBeNull();
    expect(state.writes.some(row=>row.name==="apply_inventory_stock_commands")).toBe(false);
    const rows=state.writes.find(row=>row.name==="bulk_update_masked_view_rows")?.args.p_rows as Record<string,unknown>[];
    expect(rows[0].stock_qty).toBe(8);
  });
  it("stops before metadata and log writes when stock changed on another device",async()=>{
    state.commandError="Stock changed on another device";
    const draft=snapshot();
    expect(await syncProductSnapshot("org",draft,["p"],{stockLogIds:["movement"]})).toMatch(/another device/);
    expect(state.writes).toHaveLength(1);
    expect(draft.products[0].stockQty).toBe(8);
  });
  it("refuses a stale whole-business snapshot before it can write any table",async()=>{
    state.cloudQty=7;
    const result=await pushBusinessData("org",snapshot(),{seenGeneration:0});
    expect(result.stale).toBe(true);
    expect(result.error).toMatch(/snapshot cannot replace/);
    expect(state.writes).toHaveLength(0);
  });
  it("fails closed when stock-authority loading has a network error",async()=>{
    state.settingError="Connection failed";
    expect(await syncProductSnapshot("org",snapshot(),["p"],{stockLogIds:["movement"]})).toBe("Connection failed");
    expect(state.writes).toHaveLength(0);
  });
  it("rejects changing a stock quantity through a metadata-only product edit",async()=>{
    expect(await syncProductSnapshot("org",snapshot(),["p"])).toMatch(/require a stock movement/);
    expect(state.writes).toHaveLength(0);
  });
  it("refuses a bulk product snapshot with stale quantities",async()=>{
    expect(await syncProductsSnapshot("org",snapshot())).toMatch(/cannot change authoritative stock/);
    expect(state.writes).toHaveLength(0);
  });
  it("allows metadata edits at the current quantity without resending stock",async()=>{
    state.cloudQty=8;
    expect(await syncProductSnapshot("org",snapshot(),["p"])).toBeNull();
    const rows=state.writes.find(row=>row.name==="bulk_update_masked_view_rows")?.args.p_rows as Record<string,unknown>[];
    expect(rows[0]).not.toHaveProperty("stock_qty");
  });
});
