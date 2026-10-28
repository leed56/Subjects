-- Read-only metadata check. Never invoke an import RPC just to discover it.
create or replace function public.grocery_catalogue_readiness(p_organization_id uuid)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.org_members m
    join public.organizations o on o.id = m.organization_id
    where m.organization_id = p_organization_id and m.user_id = auth.uid()
      and m.role = 'owner' and o.sector = 'grocery'
  ) then
    raise exception 'Grocery owner access required' using errcode = '42501';
  end if;
  return pg_catalog.jsonb_build_object(
    'mill', pg_catalog.to_regprocedure('public.import_grocery_mill_catalogue(uuid)') is not null,
    'meat', pg_catalog.to_regprocedure('public.import_grocery_meat_catalogue(uuid)') is not null
  );
end;
$$;
revoke all on function public.grocery_catalogue_readiness(uuid) from public, anon;
grant execute on function public.grocery_catalogue_readiness(uuid) to authenticated;
notify pgrst, 'reload schema';
