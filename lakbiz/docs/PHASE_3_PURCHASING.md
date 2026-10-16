# Phase 3 — purchasing and imports

Status: implementation started; phase remains incomplete.

## Delivered: receipt input integrity

Purchase orders now reject duplicate product identities, missing products, non-finite quantities/costs and negative costs before creating any document. Receipts reject duplicate requests, unknown products, malformed legacy order lines and missing catalogue products before changing stock. Invalid input leaves the original application snapshot intact.

Valid partial deliveries retain the existing behavior: receive only outstanding quantities, create matching stock movements, transition pending → partial → received, and ignore further receiving once complete. This is input validation, not delivery retry idempotency.

Verification: purchase-order.test.ts covers partial/final delivery quantities and movement totals, completed-order protection, duplicate requests and legacy duplicate lines, unknown identities, NaN, infinity and negative values.

## Prepared: atomic simple-stock receiving

Migration `20261016160646_purchase_order_receipt_authority.sql` adds an owner-only receiving RPC and immutable delivery audit. A receipt carries a UUID delivery key and database line IDs with expected received quantities. Order/product locks serialize overlapping receipts; an identical retry returns its original result, while changed key payloads, stale balances and over-receiving fail. Order progress, stock quantity, buy cost, main-location custody and movement audit commit in one transaction. Audit failure rolls everything back.

The RPC requires both purchasing and stock write access and enabled inventory-location authority. Tracked products are rejected until exact-identity receiving is connected. A separate purchasing gate defaults disabled, has no app write permission, and is never enabled by the migration. When enabled, legacy direct PO/line writes are blocked to preserve receipt state and stable line IDs.

The new RPC is not yet called by the application. Do not enable it before replacing legacy PO creation/edit/sync and receiving paths; the enabled guard deliberately rejects those writes. No live migration, activation or production promotion was performed.

`verify-purchase-receipts.mjs` is invoked by the existing isolated inventory fixture, so CI runs both the PGlite transaction checks and PostgreSQL 17 race checks. Fixtures use the actual PO and receipt migrations with a synthetic source schema; they do not certify all historical migrations, production RLS or company data.

Local PostgreSQL 17.4 verification passed 95 checks: 62 existing inventory checks and 33 purchasing checks, including simultaneous stale receipts and simultaneous identical retries. The isolated PGlite run also verifies transaction behavior without a server. No remote database is used by these fixtures.

## Remaining

- Connect PO creation/edit/sync and receiving to the prepared authority without optimistic multi-request partial persistence; retain delivery keys across uncertain network outcomes.
- Exact lot, variant and serial receiving, with authenticated integration verification.
- Supplier invoice linkage that avoids receiving the same goods again when recording the bill.
- Transactional shipment lifecycle, landed-cost allocation, recoverable VAT separation, FX settlement and residual rounding.
- Database, authenticated UI and failure/retry verification before controlled live rollout.

The existing imports screen remains a planning worksheet. No live migration or company activation is included in this checkpoint. Phase 2 migrations and controlled company enablement remain pending separately.
