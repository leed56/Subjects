# Phase 3 — purchasing and imports

Status: implementation started; phase remains incomplete.

## Delivered: receipt input integrity

Purchase orders now reject duplicate product identities, missing products, non-finite quantities/costs and negative costs before creating any document. Receipts reject duplicate requests, unknown products, malformed legacy order lines and missing catalogue products before changing stock. Invalid input leaves the original application snapshot intact.

Valid partial deliveries retain the existing behavior: receive only outstanding quantities, create matching stock movements, transition pending → partial → received, and ignore further receiving once complete. This is input validation, not delivery retry idempotency.

Verification: purchase-order.test.ts covers partial/final delivery quantities and movement totals, completed-order protection, duplicate requests and legacy duplicate lines, unknown identities, NaN, infinity and negative values.

## Prepared: atomic simple-stock receiving

Migration `20261016160646_purchase_order_receipt_authority.sql` adds an owner-only receiving RPC and immutable delivery audit. A receipt carries a UUID delivery key and database line IDs with expected received quantities. Order/product locks serialize overlapping receipts; an identical retry returns its original result, while changed key payloads, stale balances and over-receiving fail. Order progress, stock quantity, buy cost, main-location custody and movement audit commit in one transaction. Audit failure rolls everything back.

The RPC requires both purchasing and stock write access and enabled inventory-location authority. Tracked products are rejected until exact-identity receiving is connected. A separate purchasing gate defaults disabled, has no app write permission, and is never enabled by the migration. When enabled, legacy direct PO/line writes are blocked to preserve receipt state and stable line IDs.

The application now selects the atomic commands when the company purchasing gate is enabled. Missing-schema or disabled companies retain the legacy online path. Authenticated purchasing requires an online connection to verify authority; local demonstration mode remains available. No live migration, activation or production promotion was performed.

`verify-purchase-receipts.mjs` is invoked by the existing isolated inventory fixture, so CI runs both the PGlite transaction checks and PostgreSQL 17 race checks. Fixtures use the actual PO and receipt migrations with a synthetic source schema; they do not certify all historical migrations, production RLS or company data.

Local PostgreSQL 17.4 verification passed 95 checks: 62 existing inventory checks and 33 purchasing checks, including simultaneous stale receipts and simultaneous identical retries. The isolated PGlite run also verifies transaction behavior without a server. No remote database is used by these fixtures.

## Connected: application commands and recovery

Apply the prepared `20261016162304_purchase_order_application_authority.sql` after the receipt-authority migration during an authorized rollout. It supplies atomic creation, retry-safe cancellation and an owner-only order/product/audit snapshot. Creation resolves names on the server, validates tenant ownership and quantities, and retains stable line IDs on retries. Cancellation and receiving lock the same order. The reserved receipt stock-log namespace rejects client inserts, changes and pruning.

The Supplier page routes enabled companies through these commands without optimistic stock changes or full-snapshot retry scheduling. It preserves form input on failure, shows persistent inline errors and releases its immediate submission lock in `finally`. A pending-action recovery control remains available after reloading, including when the server has already completed the order. Existing PO screens have creation and cancellation; they do not offer arbitrary editing of received lines.

Requests are written to local storage before mutation and scoped by company and user. Browser Web Locks coordinate tabs. The original creation/delivery key and payload survive unknown transport outcomes and failed refreshes; another action or changed quantities are blocked until checked. The pending request is acknowledged only after the server snapshot has been saved locally. A definite SQL rejection releases the request but preserves form input. Clearing browser storage loses this recovery record, so production failure testing must include the supported browser/session behavior.

Background sync skips authoritative PO headers, line replacement and PO pruning. It preserves server receipt movement IDs and existing receipt buy costs while allowing the opening buy cost for a new catalogue product. Targeted legacy PO snapshot writes fail closed for enabled companies. Application responses are tagged and checked against the active company/user before merging; unrelated local rows are retained.

The connected checkpoint passed 113 native PostgreSQL checks: the preceding 95 plus 18 application-authority checks. These include concurrent creation retries, cancellation versus receipt, stable IDs, tenant access and immutable receipt logs. The PGlite equivalent passed 105 checks. Client regressions cover uncertain results, failed refresh/storage, authority lookup failures, changed pending requests, scoped recovery and background-sync isolation. Responsive Supplier fixtures verify retained receipt/order drafts and unlocked controls after rejected saves.

## Remaining

- Exact lot, variant and serial receiving, with authenticated integration verification.
- Supplier invoice screen/history/ledger and settlement integration. The receipt-linked invoice database authority is prepared separately, not activated: see `PHASE_3_RECEIPT_INVOICES.md`. It posts payable exactly once without receiving stock again; legacy payable writers must be adapted before its gate is enabled.
- Transactional shipment lifecycle, landed-cost allocation, recoverable VAT separation, FX settlement and residual rounding.
- Full authenticated browser → real historical schema → data failure/retry certification and controlled company rollout. Synthetic browser adapters and database fixtures do not replace this release step.

The existing imports screen remains a planning worksheet. No live migration or company activation is included in this checkpoint. Phase 2 migrations and controlled company enablement remain pending separately.
