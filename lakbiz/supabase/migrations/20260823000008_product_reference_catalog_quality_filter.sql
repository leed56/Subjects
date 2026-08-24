-- Keep the global type-ahead catalogue limited to usable product identities.
-- Some public listing fallbacks can expose a pack-size fragment (for example
-- "100G" or "60 S") as the listing title. Those rows are not useful product
-- identities and should never be offered to a client as an Add Item match.
--
-- This changes only global reference-catalogue visibility. It does not alter
-- tenant inventory, stock, prices, costs, sales, purchases or customer data.

update public.product_reference_catalog
set
  active = false,
  updated_at = now()
where active = true
  and source = 'healthguard'
  and btrim(name) ~* '^[0-9]+([.][0-9]+)?[[:space:]]*(mg|g|kg|ml|l|s|pcs?|caps?|tabs?|tablets?|pack|packs?)?$';

comment on table public.product_reference_catalog is
  'Global non-financial product identity/reference catalogue for client type-ahead item creation. Pack-only listing fragments are inactive; no tenant stock, prices, costs or transaction data are stored here.';
