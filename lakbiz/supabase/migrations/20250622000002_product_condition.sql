-- Phase A: New vs Used stock lanes (one SKU + qty per product row).

alter table public.products
  add column if not exists condition text not null default 'new';

alter table public.products
  drop constraint if exists products_condition_check;

alter table public.products
  add constraint products_condition_check
  check (condition in ('new', 'used'));

comment on column public.products.condition is
  'Inventory lane: new or used. Same SKU model — quantity on stock_qty.';
