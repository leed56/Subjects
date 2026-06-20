-- LakBiz: single-source-of-truth shop provisioning.
--
-- Before: a subscription was written TWICE for every new shop — once by the
-- on_organization_created trigger (hardcoded business/trialing/14d) and again by
-- the app's UPDATE/UPSERT. Self-signup and admin provisioning were two separate
-- code paths that both leaned on that trigger.
--
-- After: exactly one function (provision_shop) atomically creates the
-- organization + owner membership + subscription. No trigger, no double-write,
-- no path can create an org without a matching subscription.

-- 1. Remove the hidden trigger-based subscription write.
drop trigger if exists on_organization_created on public.organizations;
drop function if exists public.create_org_subscription();

-- 2. Atomic provisioning core (organization + owner + subscription in one tx).
--    SECURITY DEFINER + service_role only — never called directly by shop users.
create or replace function public.provision_shop(
  p_owner_id uuid,
  p_name text,
  p_phone text,
  p_sector text,
  p_plan_id text,
  p_status public.subscription_status,
  p_trial_ends_at timestamptz,
  p_period_end timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if p_owner_id is null then
    raise exception 'provision_shop: owner id is required';
  end if;

  insert into public.organizations (name, phone, sector)
  values (
    coalesce(nullif(trim(p_name), ''), 'My Shop'),
    nullif(trim(p_phone), ''),
    coalesce(nullif(trim(p_sector), ''), 'grocery')
  )
  returning id into v_org_id;

  insert into public.org_members (organization_id, user_id, role)
  values (v_org_id, p_owner_id, 'owner');

  insert into public.subscriptions (
    organization_id, plan_id, status,
    trial_ends_at, current_period_start, current_period_end
  )
  values (
    v_org_id,
    coalesce(p_plan_id, 'business'),
    coalesce(p_status, 'trialing'),
    p_trial_ends_at,
    now(),
    p_period_end
  );

  return v_org_id;
end;
$$;

revoke all on function public.provision_shop(uuid, text, text, text, text, public.subscription_status, timestamptz, timestamptz) from public;
revoke all on function public.provision_shop(uuid, text, text, text, text, public.subscription_status, timestamptz, timestamptz) from anon;
revoke all on function public.provision_shop(uuid, text, text, text, text, public.subscription_status, timestamptz, timestamptz) from authenticated;
grant execute on function public.provision_shop(uuid, text, text, text, text, public.subscription_status, timestamptz, timestamptz) to service_role;

-- 3. Self-signup wrapper: owner is always the caller, plan is always a safe
--    14-day Business trial. Routes through the same core — no separate logic.
create or replace function public.bootstrap_user_organization(
  p_name text,
  p_phone text default null,
  p_sector text default 'grocery'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select organization_id
  into v_org_id
  from public.org_members
  where user_id = v_uid
  limit 1;

  if v_org_id is not null then
    return v_org_id;
  end if;

  return public.provision_shop(
    v_uid,
    p_name,
    p_phone,
    p_sector,
    'business',
    'trialing'::public.subscription_status,
    now() + interval '14 days',
    now() + interval '14 days'
  );
end;
$$;

revoke all on function public.bootstrap_user_organization(text, text, text) from public;
revoke all on function public.bootstrap_user_organization(text, text, text) from anon;
grant execute on function public.bootstrap_user_organization(text, text, text) to authenticated;

comment on function public.provision_shop(uuid, text, text, text, text, public.subscription_status, timestamptz, timestamptz)
  is 'Single source of truth for shop creation: atomic organization + owner membership + subscription. Service role only.';
comment on function public.bootstrap_user_organization(text, text, text)
  is 'Self-signup entry point: provisions caller''s shop with a 14-day Business trial via provision_shop.';
