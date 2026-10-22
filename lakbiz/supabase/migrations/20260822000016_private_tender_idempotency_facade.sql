-- LakBiz private POS tender retry hardening.
--
-- Migration 00015 introduced a privacy wrapper that normalizes hidden bank
-- routes and inline cheque metadata before delegating to the atomic sale
-- finalizer. On a client retry after a successful commit, the original raw
-- tender payload must NOT be sent back into the inner finalizer because staff
-- bank-transfer payloads intentionally do not contain the hidden bank account id
-- and staff cheque payloads intentionally do not contain the protected cheque id.
--
-- This facade establishes a clean idempotency boundary BEFORE source
-- normalization. Existing committed tender-engine sales return their stored
-- result immediately; only genuinely new sale ids reach the 00015 wrapper.
-- Direct authenticated execution of the older wrapper is revoked so application
-- clients cannot accidentally bypass this safer replay boundary.

create or replace function public.finalize_sale_with_private_tenders_v2(
  p_organization_id uuid,
  p_sale_id text,
  p_customer_id text default null,
  p_customer_name text default null,
  p_discount numeric default 0,
  p_lines jsonb default '[]'::jsonb,
  p_tenders jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_sale record;
  v_tender_count integer := 0;
begin
  if p_organization_id is null
     or nullif(btrim(coalesce(p_sale_id, '')), '') is null then
    raise exception 'organization_id and sale_id are required' using errcode = '22023';
  end if;

  if not public.org_member_can_write_module(p_organization_id, 'sales')
     or not public.org_member_role_in(
       p_organization_id,
       array['owner','manager','data_entry','cashier']
     ) then
    raise exception 'permission denied for sale finalization' using errcode = '42501';
  end if;

  select s.* into v_existing_sale
  from public.sales_base s
  where s.id = p_sale_id;

  if found then
    if v_existing_sale.organization_id is distinct from p_organization_id then
      raise exception 'sale id already belongs to another organization' using errcode = '23505';
    end if;

    select count(*) into v_tender_count
    from public.sale_tenders t
    where t.organization_id = p_organization_id
      and t.sale_id = p_sale_id;

    if v_tender_count = 0 then
      raise exception 'sale id already exists outside the tender finalizer' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'sale_id', v_existing_sale.id,
      'bill_no', v_existing_sale.bill_no,
      'total', v_existing_sale.total,
      'payment_method', v_existing_sale.payment_method,
      'credit_amount', v_existing_sale.credit_amount,
      'tender_count', v_tender_count
    );
  end if;

  return public.finalize_sale_with_private_tenders(
    p_organization_id,
    p_sale_id,
    p_customer_id,
    p_customer_name,
    p_discount,
    p_lines,
    p_tenders
  );
end;
$$;

-- Force normal application clients through the v2 replay boundary. The v2
-- SECURITY DEFINER function can still invoke the underlying wrapper as owner.
revoke execute on function public.finalize_sale_with_private_tenders(
  uuid, text, text, text, numeric, jsonb, jsonb
) from authenticated;

revoke all on function public.finalize_sale_with_private_tenders_v2(
  uuid, text, text, text, numeric, jsonb, jsonb
) from public, anon;
grant execute on function public.finalize_sale_with_private_tenders_v2(
  uuid, text, text, text, numeric, jsonb, jsonb
) to authenticated;

comment on function public.finalize_sale_with_private_tenders_v2(
  uuid, text, text, text, numeric, jsonb, jsonb
) is
  'Idempotent public POS facade: returns committed tender-engine sales before hidden bank/cheque normalization, otherwise delegates to finalize_sale_with_private_tenders.';
