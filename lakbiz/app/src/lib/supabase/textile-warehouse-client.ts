"use client";

import { createBrowserClient } from "@/lib/supabase/client";
import type { DispatchStatus } from "@/lib/textile-warehouse-domain";

export type TextileFulfilmentAllocation = { id:string; saleId:string; rollId:string; productId:string; rollNo:string; quantity:number; assignedQuantity:number; lengthUnit:"metre"|"yard"; saleMode:string; createdAt:string };
export type TextileDispatchItem = { id:string; saleAllocationId:string; rollId:string; rollNo:string; quantity:number; pickedQuantity:number; packedQuantity:number };
export type TextileDispatch = { id:string; dispatchNo:string; saleId:string; customerName:string|null; deliveryAddress:string|null; status:DispatchStatus; carrier:string|null; vehicleNo:string|null; trackingReference:string|null; createdAt:string; items:TextileDispatchItem[] };
export type TextileTransfer = { id:string; transferNo:string; rollId:string; rollNo:string; fromLocation:string; toLocation:string; status:"in_transit"|"received"|"cancelled"; initiatedAt:string; receivedAt:string|null };

export async function fetchTextileFulfilmentAllocations(organizationId:string) {
  const supabase=createBrowserClient(); if(!supabase) return {data:[] as TextileFulfilmentAllocation[],error:"Supabase not configured"};
  const [allocResult,itemResult]=await Promise.all([
    supabase.from("textile_sale_allocations").select("id,sale_id,roll_id,product_id,quantity,length_unit,sale_mode,created_at,textile_rolls!inner(roll_no)").eq("organization_id",organizationId).order("created_at",{ascending:false}),
    supabase.from("textile_dispatch_items").select("sale_allocation_id,quantity,textile_dispatches!inner(status)").eq("organization_id",organizationId),
  ]);
  const error=allocResult.error??itemResult.error; if(error) return {data:[],error:error.message};
  const assigned=new Map<string,number>(); for(const row of itemResult.data??[]){ const dispatch=row.textile_dispatches as unknown as {status:string}; if(dispatch.status!=="cancelled") assigned.set(String(row.sale_allocation_id),(assigned.get(String(row.sale_allocation_id))??0)+Number(row.quantity)); }
  return {data:(allocResult.data??[]).map((row)=>({id:String(row.id),saleId:String(row.sale_id),rollId:String(row.roll_id),productId:String(row.product_id),rollNo:String((row.textile_rolls as unknown as {roll_no:string}).roll_no),quantity:Number(row.quantity),assignedQuantity:assigned.get(String(row.id))??0,lengthUnit:String(row.length_unit) as "metre"|"yard",saleMode:String(row.sale_mode),createdAt:String(row.created_at)})),error:null};
}

export async function fetchTextileDispatches(organizationId:string){
 const supabase=createBrowserClient(); if(!supabase) return {data:[] as TextileDispatch[],error:"Supabase not configured"};
 const [dispatchResult,itemResult]=await Promise.all([
  supabase.from("textile_dispatches").select("*").eq("organization_id",organizationId).order("created_at",{ascending:false}),
  supabase.from("textile_dispatch_items").select("*,textile_rolls!inner(roll_no)").eq("organization_id",organizationId),
 ]); const error=dispatchResult.error??itemResult.error;if(error)return{data:[],error:error.message};
 const itemsByDispatch=new Map<string,TextileDispatchItem[]>(); for(const row of itemResult.data??[]){const key=String(row.dispatch_id);const items=itemsByDispatch.get(key)??[];items.push({id:String(row.id),saleAllocationId:String(row.sale_allocation_id),rollId:String(row.roll_id),rollNo:String((row.textile_rolls as unknown as {roll_no:string}).roll_no),quantity:Number(row.quantity),pickedQuantity:Number(row.picked_quantity),packedQuantity:Number(row.packed_quantity)});itemsByDispatch.set(key,items);}
 return {data:(dispatchResult.data??[]).map((row)=>({id:String(row.id),dispatchNo:String(row.dispatch_no),saleId:String(row.sale_id),customerName:row.customer_name?String(row.customer_name):null,deliveryAddress:row.delivery_address?String(row.delivery_address):null,status:String(row.status) as DispatchStatus,carrier:row.carrier?String(row.carrier):null,vehicleNo:row.vehicle_no?String(row.vehicle_no):null,trackingReference:row.tracking_reference?String(row.tracking_reference):null,createdAt:String(row.created_at),items:itemsByDispatch.get(String(row.id))??[]})),error:null};
}

