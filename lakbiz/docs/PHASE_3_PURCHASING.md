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

## Connected invoice workspace and exact planning allocation

The owner workspace `/suppliers/invoices`, linked from Suppliers, now lists immutable deliveries and receipt-linked bills. Owners select complete deliveries from one order, enter actual LKR invoice rates and input VAT, and record through the prepared invoice RPC. Stock is never received by this screen. It requires an authenticated company and the existing invoice gate; missing-schema and disabled companies receive an explicit upgrade/rollout state.

The company/user-scoped command is persisted before submission and serialized across tabs. Unknown outcomes and failed history refreshes retain the same invoice UUID and payload. A separate pending-invoice action replays that command; changed submissions are blocked. Definite transaction rejection releases the command and preserves the visible draft. History must confirm the saved invoice before the recovery record is cleared. Company/role changes discard stale UI responses. This does not yet merge invoice balances into the legacy supplier ledger or make the legacy GRN/payment writers safe for activation.

The imports worksheet now calculates outstanding quantities and uses integer minor units with stable largest-remainder allocation. VAT remains outside inventory cost, invalid FX/precision is rejected, and every allocated cent is conserved without a negative final residual. This is still a planning calculation, not persisted shipment processing.

Verification for this application checkpoint: 428 tests across 59 files, TypeScript, changed-file lint, a 325-route production build, and nine isolated production browser fixtures covering Suppliers, delivery invoices and Imports at 390/768/1440 widths. New checks cover invoice replay after unknown outcomes and refresh failure, storage/user/company boundaries, definite rejection, draft retention, recovery controls, owner access, exact fractional rounding and stable allocation across 200 lines. The first unrestricted test run had one existing demo-render timeout during a concurrent build; the bounded-worker rerun passed all tests. Browser fixtures use isolated adapters, not live purchasing writes.

## Remaining

The subsequent cash-settlement checkpoint connects the Supplier Ledger to a paginated cloud statement and adds receipt-invoice LKR cash payments with retry-safe payable updates. Legacy GRN/payment and full snapshot writes fail closed under invoice authority. See `PHASE_3_CASH_SETTLEMENTS.md` for behavior, verification and activation restrictions. Bank/FX payments and metadata/full-snapshot adapters remain pending.

- Exact lot, variant and serial receiving, with authenticated integration verification.
- Bank/FX settlement and safe supplier metadata/full-snapshot adapters; invoice history, supplier statement and linked LKR cash settlements are connected. All purchasing authority remains prepared rather than activated: see `PHASE_3_RECEIPT_INVOICES.md` and `PHASE_3_CASH_SETTLEMENTS.md`.
- Transactional shipment lifecycle, landed-cost allocation, recoverable VAT separation, FX settlement and residual rounding.
- Full authenticated browser → real historical schema → data failure/retry certification and controlled company rollout. Synthetic browser adapters and database fixtures do not replace this release step.

The existing imports screen remains a planning worksheet. No live migration or company activation is included in this checkpoint. Phase 2 migrations and controlled company enablement remain pending separately.
