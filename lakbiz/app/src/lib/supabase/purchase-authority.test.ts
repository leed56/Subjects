import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyAppData } from "@/lib/store/storage";
import { hasPendingPurchase, mergePurchaseSnapshot, performPurchaseAction, purchaseAuthority } from "./purchase-authority";
import type { PurchaseOrder } from "@/lib/store/types";

const state = vi.hoisted(() => ({ enabled: true, flagError: null as null | {code:string;message:string}, error: null as null | {code?:string;message:string}, refreshError: false, throwRequest: false,
  wrongOrg: false, storageFail: false, calls: [] as {name:string;args:Record<string,unknown>}[] }));
vi.mock("./client", () => ({ createBrowserClient: () => ({
  from: () => { const builder={select:()=>builder,eq:()=>builder,maybeSingle:async()=>({data:{enabled:state.enabled},error:state.flagError})};return builder; },
  rpc: async (name:string,args:Record<string,unknown>) => {
    state.calls.push({name,args});
    if (state.throwRequest) throw new Error("Connection lost after submission");
    if(name!=="get_purchase_order_authority_snapshot")return {data:args.p_purchase_order_id,error:state.error};
    return {error:state.refreshError?{message:"Refresh failed"}:null,data:{
      order:{id:args.p_purchase_order_id,organization_id:state.wrongOrg?"foreign":"org",po_no:"PO-001",order_date:"2026-10-16",supplier_id:"supplier",supplier_name:"Supplier",expected_total:10,status:"partial"},
      lines:[{id:"line",organization_id:"org",purchase_order_id:args.p_purchase_order_id,product_id:"p",product_name:"Product",qty_ordered:10,qty_received:2,unit_cost:5}],
      products:[{id:"p",organization_id:"org",stock_qty:12,buy_price:5}],
      logs:[{id:"po-receipt:delivery:line",organization_id:"org",product_id:"p",product_name:"Product",qty:2,log_date:"2026-10-16",user_id:"owner"}],
    }};
  },
}) }));
const storage = new Map<string,string>();
const order:PurchaseOrder={id:"po",poNo:"PO-001",date:"2026-10-16",supplierId:"supplier",supplierName:"Supplier",expectedTotal:50,status:"pending",
  lines:[{id:"line",productId:"p",productName:"Product",qtyOrdered:10,qtyReceived:0,unitCost:5}]};
const receive = {kind:"receive" as const,order,lines:[{productId:"p",qtyReceived:2}]};
beforeEach(()=>{
  storage.clear();Object.assign(state,{enabled:true,flagError:null,error:null,refreshError:false,throwRequest:false,wrongOrg:false,storageFail:false,calls:[]});
  vi.stubGlobal("window",{localStorage:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>{if(state.storageFail)throw Error("Storage full");storage.set(key,value);},removeItem:(key:string)=>storage.delete(key)}});
  vi.stubGlobal("navigator",{locks:{request:async(_name:string,callback:()=>unknown)=>callback()}});
});

