-- Ensure Business/Pro plans expose bulk_messaging for org_has_module (Auto SMS gate).

update public.plans
set features = features || '{"bulk_messaging":false}'::jsonb
where id = 'starter';

update public.plans
set features = features || '{"bulk_messaging":true}'::jsonb
where id in ('business', 'pro');
