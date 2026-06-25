-- Owner-configurable company income tax rate for LakBiz profit estimate (not VAT).
alter table public.organizations
  add column if not exists company_income_tax_rate numeric(5, 2) not null default 30
    check (company_income_tax_rate >= 0 and company_income_tax_rate <= 100);

comment on column public.organizations.company_income_tax_rate is
  'Company income tax rate % for owner dashboard estimate (default 30; 15 export, 45 special sectors)';
