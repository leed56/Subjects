# LakBiz Advanced Inventory Architecture

## Why this exists

LakBiz now provisions industry-specific shops. Product custom fields alone are not enough for three high-value verticals:

- **Pharmacy:** one medicine can have many batches with different expiry dates and costs.
- **Mobile / electronics:** one model can represent many physical devices, each with its own IMEI/serial/warranty state.
- **Footwear / fashion:** one style is really a matrix of size/colour variants, each with separate stock.

Flattening those concepts into `products.custom_fields` creates false stock numbers and weak auditability. The advanced inventory layer adds the missing identities without breaking existing routes or historical stock data.

## Existing stock remains safe

`Product.stockQty`, stock logs, sales and the local-first store remain unchanged until a product is explicitly integrated with advanced allocation. The new schema is additive and starts with a per-product `product_inventory_profiles` row.

Tracking modes:

- `simple` — existing quantity model.
- `lot` — batch/expiry inventory.
- `serial` — one physical serialized unit per row.
- `variant` — size/colour/etc. stock combinations.
- `variant_serial` — variants plus serial/IMEI identity.
- `variant_lot` — variants plus batch/expiry identity.

## Sector defaults

| Sector | Default | Why |
|---|---|---|
| Grocery | simple | Most products are quantity stock; expiry lots can be enabled selectively. |
| Pharmacy | lot + FEFO | Batch identity and expiry selection are core requirements. |
| Electronics | serial | Warranty/serial identity for higher-value devices. |
| Mobile shop | variant + serial | Model/storage/colour plus IMEI/serial per physical phone. |
| Electricals | simple | Quantity/length stock; variants can be enabled where needed. |
| Spare parts | simple | Part/OEM/fitment identity usually drives lookup. |
| Footwear | variant | Size and colour must have separate availability. |
| HVAC | simple | Parts remain simple; complete units can opt into serial tracking and then Assets. |
| Car sales | simple | Chassis/engine identity already lives in the dedicated Vehicles module. |

New products automatically receive the correct profile from the shop's provisioned sector. Existing products are backfilled with profiles without changing quantities.

## Tables

### `product_inventory_profiles`
Defines the product's tracking strategy, variant axes, FEFO and serial requirements.

### `product_variants`
Stock combinations such as `Bata School Shoe / Black / EU 42` or `iPhone 15 Pro / 256GB / Natural Titanium`.

### `inventory_lots`
Operational batch data: batch number, expiry, quantity, supplier and status.

### `inventory_lot_costs`
Owner-only cost relation. Cost is physically separated rather than merely hidden in the UI.

### `inventory_units`
One physical IMEI/serial/barcode identity per row with lifecycle status.

### `inventory_unit_costs`
Owner-only per-unit cost relation.

### `inventory_allocations`
Audit link between a sale/job/return/adjustment and the exact variant/lot/unit that fulfilled it.

## Financial privacy

Managers, data-entry users, cashiers and technicians must never see internal cost/profit. Operational inventory identity remains available according to normal Stock permissions, while `inventory_lot_costs` and `inventory_unit_costs` are owner-only through RLS using `can_see_org_financials()`.

This is intentionally stronger than client-side hiding.

## Next integration phases

1. **Stock UI** — advanced inventory drawer for variants, lots and serialized units.
2. **Receiving** — GRN/purchase flow captures batch/expiry/IMEI/variant details at intake.
3. **POS allocation** — sale cart requires size/colour or IMEI selection where applicable; pharmacy auto-allocates FEFO lots.
4. **Job allocation** — job materials can consume exact serial/lot/variant records when relevant.
5. **Returns/exchanges** — restore the exact variant/unit/lot and preserve audit history.
6. **Vertical dashboards** — pharmacy expiry risk, phone warranty/IMEI status, footwear size gaps and variant sell-through.

Do not mark advanced inventory as fully live until phases 1–4 are wired. The schema foundation alone intentionally does not double-write existing stock quantities.
