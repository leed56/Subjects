-- LakBiz post-cutover performance hardening for the new inventory / return /
-- tender domain.
--
-- Most operational query indexes intentionally lead with organization_id for
-- tenant-scoped reads. PostgreSQL foreign-key maintenance needs the referenced
-- child key itself to be indexed as a leading column, especially when a parent
-- row is updated/deleted. Add only the missing FK-leading indexes for the new
-- August domain; no existing index is removed or rewritten.

create index if not exists inventory_allocations_product_fk_idx
  on public.inventory_allocations(product_id);
create index if not exists inventory_allocations_variant_fk_idx
  on public.inventory_allocations(variant_id) where variant_id is not null;
create index if not exists inventory_allocations_lot_fk_idx
  on public.inventory_allocations(lot_id) where lot_id is not null;
create index if not exists inventory_allocations_unit_fk_idx
  on public.inventory_allocations(unit_id) where unit_id is not null;

create index if not exists inventory_lots_product_fk_idx
  on public.inventory_lots(product_id);
create index if not exists inventory_lots_variant_fk_idx
  on public.inventory_lots(variant_id) where variant_id is not null;
create index if not exists inventory_lots_supplier_fk_idx
  on public.inventory_lots(supplier_id) where supplier_id is not null;

create index if not exists inventory_units_product_fk_idx
  on public.inventory_units(product_id);
create index if not exists inventory_units_variant_fk_idx
  on public.inventory_units(variant_id) where variant_id is not null;
create index if not exists inventory_units_lot_fk_idx
  on public.inventory_units(lot_id) where lot_id is not null;
create index if not exists inventory_units_customer_fk_idx
  on public.inventory_units(customer_id) where customer_id is not null;

create index if not exists product_variants_product_fk_idx
  on public.product_variants(product_id);

create index if not exists inventory_return_holds_return_line_fk_idx
  on public.inventory_return_holds(return_line_id);
create index if not exists inventory_return_holds_product_fk_idx
  on public.inventory_return_holds(product_id);
create index if not exists inventory_return_holds_variant_fk_idx
  on public.inventory_return_holds(variant_id) where variant_id is not null;
create index if not exists inventory_return_holds_lot_fk_idx
  on public.inventory_return_holds(lot_id) where lot_id is not null;
create index if not exists inventory_return_holds_unit_fk_idx
  on public.inventory_return_holds(unit_id) where unit_id is not null;

create index if not exists sale_returns_sale_fk_idx
  on public.sale_returns(sale_id);

create index if not exists sale_return_lines_return_fk_idx
  on public.sale_return_lines(return_id);
create index if not exists sale_return_lines_sale_fk_idx
  on public.sale_return_lines(sale_id);
create index if not exists sale_return_lines_product_fk_idx
  on public.sale_return_lines(product_id);

create index if not exists sale_credit_notes_sale_fk_idx
  on public.sale_credit_notes(sale_id);

create index if not exists sale_return_settlements_return_fk_idx
  on public.sale_return_settlements(return_id);
create index if not exists sale_return_settlements_bank_fk_idx
  on public.sale_return_settlements(bank_account_id) where bank_account_id is not null;
create index if not exists sale_return_settlements_replacement_sale_fk_idx
  on public.sale_return_settlements(replacement_sale_id) where replacement_sale_id is not null;

create index if not exists sale_tenders_sale_fk_idx
  on public.sale_tenders(sale_id);

create index if not exists sale_tender_sources_bank_fk_idx
  on public.sale_tender_sources(bank_account_id) where bank_account_id is not null;
create index if not exists sale_tender_sources_cheque_fk_idx
  on public.sale_tender_sources(cheque_id) where cheque_id is not null;
create index if not exists sale_tender_sources_return_fk_idx
  on public.sale_tender_sources(return_id) where return_id is not null;

create index if not exists pos_payment_routes_bank_fk_idx
  on public.pos_payment_routes(bank_account_id);
