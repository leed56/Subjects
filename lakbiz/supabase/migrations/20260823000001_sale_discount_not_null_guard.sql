-- LakBiz atomic sale hardening: preserve the sales_base.discount NOT NULL invariant.
--
-- The mixed-tender finalizer introduced in 20260822000014 writes NULL when the
-- effective discount is zero. The live schema intentionally keeps
-- sales_base.discount NOT NULL DEFAULT 0, so ordinary no-discount sales would
-- fail at insert time. Normalize NULL to zero at the table boundary so both the
-- atomic tender path and any other trusted writer respect the existing schema
-- contract without weakening the column constraint.

create or replace function public.normalize_sales_discount_not_null()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.discount := coalesce(new.discount, 0);
  return new;
end;
$$;

revoke all on function public.normalize_sales_discount_not_null() from public, anon;

drop trigger if exists sales_discount_not_null_guard on public.sales_base;
create trigger sales_discount_not_null_guard
before insert or update of discount on public.sales_base
for each row execute function public.normalize_sales_discount_not_null();

comment on function public.normalize_sales_discount_not_null() is
  'Normalizes NULL sale discounts to zero so sales_base.discount remains NOT NULL across legacy and atomic tender writers.';
