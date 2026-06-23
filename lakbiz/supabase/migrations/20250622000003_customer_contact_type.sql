-- Phase B: individual vs company contacts on the same customer credit ledger.

alter table public.customers
  add column if not exists contact_type text not null default 'individual';

alter table public.customers
  drop constraint if exists customers_contact_type_check;

alter table public.customers
  add constraint customers_contact_type_check
  check (contact_type in ('individual', 'company'));

alter table public.customers
  add column if not exists contact_person text,
  add column if not exists vat_number text;

comment on column public.customers.contact_type is
  'individual = walk-in/person; company = B2B account (same credit ledger).';
comment on column public.customers.contact_person is 'Primary contact for company accounts';
comment on column public.customers.vat_number is 'Company VAT/TIN for B2B invoicing';
