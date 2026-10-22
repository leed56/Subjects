# LakBiz Sri Lanka Demo Catalogs

## Scope

This subsystem builds two demonstration datasets without creating a second product master:

- **LakBiz Pharmacy Demo** (`sector=pharmacy`)
- **LakBiz Grocery Demo** (`sector=grocery`)

Product rows continue to live in `products_base`. Source/regulatory/taxonomy provenance is stored in the existing `custom_fields` JSON. Pharmacy batch/expiry identities continue to use `product_inventory_profiles` and `inventory_lots`.

Three concepts must remain separate:

1. **Sector/category blueprint** — reusable onboarding/category structure for all businesses in that sector.
2. **Demo catalog** — sourced factual product master data plus clearly synthetic demo stock/history.
3. **Customer live inventory** — a real customer's own catalog, costs, stock, suppliers and transactions.

A real newly provisioned pharmacy or grocery must never inherit the demo stock, demo prices, demo customers or demo transaction history automatically.

## Public sources

The acquisition script retains factual catalog fields only; it does not download product images or copy long marketing descriptions.

### State Pharmaceuticals Corporation (SPC)

Source: `https://www.spc.lk/products.php`

Captured where present:

- item code
- product description/name
- unit/pack
- supplier code
- public wholesale price
- public retail price

SPC wholesale is the only source-derived buy cost used by the demo importer. Retail-only products receive a deterministic **synthetic demo cost**, tagged `costSource=synthetic_demo` and `costIsSynthetic=true`.

### MediVerify / NMRA

Source: `https://mediverify.lk/` and Sri Lanka NMRA public notices/data.

Regulatory fields are attached only when the acquisition script gets one unique **exact brand match** from MediVerify. Similar names are not enough. If exact verification is unavailable, registration/schedule fields stay null.

Important limitation: NMRA has publicly disclosed a technical/update limitation affecting the medicine-registration database. The demo therefore must never be described as a complete/current 2026 Sri Lankan national medicines register. Provenance includes `regulatorySourceStatus` for enriched records.

The importer never infers dosage advice, medical indication, contraindications, interactions, diagnosis or treatment.

### Healthguard Sri Lanka

Public category pages are used as an assortment reference for non-SPC pharmacy retail such as:

- medical devices
- wellness/supplements
- skin/hair/personal care
- mother & baby
- household health convenience
- food/beverage convenience

Only factual product name, public URL, public identifier/handle when available, pack text derivable from the title, and public price are retained.

### SPAR2U Sri Lanka

Public collection pages provide broad Sri Lankan supermarket assortment coverage. Only factual product name, public URL/handle, pack text derivable from the title and public retail price are retained. LakBiz Department/Category/Subcategory values are normalization metadata, marked by `taxonomyMethod` rather than represented as retailer/regulator facts.

Glomark can be added as another public adapter later. The importer is source-agnostic as long as normalized records follow catalog schema version 1.

## Acquisition

From `lakbiz/app`:

```bash
node scripts/fetch-sri-lanka-demo-catalog.mjs \
  --out=/tmp/lakbiz-sri-lanka-demo-catalog.json \
  --max-grocery=1600 \
  --max-pharmacy-retail=900
```

Optional conservative regulatory enrichment:

```bash
node scripts/fetch-sri-lanka-demo-catalog.mjs \
  --verify-regulatory \
  --out=/tmp/lakbiz-sri-lanka-demo-catalog.json
```

The crawler:

- uses public pages only
- checks `robots.txt`
- does not authenticate
- does not bypass CAPTCHAs or access controls
- rate-limits requests
- honors HTTP 429 retry guidance
- keeps no images or long descriptions

If a source is blocked/unavailable, it is skipped rather than fabricated.

## Import safety

Dry-run is the default:

```bash
node scripts/import-demo-businesses.mjs \
  --catalog=/tmp/lakbiz-sri-lanka-demo-catalog.json
```

Live import requires **server-side** credentials and an explicit `--apply`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://zestppstpwjxriwcuykc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
DEMO_PHARMACY_EMAIL=... \
DEMO_PHARMACY_PASSWORD=... \
DEMO_GROCERY_EMAIL=... \
DEMO_GROCERY_PASSWORD=... \
node scripts/import-demo-businesses.mjs \
  --apply \
  --catalog=/tmp/lakbiz-sri-lanka-demo-catalog.json
```

Passwords/service-role keys must never be committed.

The importer hard-fails unless the Supabase hostname is exactly:

`zestppstpwjxriwcuykc.supabase.co`

Shop creation uses the same production contract as LakBiz Admin provisioning:

1. Auth Admin `createUser()`
2. service-role-only `provision_shop()` RPC
3. orphan Auth user deletion if provisioning fails

It refuses to reuse a platform-admin identity as a shop owner.

## Demo stock semantics

Product master facts remain source-derived. The following are intentionally synthetic and explicitly labeled:

- stock quantities
- reorder examples
- batch numbers
- manufactured/received dates
- expiry dates
- demo customers
- demo suppliers where named as synthetic
- purchases/sales/payment history
- retail-only buy costs
- demo bank account/cheque values

Medicine and wellness products use lot tracking with FEFO. The seed includes deterministic expired and near-expiry examples. Expired stock remains physically represented but cannot be allocated as an available lot.

## Financial privacy

The importer writes normal LakBiz financial columns; it does not create a demo-only visibility path. Existing owner-only RLS/masked-view/server rules remain authoritative. Nonowners must continue to receive zero/masked buy cost and profit and no owner-only ledgers.

## Idempotency

Catalog products, lots, customers, suppliers and demo history use deterministic identifiers. Re-running the importer updates the same demo records rather than multiplying them. The importer only targets organizations named exactly `LakBiz Pharmacy Demo` / `LakBiz Grocery Demo`, and refuses an existing same-name organization with the wrong sector or missing owner.

## Required release verification

Before calling the demo complete:

- run acquisition and record actual source counts/retrieval time
- run dry-run importer
- create both login-capable demo owners through Auth Admin
- import into the verified `nexus-erp` project
- open both accounts in LakBiz
- verify pharmacy FEFO/expiry and modern nonmedicine assortment
- verify grocery category breadth and search
- verify owner sees financials and cashier/data-entry do not
- run lint, typecheck, unit tests and production build
- report actual SKU/category/source counts and limitations

Do not cut over `/sales` to the v3 finalizer as part of this demo-data task, and do not merge PR #79 before PR #78.
