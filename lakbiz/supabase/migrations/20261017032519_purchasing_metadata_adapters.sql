-- Prepared only: no gate changes or live activation.
create index purchase_invoices_history_idx on public.purchase_receipt_invoices(organization_id,created_at desc,id);
create index purchase_receipts_history_idx on public.purchase_order_receipts(organization_id,purchase_order_id,received_at desc,receipt_id);
create function inventory_internal.guard_invoice_supplier_lifecycle()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user in ('authenticated','anon') and exists(select 1 from public.purchase_invoice_settings where enabled and organization_id=case when tg_op='DELETE' then old.organization_id else new.organization_id end) then
    if tg_op='DELETE' then raise exception 'Supplier accounts cannot be deleted under invoice authority' using errcode='42501'; end if;
    if new.payable_balance<>0 then raise exception 'Opening payable requires reconciliation' using errcode='42501'; end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end;
$$;
revoke all on function inventory_internal.guard_invoice_supplier_lifecycle() from public,anon,authenticated;
create trigger suppliers_invoice_lifecycle_guard before insert or delete on public.suppliers for each row execute function inventory_internal.guard_invoice_supplier_lifecycle();
create function public.save_purchase_supplier_metadata(p_organization_id uuid,p_rows jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare item jsonb; supplier public.suppliers%rowtype; total integer:=0; sid text;
begin
  if auth.uid() is null or not public.can_see_org_financials(p_organization_id) or not public.org_member_can_write_module(p_organization_id,'suppliers') then
    raise exception 'Owner supplier write access required' using errcode='42501'; end if;
  perform 1 from public.purchase_invoice_settings where organization_id=p_organization_id and enabled for share;
  if not found then raise exception 'Invoice authority is not enabled'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Supplier metadata must be an array'; end if;
  if jsonb_array_length(p_rows)>200 then raise exception 'Submit at most 200 supplier rows'; end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_rows))<>jsonb_array_length(p_rows) then raise exception 'Supplier IDs must be unique'; end if;
  for item in select value from jsonb_array_elements(p_rows) order by value->>'id' loop
    sid:=nullif(btrim(item->>'id'),'');
    if sid is null or length(sid)>200 or (item->>'organization_id')::uuid is distinct from p_organization_id
      or nullif(btrim(item->>'name'),'') is null or length(item->>'name')>200 or length(item->>'phone')>100
      or length(item->>'address')>2000 or length(item->>'vat_number')>100 or length(item->>'contact_person')>200 then raise exception 'Invalid supplier metadata'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('supplier-metadata:'||sid,0));
    select * into supplier from public.suppliers where id=sid for update;
    if found then
      if supplier.organization_id<>p_organization_id then raise exception 'Supplier belongs to another company'; end if;
      update public.suppliers set name=btrim(item->>'name'),phone=item->>'phone',address=item->>'address',vat_number=item->>'vat_number',contact_person=item->>'contact_person'
        where id=sid and organization_id=p_organization_id;
    else
      if coalesce((item->>'payable_balance')::numeric,0)<>0 then raise exception 'New supplier opening payable requires reconciliation'; end if;
      insert into public.suppliers(id,organization_id,name,phone,address,vat_number,contact_person,payable_balance)
        values(sid,p_organization_id,btrim(item->>'name'),item->>'phone',item->>'address',item->>'vat_number',item->>'contact_person',0);
    end if;
    total:=total+1;
  end loop;
  return total;
end;
$$;
revoke all on function public.save_purchase_supplier_metadata(uuid,jsonb) from public,anon;
grant execute on function public.save_purchase_supplier_metadata(uuid,jsonb) to authenticated;

