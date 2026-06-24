-- Fix cloud sync 403: security_invoker views require SELECT on *_base, which is revoked
-- for authenticated (to block direct reads of unmasked buy_price/profit).
-- security_barrier keeps org-scoped RLS on reads; view owner reads base for column masking.

alter view public.products set (security_invoker = false);
alter view public.sales set (security_invoker = false);
alter view public.sale_lines set (security_invoker = false);

comment on view public.products is
  'Masked products read (security_barrier); writes via INSTEAD OF triggers. Not security_invoker — authenticated has no SELECT on products_base.';
comment on view public.sales is
  'Masked sales read (security_barrier); writes via INSTEAD OF triggers. Not security_invoker — authenticated has no SELECT on sales_base.';
comment on view public.sale_lines is
  'Masked sale_lines read (security_barrier); writes via INSTEAD OF triggers. Not security_invoker — authenticated has no SELECT on sale_lines_base.';
