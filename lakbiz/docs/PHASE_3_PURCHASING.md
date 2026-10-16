# Phase 3 — purchasing and imports

Status: implementation started; phase remains incomplete.

## Delivered: receipt input integrity

Purchase orders now reject duplicate product identities, missing products, non-finite quantities/costs and negative costs before creating any document. Receipts reject duplicate requests, unknown products, malformed legacy order lines and missing catalogue products before changing stock. Invalid input leaves the original application snapshot intact.

Valid partial deliveries retain the existing behavior: receive only outstanding quantities, create matching stock movements, transition pending → partial → received, and ignore further receiving once complete. This is input validation, not delivery retry idempotency.

Verification: purchase-order.test.ts covers partial/final delivery quantities and movement totals, completed-order protection, duplicate requests and legacy duplicate lines, unknown identities, NaN, infinity and negative values.

## Remaining

- Atomic server receipt authority with stable line identities, delivery idempotency keys and concurrent partial-receipt protection.
- Connect receiving to that authority without optimistic multi-request partial persistence.
- Supplier invoice linkage that avoids receiving the same goods again when recording the bill.
- Transactional shipment lifecycle, landed-cost allocation, recoverable VAT separation, FX settlement and residual rounding.
- Database, authenticated UI and failure/retry verification before controlled live rollout.

The existing imports screen remains a planning worksheet. No live migration or company activation is included in this checkpoint. Phase 2 migrations and controlled company enablement remain pending separately.
