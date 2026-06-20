-- Phase C: customer credit limit + supplier VAT/contact

alter table public.customers
  add column if not exists credit_limit numeric(14, 2);

alter table public.suppliers
  add column if not exists vat_number text,
  add column if not exists contact_person text;

comment on column public.customers.credit_limit is 'Max outstanding credit allowed (LKR); null = no limit';
comment on column public.suppliers.vat_number is 'Supplier VAT/BR number (for input VAT claims)';
comment on column public.suppliers.contact_person is 'Supplier contact person name';
