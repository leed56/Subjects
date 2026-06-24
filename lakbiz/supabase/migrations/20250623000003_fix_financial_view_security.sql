-- C1: Financial masking views must run as the querying user so base-table RLS applies.
-- Also block direct SELECT on *_base (bypasses buy_price/profit masking).

alter view public.products set (security_invoker = true);
alter view public.sales set (security_invoker = true);
alter view public.sale_lines set (security_invoker = true);

revoke all on public.products_base from authenticated, anon;
revoke all on public.sales_base from authenticated, anon;
revoke all on public.sale_lines_base from authenticated, anon;

grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.sales to authenticated;
grant select, insert, update, delete on public.sale_lines to authenticated;

grant insert, update, delete on public.products_base to authenticated;
grant insert, update, delete on public.sales_base to authenticated;
grant insert, update, delete on public.sale_lines_base to authenticated;

comment on view public.products is
  'Masked products read; writes should target products_base for upsert compatibility.';
