-- VAT shop settings on organizations (cloud sync for /settings/shop)

alter table public.organizations
  add column if not exists vat_registered boolean not null default false,
  add column if not exists vat_number text,
  add column if not exists quarter_start_month smallint not null default 4
    check (quarter_start_month between 1 and 12);

comment on column public.organizations.vat_registered is 'Shop is VAT-registered; enables VAT meter in app';
comment on column public.organizations.vat_number is 'IRD VAT registration number';
comment on column public.organizations.quarter_start_month is 'Fiscal year start month (4 = April)';