export async function createTextileDispatch(input:{organizationId:string;saleId:string;dispatchId:string;customerName?:string;deliveryAddress?:string;items:Array<{saleAllocationId:string;quantity:number}>;notes?:string}){
 const supabase=createBrowserClient();if(!supabase)return{error:"Supabase not configured"};const{error}=await supabase.rpc("create_textile_dispatch",{p_organization_id:input.organizationId,p_sale_id:input.saleId,p_dispatch_id:input.dispatchId,p_customer_name:input.customerName?.trim()||null,p_delivery_address:input.deliveryAddress?.trim()||null,p_items:input.items.map((item)=>({sale_allocation_id:item.saleAllocationId,quantity:item.quantity})),p_notes:input.notes?.trim()||null});return{error:error?.message??null};
}
export async function transitionTextileDispatch(dispatchId:string,nextStatus:DispatchStatus,input?:{carrier?:string;vehicleNo?:string;trackingReference?:string}){const supabase=createBrowserClient();if(!supabase)return{error:"Supabase not configured"};const{error}=await supabase.rpc("transition_textile_dispatch",{p_dispatch_id:dispatchId,p_next_status:nextStatus,p_carrier:input?.carrier?.trim()||null,p_vehicle_no:input?.vehicleNo?.trim()||null,p_tracking_reference:input?.trackingReference?.trim()||null});return{error:error?.message??null};}
export async function scanTextileDispatchPick(dispatchId:string,rollCode:string,quantity:number){const supabase=createBrowserClient();if(!supabase)return{error:"Supabase not configured"};const{error}=await supabase.rpc("scan_textile_dispatch_pick",{p_dispatch_id:dispatchId,p_roll_code:rollCode.trim(),p_quantity:quantity});return{error:error?.message??null};}

export async function fetchTextileTransfers(organizationId:string){const supabase=createBrowserClient();if(!supabase)return{data:[] as TextileTransfer[],error:"Supabase not configured"};const{data,error}=await supabase.from("textile_roll_transfers").select("*,textile_rolls!inner(roll_no)").eq("organization_id",organizationId).order("initiated_at",{ascending:false});return{data:(data??[]).map((row)=>({id:String(row.id),transferNo:String(row.transfer_no),rollId:String(row.roll_id),rollNo:String((row.textile_rolls as unknown as {roll_no:string}).roll_no),fromLocation:String(row.from_location),toLocation:String(row.to_location),status:String(row.status) as TextileTransfer["status"],initiatedAt:String(row.initiated_at),receivedAt:row.received_at?String(row.received_at):null})),error:error?.message??null};}
export async function initiateTextileTransfer(input:{organizationId:string;transferId:string;rollCode:string;toLocation:string;notes?:string}){const supabase=createBrowserClient();if(!supabase)return{error:"Supabase not configured"};const{error}=await supabase.rpc("initiate_textile_roll_transfer",{p_organization_id:input.organizationId,p_transfer_id:input.transferId,p_roll_code:input.rollCode.trim(),p_to_location:input.toLocation.trim(),p_notes:input.notes?.trim()||null});return{error:error?.message??null};}
export async function receiveTextileTransfer(transferId:string,rollCode:string){const supabase=createBrowserClient();if(!supabase)return{error:"Supabase not configured"};const{error}=await supabase.rpc("receive_textile_roll_transfer",{p_transfer_id:transferId,p_roll_code:rollCode.trim()});return{error:error?.message??null};}
export async function inspectTextileReturn(input:{organizationId:string;holdId:string;saleAllocationId:string;decision:"reusable_remnant"|"damaged"|"rejected";reason:string;newRollNo?:string}){const supabase=createBrowserClient();if(!supabase)return{error:"Supabase not configured"};const{error}=await supabase.rpc("inspect_textile_return",{p_organization_id:input.organizationId,p_hold_id:input.holdId,p_sale_allocation_id:input.saleAllocationId,p_decision:input.decision,p_reason:input.reason.trim(),p_new_roll_no:input.newRollNo?.trim()||null});return{error:error?.message??null};}