describe("durable purchasing commands",()=>{
  it("uses stable line IDs and expected received quantities without local optimistic stock",async()=>{
    const result=await performPurchaseAction("org","owner",receive);
    expect(state.calls[0]).toMatchObject({name:"receive_purchase_order_atomic",args:{p_lines:[{line_id:"line",qty:2,expected_received:0}]}});
    expect(order.lines[0].qtyReceived).toBe(0);
    expect(hasPendingPurchase("org","owner")).toBe(true);
    if(!result.handled||!("snapshot" in result))throw Error("Expected snapshot");
    result.acknowledge();expect(hasPendingPurchase("org","owner")).toBe(false);
  });
  it("preserves and replays the delivery key after a lost network result",async()=>{
    state.throwRequest=true;
    await performPurchaseAction("org","owner",receive);
    const first=state.calls[0].args;
    state.throwRequest=false;
    await performPurchaseAction("org","owner",{kind:"resume"});
    expect(state.calls[1].args).toEqual(first);
  });
  it("keeps the delivery command when server save succeeds but refresh fails",async()=>{
    state.refreshError=true;
    expect(await performPurchaseAction("org","owner",receive)).toMatchObject({handled:true,error:expect.stringMatching(/Saved on the server/)});
    const first=state.calls[0].args;state.refreshError=false;
    await performPurchaseAction("org","owner",{kind:"resume"});
    expect(state.calls[2].args).toEqual(first);
  });
  it("blocks changing an uncertain delivery or starting a different order",async()=>{
    state.throwRequest=true;await performPurchaseAction("org","owner",receive);state.throwRequest=false;
    expect(await performPurchaseAction("org","owner",{...receive,lines:[{productId:"p",qtyReceived:3}]})).toMatchObject({error:expect.stringMatching(/pending/)});
    expect(state.calls).toHaveLength(1);
  });
  it("sends no mutation if durable storage is unavailable",async()=>{
    state.storageFail=true;
    expect(await performPurchaseAction("org","owner",receive)).toMatchObject({error:"Storage full"});
    expect(state.calls).toHaveLength(0);
  });
  it("clears a definitively rejected transaction but retains unknown transport errors",async()=>{
    state.error={code:"P0001",message:"Stale receipt"};await performPurchaseAction("org","owner",receive);
    expect(hasPendingPurchase("org","owner")).toBe(false);
    state.error={message:"Failed to fetch"};await performPurchaseAction("org","owner",receive);
    expect(hasPendingPurchase("org","owner")).toBe(true);
  });
  it("does not fall back to legacy writes if authority is disabled with an unresolved command",async()=>{
    state.throwRequest=true;await performPurchaseAction("org","owner",receive);state.throwRequest=false;state.enabled=false;
    expect(await performPurchaseAction("org","owner",receive)).toMatchObject({handled:true,error:expect.stringMatching(/disabled/)});
    expect(hasPendingPurchase("org","owner")).toBe(true);
  });
  it("leaves disabled and missing-schema companies on their existing path",async()=>{
    state.enabled=false;expect(await performPurchaseAction("org","owner",receive)).toEqual({handled:false});
    state.flagError={code:"PGRST205",message:"Missing table"};expect(await purchaseAuthority("org")).toEqual({enabled:false,error:null});
    expect(state.calls).toHaveLength(0);
  });
  it("fails closed on authority lookup errors",async()=>{
    state.flagError={code:"NETWORK",message:"Connection failed"};
    expect(await performPurchaseAction("org","owner",receive)).toMatchObject({error:"Connection failed"});expect(state.calls).toHaveLength(0);
  });
  it("does not merge a response for a different company or lose its recovery key",async()=>{
    state.wrongOrg=true;expect(await performPurchaseAction("org","owner",receive)).toMatchObject({error:expect.stringMatching(/organization/)});
    expect(hasPendingPurchase("org","owner")).toBe(true);
  });
  it("isolates pending commands by user and company",async()=>{
    await performPurchaseAction("org","owner",receive);
    expect(hasPendingPurchase("other","owner")).toBe(false);expect(hasPendingPurchase("org","other-owner")).toBe(false);
  });
  it("merges authoritative stock and audit without duplicating logs or replacing other drafts",async()=>{
    const result=await performPurchaseAction("org","owner",receive);
    if(!result.handled||!("snapshot" in result))throw Error("Expected snapshot");
    const data={...emptyAppData(),products:[{id:"p",name:"Local name",stockQty:10,buyPrice:2}] as ReturnType<typeof emptyAppData>["products"]};
    const next=mergePurchaseSnapshot(data,result.snapshot);const replay=mergePurchaseSnapshot(next,result.snapshot);
    expect(replay.stockLogs).toHaveLength(1);expect(replay.products[0]).toMatchObject({name:"Local name",stockQty:12,buyPrice:5});expect(data.products[0].stockQty).toBe(10);
  });
  it("preserves an order creation ID across uncertain retries",async()=>{
    state.throwRequest=true;
    const action={kind:"create" as const,input:{supplierId:"supplier",lines:[{productId:"p",qty:2,unitCost:5}]}};
    await performPurchaseAction("org","owner",action);state.throwRequest=false;
    await performPurchaseAction("org","owner",action);
    expect(state.calls[1].args.p_purchase_order_id).toBe(state.calls[0].args.p_purchase_order_id);
  });
});
