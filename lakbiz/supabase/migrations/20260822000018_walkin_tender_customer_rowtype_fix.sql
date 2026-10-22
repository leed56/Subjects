-- Fix walk-in atomic sale finalization after the real PostgreSQL behavior test.
--
-- finalize_sale_with_tenders() originally declared v_customer as an untyped
-- RECORD. For a walk-in sale p_customer_id is null, so no row is assigned to
-- that record. PostgreSQL must still resolve v_customer.name while planning the
-- INSERT expression and raises SQLSTATE 55000 before the CASE branch can avoid
-- it. A typed row variable has a known tuple shape even when no customer row is
-- loaded, so walk-in cash/card/bank/cheque sales remain valid while registered
-- customer credit behavior is unchanged.
--
-- This is intentionally append-only rather than editing migration 00014 after
-- it has already been deployed.

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.finalize_sale_with_tenders(uuid,text,text,text,numeric,jsonb,jsonb)'::regprocedure
  ) into v_definition;

  if position('v_customer public.customers%rowtype;' in v_definition) > 0 then
    return;
  end if;

  if position('v_customer record;' in v_definition) = 0 then
    raise exception 'finalize_sale_with_tenders declaration no longer matches the expected 00014 definition';
  end if;

  v_definition := replace(
    v_definition,
    'v_customer record;',
    'v_customer public.customers%rowtype;'
  );

  execute v_definition;
end $$;

-- Preserve the final facade boundary established by migration 00017.
revoke execute on function public.finalize_sale_with_tenders(
  uuid, text, text, text, numeric, jsonb, jsonb
) from authenticated;
