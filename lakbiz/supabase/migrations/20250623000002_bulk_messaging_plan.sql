-- Gate bulk messaging and API SMS to Business+ plans.

update public.plans
set features = features || '{"bulk_messaging":false}'::jsonb
where id = 'starter';

update public.plans
set features = features || '{"bulk_messaging":true}'::jsonb
where id in ('business', 'pro');
