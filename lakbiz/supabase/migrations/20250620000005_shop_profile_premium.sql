-- Premium shop profile fields for world-class invoices (cloud sync for /settings/shop)

alter table public.organizations
  add column if not exists name_si text,
  add column if not exists br_number text,
  add column if not exists email text,
  add column if not exists logo_url text,
  add column if not exists invoice_footer text;

comment on column public.organizations.name_si is 'Shop name in Sinhala (printed on invoice)';
comment on column public.organizations.br_number is 'Business Registration (BR) number';
comment on column public.organizations.email is 'Shop contact email';
comment on column public.organizations.logo_url is 'Shop logo as data URL (small, downscaled) for invoice header';
comment on column public.organizations.invoice_footer is 'Footer / terms note printed at bottom of invoice';
