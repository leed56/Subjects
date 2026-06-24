-- Cloud sync writes via masked views (triggers → *_base). Re-assert write grants after RLS hardening.

grant insert, update, delete on public.products_base to authenticated;
grant insert, update, delete on public.sales_base to authenticated;
grant insert, update, delete on public.sale_lines_base to authenticated;
