-- LakBiz POS bank-transfer fallback for shops without the Banking module.
--
-- A shop may legitimately accept a customer bank transfer even when its plan /
-- sector does not include LakBiz's internal Banking ledger. We must not invent a
-- fake bank account merely to make POS checkout work.
--
-- Rules:
--   * if Banking is enabled, bank-transfer checkout still requires the private
--     owner-configured route from migration 00015 (or an owner override);
--   * if Banking is NOT enabled and no private route exists, the transfer is
--     recorded as customer-facing tender evidence only — no bank account,
--     balance or bank transaction is fabricated;
--   * the underlying 00014/00015 transaction remains authoritative for sale,
--     stock, credit, returns and advanced inventory;
--   * this facade temporarily normalizes only those external transfer tenders to
--     an accepted non-bank kind inside the nested finalizer, then rewrites the
--     immutable tender classification back to bank_transfer before commit;
--   * retries return the already-committed sale before any normalization.

create or replace function public.finalize_sale_with_private_tenders_v3(
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
  v_tender jsonb;
  v_normalized_tenders jsonb := '[]'::jsonb;
  v_external_tender_ids text[] := array[]::text[];
  v_tender_id text;
  v_kind text;
  v_bank_account_id text;
  v_has_private_route boolean := false;
  v_has_banking_module boolean := false;
  v_result jsonb;
  v_final_method text;
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

  -- Idempotency before any source normalization.
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

  if jsonb_typeof(coalesce(p_tenders, '[]'::jsonb)) <> 'array' then
    raise exception 'p_tenders must be a JSON array' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.pos_payment_routes r
    where r.organization_id = p_organization_id
  ) into v_has_private_route;

  v_has_banking_module := public.org_has_module(p_organization_id, 'banking');

  for v_tender in
    select value from jsonb_array_elements(coalesce(p_tenders, '[]'::jsonb))
  loop
    v_tender_id := nullif(btrim(v_tender->>'id'), '');
    v_kind := nullif(btrim(v_tender->>'kind'), '');
    v_bank_account_id := nullif(btrim(v_tender->>'bank_account_id'), '');

    if v_kind = 'bank_transfer'
       and v_bank_account_id is null
       and not v_has_private_route
       and not v_has_banking_module then
      if v_tender_id is null then
        raise exception 'tender id is required' using errcode = '22023';
      end if;

      -- 00014 requires a source for its bank_transfer branch. For a shop that
      -- has no Banking ledger by design, normalize only inside the nested call.
      -- This function rewrites the persisted tender back to bank_transfer before
      -- the outer transaction can commit, so no fake card payment survives.
      v_external_tender_ids := array_append(v_external_tender_ids, v_tender_id);
      v_tender := jsonb_set(v_tender, '{kind}', '"card"'::jsonb, false);
      v_tender := v_tender || jsonb_build_object(
        'note', coalesce(nullif(btrim(v_tender->>'note'), ''), 'External bank transfer; Banking module not enabled')
      );
    end if;

    v_normalized_tenders := v_normalized_tenders || jsonb_build_array(v_tender);
  end loop;

  v_result := public.finalize_sale_with_private_tenders_v2(
    p_organization_id,
    p_sale_id,
    p_customer_id,
    p_customer_name,
    p_discount,
    p_lines,
    v_normalized_tenders
  );

  if coalesce((v_result->>'replayed')::boolean, false) then
    return v_result;
  end if;

  if coalesce(array_length(v_external_tender_ids, 1), 0) > 0 then
    update public.sale_tenders t
    set kind = 'bank_transfer'
    where t.organization_id = p_organization_id
      and t.sale_id = p_sale_id
      and t.id = any(v_external_tender_ids)
      and t.kind = 'card';

    select count(*) into v_tender_count
    from public.sale_tenders t
    where t.organization_id = p_organization_id
      and t.sale_id = p_sale_id;

    if v_tender_count = 1 then
      v_final_method := 'bank_transfer';
    else
      v_final_method := 'mixed';
    end if;

    update public.sales_base s
    set payment_method = v_final_method
    where s.organization_id = p_organization_id
      and s.id = p_sale_id;

    v_result := jsonb_set(v_result, '{payment_method}', to_jsonb(v_final_method), true);
  end if;

  return v_result;
end;
$$;

-- v3 is now the only authenticated POS finalization entrypoint. Nested security
-- definer calls remain available to the database owner but not direct app users.
revoke execute on function public.finalize_sale_with_tenders(
  uuid, text, text, text, numeric, jsonb, jsonb
) from authenticated;

revoke execute on function public.finalize_sale_with_private_tenders(
  uuid, text, text, text, numeric, jsonb, jsonb
) from authenticated;

revoke execute on function public.finalize_sale_with_private_tenders_v2(
  uuid, text, text, text, numeric, jsonb, jsonb
) from authenticated;

revoke all on function public.finalize_sale_with_private_tenders_v3(
  uuid, text, text, text, numeric, jsonb, jsonb
) from public, anon;
grant execute on function public.finalize_sale_with_private_tenders_v3(
  uuid, text, text, text, numeric, jsonb, jsonb
) to authenticated;

comment on function public.finalize_sale_with_private_tenders_v3(
  uuid, text, text, text, numeric, jsonb, jsonb
) is
  'Final POS facade. Banking-enabled orgs use the hidden routed account; orgs without Banking may record a customer bank-transfer tender without fabricating an internal bank account or ledger posting. This is the only authenticated tender finalization entrypoint.';
