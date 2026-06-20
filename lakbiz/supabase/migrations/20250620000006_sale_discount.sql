-- Bill-level discount on sales (Phase B premium POS)

alter table public.sales
  add column if not exists discount numeric(14, 2) not null default 0;

comment on column public.sales.discount is 'Bill-level discount in LKR applied to the inclusive total';
