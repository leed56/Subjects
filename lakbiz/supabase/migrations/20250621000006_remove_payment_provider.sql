-- Remove unused payment gateway columns from subscriptions.
-- LakBiz uses manual plan management via platform admin — no PayHere/Stripe integration.

alter table public.subscriptions
  drop column if exists payment_provider,
  drop column if exists external_customer_id;

comment on table public.subscriptions is
  'Org subscription state. Plans are assigned manually by LakBiz platform admin — no in-app checkout.';
