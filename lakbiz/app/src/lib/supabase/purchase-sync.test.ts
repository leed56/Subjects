import {beforeEach,describe,expect,it,vi} from "vitest";
import {emptyAppData} from "@/lib/store/storage";
import {pushBusinessData,syncPurchaseOrderSnapshot,syncPurchaseSnapshot,syncSupplierPaymentSnapshot} from "./business-sync";
const state=vi.hoisted(()=>({enabled:true,invoiceEnabled:false,error:false,writes:[] as {table:string;operation:string;rows:unknown}[]}));
vi.mock('./client',()=>({createBrowserClient:()=>({
  from(table:string){
    let offset=0;let operation='select';
    const builder={
      select:()=>builder,eq:()=>builder,in:()=>builder,not:()=>builder,order:()=>builder,
      range:(from:number)=>{offset=from;return builder;},
      maybeSingle:async()=>({data:{enabled:table==='purchase_invoice_settings'?state.invoiceEnabled:table==='purchase_receipt_settings'&&state.enabled},error:state.error?{code:'NETWORK',message:'Authority unavailable'}:null}),
      upsert:(rows:unknown)=>{state.writes.push({table,operation:'upsert',rows});return builder;},
      insert:(rows:unknown)=>{state.writes.push({table,operation:'insert',rows});return builder;},
      delete:()=>{operation='delete';state.writes.push({table,operation,rows:[]});return builder;},
      then:(resolve:(result:unknown)=>unknown)=>Promise.resolve({data:operation==='select'&&offset===0?(table==='stock_logs'?[{id:'po-receipt:unknown:line'}]:table==='bank_transactions'?[{id:'purchase-bank:unknown'},{id:'sale-tender:unknown'}]:table==='products'?[{id:'existing'}]:[]):[],count:1,error:null}).then(resolve),
    };return builder;
  },
  rpc:async(name:string,args:Record<string,unknown>)=>{state.writes.push({table:name,operation:'rpc',rows:args.p_rows});return {data:1,error:null};},
})}));
const data=()=>({...emptyAppData(),purchaseOrders:[{id:'po',poNo:'PO',supplierId:'s',supplierName:'Supplier',date:'2026-10-16',expectedTotal:5,status:'pending' as const,
  lines:[{productId:'p',productName:'Product',qtyOrdered:1,qtyReceived:0,unitCost:5}]}],stockLogs:[{id:'po-receipt:known:line',productId:'p',productName:'Product',type:'purchase' as const,qty:1,date:'2026-10-16'}]});
beforeEach(()=>{state.enabled=true;state.invoiceEnabled=false;state.error=false;state.writes=[];});
describe('authoritative purchasing snapshot isolation',()=>{
  it('preserves managed bank ledger entries during snapshot upsert and pruning',async()=>{
    const snapshot=data();
    snapshot.bankTransactions=['purchase-bank:known','sale-tender:known','return:known','bank-reversal:known','bank-opening:known','manual'].map(id=>({id,accountId:'account',type:'deposit' as const,amount:1,date:'2026-10-16'}));
    expect((await pushBusinessData('org',snapshot,{seenGeneration:0})).error).toBeNull();
    const rows=state.writes.find(row=>row.table==='bank_transactions'&&row.operation==='upsert')?.rows as {id:string}[];
    expect(rows.map(row=>row.id)).toEqual(['manual']);
    expect(state.writes.filter(row=>row.table==='bank_transactions'&&row.operation==='delete')).toEqual([]);
  });
  it('invoice authority blocks legacy GRN/payment but allows safe background snapshots',async()=>{
    state.invoiceEnabled=true;
    expect(await syncPurchaseSnapshot('org',data(),'grn')).toMatch(/Legacy GRNs/);
    expect(await syncSupplierPaymentSnapshot('org',data(),'payment')).toMatch(/Legacy GRNs/);
    expect(state.writes).toEqual([]);
    const snapshot=data();snapshot.suppliers=[{id:'supplier',name:'Supplier',payableBalance:999}];
    expect((await pushBusinessData('org',snapshot,{seenGeneration:0})).error).toBeNull();
    expect(state.writes.some(row=>row.table==='save_purchase_supplier_metadata')).toBe(true);
    expect(state.writes.filter(row=>['purchases','purchase_lines','supplier_payments','suppliers'].includes(row.table))).toEqual([]);
  });
  it('enabled invoice authority never overwrites or prunes bank balances and ledger snapshots',async()=>{
    state.invoiceEnabled=true;
    const snapshot=data();
    snapshot.bankAccounts=[{id:'account',bankName:'Bank',accountName:'Account',accountNumber:'123',balance:999}];
    snapshot.bankTransactions=[{id:'manual',accountId:'account',type:'deposit',amount:5,date:'2026-10-16'}];
    expect((await pushBusinessData('org',snapshot,{seenGeneration:0})).error).toBeNull();
    expect(state.writes.filter(row=>['bank_accounts','bank_transactions','bank_transfers','cheques'].includes(row.table))).toEqual([]);
  });
  it('background sync cannot replace order headers, line identities or unknown receipt logs',async()=>{
    const result=await pushBusinessData('org',data(),{seenGeneration:0});
    expect(result.error).toBeNull();
    expect(state.writes.filter(write=>['purchase_orders','purchase_order_lines','stock_logs'].includes(write.table))).toEqual([]);
  });
  it('targeted PO snapshot fails before any write when authority is enabled',async()=>{
    expect(await syncPurchaseOrderSnapshot('org',data(),'po')).toMatch(/atomic purchasing/);expect(state.writes).toHaveLength(0);
  });
  it('unavailable authority never falls back to legacy writes',async()=>{
    state.error=true;expect(await syncPurchaseOrderSnapshot('org',data(),'po')).toBe('Authority unavailable');
    expect((await pushBusinessData('org',data(),{seenGeneration:0})).error).toBe('Authority unavailable');expect(state.writes).toHaveLength(0);
  });
  it('disabled companies retain their existing PO snapshot path',async()=>{
    state.enabled=false;expect(await syncPurchaseOrderSnapshot('org',data(),'po')).toBeNull();
    expect(state.writes.map(write=>write.table)).toContain('purchase_orders');expect(state.writes.map(write=>write.table)).toContain('purchase_order_lines');
  });
  it('background snapshots preserve server buy costs but retain the opening cost of new catalogue items',async()=>{
    const snapshot=data();
    snapshot.products=['existing','new'].map(id=>({id,name:id,buyPrice:7,sellPrice:12,stockQty:0,category:'General',sectorId:'grocery',condition:'new',customFields:{},active:true}));
    expect((await pushBusinessData('org',snapshot,{seenGeneration:0})).error).toBeNull();
    const updated=state.writes.find(row=>row.table==='bulk_update_masked_view_rows')?.rows as Record<string,unknown>[];
    expect(updated[0]).not.toHaveProperty('buy_price');
    const inserted=state.writes.find(row=>row.table==='products'&&row.operation==='insert')?.rows as Record<string,unknown>[];
    expect(inserted[0]).toMatchObject({id:'new',buy_price:7});
  });
});