create function public.get_purchase_invoice_workspace(p_organization_id uuid,p_purchase_order_id text default null,p_page integer default 0,p_receipt_page integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare output jsonb;
begin
  if auth.uid() is null or not public.can_see_org_financials(p_organization_id) then raise exception 'Owner financial access required' using errcode='42501'; end if;
  if p_page is null or p_receipt_page is null or p_page<0 or p_receipt_page<0 or p_page>100000 or p_receipt_page>100000 then raise exception 'Invalid invoice history page'; end if;
  if p_purchase_order_id is not null and not exists(select 1 from public.purchase_orders where organization_id=p_organization_id and id=p_purchase_order_id) then raise exception 'Purchase order not found in this company'; end if;
  with available as (
    select r.organization_id,r.receipt_id,r.purchase_order_id,r.received_at,r.request_lines from public.purchase_order_receipts r
      where r.organization_id=p_organization_id and r.purchase_order_id=p_purchase_order_id
      and not exists(select 1 from public.purchase_invoice_receipts a where a.organization_id=r.organization_id and a.receipt_id=r.receipt_id)
  ), receipt_page as (select * from available order by received_at desc,receipt_id limit 50 offset p_receipt_page::bigint*50),
  invoice_page as (select organization_id,id,supplier_id,supplier_invoice_no,invoice_date,currency,subtotal_minor,input_vat_minor,total_minor,created_at
    from public.purchase_receipt_invoices where organization_id=p_organization_id order by created_at desc,id limit 25 offset p_page::bigint*25)
  select jsonb_build_object('organizationId',p_organization_id,'enabled',coalesce((select enabled from public.purchase_invoice_settings where organization_id=p_organization_id),false),
    'orderId',p_purchase_order_id,'page',p_page,'receiptPage',p_receipt_page,'invoiceCount',(select count(*) from public.purchase_receipt_invoices where organization_id=p_organization_id),
    'receiptCount',(select count(*) from available),'billed','[]'::jsonb,'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by r.received_at desc,r.receipt_id) from receipt_page r),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc,i.id) from invoice_page i),'[]'::jsonb)) into output;
  return output;
end;
$$;
revoke all on function public.get_purchase_invoice_workspace(uuid,text,integer,integer) from public,anon;
grant execute on function public.get_purchase_invoice_workspace(uuid,text,integer,integer) to authenticated;
-- Existing orders have no reliable measurement unit; never guess one.
alter table public.purchase_order_lines add column if not exists length_unit text;
alter table public.purchase_order_lines add constraint purchase_order_lines_length_unit_check
  check (length_unit is null or length_unit in ('metre', 'yard'));

-- Preserve the original command's authorization and retry identity while adding
-- measured units to its transaction. The renamed function is no longer public.
alter function public.create_purchase_order_atomic(uuid,text,jsonb) rename to create_purchase_order_without_length_unit;
revoke all on function public.create_purchase_order_without_length_unit(uuid,text,jsonb) from public,anon,authenticated;
create function public.create_purchase_order_atomic(p_organization_id uuid,p_purchase_order_id text,p_input jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare item jsonb; unit text; result text;
begin
  perform inventory_internal.require_purchase_authority(p_organization_id);
  if jsonb_typeof(p_input->'lines') is distinct from 'array' then raise exception 'Invalid purchase order lines'; end if;
  for item in select value from jsonb_array_elements(p_input->'lines') loop
    unit:=item->>'lengthUnit';
    if unit is not null and (unit not in ('metre','yard') or not exists(select 1 from public.products_base where organization_id=p_organization_id and id=item->>'productId' and sector_id='textile')) then
      raise exception 'Fabric length unit must be metres or yards for a textile product';
    end if;
  end loop;
  result:=public.create_purchase_order_without_length_unit(p_organization_id,p_purchase_order_id,p_input);
  for item in select value from jsonb_array_elements(p_input->'lines') where value->>'lengthUnit' is not null loop
    update public.purchase_order_lines set length_unit=item->>'lengthUnit'
      where organization_id=p_organization_id and purchase_order_id=p_purchase_order_id and product_id=item->>'productId'
        and (length_unit is null or length_unit=item->>'lengthUnit');
    if not found then raise exception 'Purchase line measurement changed. Review the order.'; end if;
  end loop;
  return result;
end $$;
revoke all on function public.create_purchase_order_atomic(uuid,text,jsonb) from public,anon;
grant execute on function public.create_purchase_order_atomic(uuid,text,jsonb) to authenticated;
