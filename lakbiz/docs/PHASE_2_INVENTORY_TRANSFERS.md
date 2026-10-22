# Phase 2 — general inventory authority

Status: implementation prepared on the enhancement branch. The four inventory migrations have not been applied to the live database. Per-company opening-count certification and activation remain release requirements.

## Delivered behavior

- Organization-scoped main/branch/warehouse locations and physical balances for simple, variant and lot stock.
- Exact serialized custody preserves existing unit/IMEI identities. Specialist Textile roll and vehicle workflows remain separate.
- Atomic draft → dispatched → in_transit → received transfers, with cancellation before dispatch, protected identities, source availability checks and repeat-receipt rejection.
- Reservations and retry-safe release. Main-location stock writers cannot consume held quantity; reserved/in-transit units cannot be sold or moved. Quarantined or expired lots cannot be reserved.
- Existing product, variant and lot quantity writers mirror their deltas to the main location when authority is enabled. Exact serialized sales retain their identity location. Branch stock must be transferred back before a generic main-location sale or adjustment consumes it.
- Targeted legacy stock actions use durable compare-and-swap commands. A stale quantity is rejected; direct stock-action quantity and audit-log writes commit together. Metadata sync never resends stock quantities for existing products.
- Stale whole-business/bulk product snapshots and metadata-only quantity edits fail with corrective feedback instead of replacing newer cloud stock. Offline conflicts require review; there is no silent stock overwrite.
- Read-only reconciliation compares source quantities against all locations plus in-transit quantity at exact-identity and product-total levels. Dispatch refuses inconsistent products.
- Owner-only opening preparation adds missing main-location custody before activation. Existing balances and serial locations are preserved. Owner repairs require a reason and the expected current quantity; all repairs/opening preparations are audited.
- Production workspace at /stock/transfers, linked from Stock, covers locations, exact-identity drafts, dispatch/transit/receipt, holds, opening review and reconciliation. Failed actions retain inputs; loading failures block stale actions. Upgrade-required, role-restricted and read-only states are explicit.

## Stock-writer integration

| Existing writer | Location behavior when enabled |
| --- | --- |
| business-sync.ts targeted stock operations | Replay-safe compare-and-swap command; stock and movement audit are atomic. |
| Product/background/bulk snapshots | Existing-product quantity is excluded; stale counts return an explicit conflict. |
| Atomic POS product/variant/lot updates | Database adapters update main-location physical balances in the source transaction and enforce holds. |
| Identity registration and receipts | Default identity location is assigned; variant/lot source increases replenish main custody. |
| Returns, hold resolutions and lot disposition | Existing source deltas use the same physical-balance guard. Branch or reserved stock cannot be silently consumed. |
| Serial sale, reservation and transfer | Exact unit row remains authoritative; transit/reservation guards protect its custody. |

Generic aggregate decrements for tracked products are rejected by stock commands: use the exact variant/lot/serial workflow. Template conversion with existing stock and specialist roll custody require a reviewed migration rather than a product metadata edit.

## Migration and rollout order

1. 20261016095255_inventory_locations_and_transfers.sql
2. 20261016104228_inventory_transfer_atomic_authority.sql
3. 20261016105104_inventory_location_reconciliation.sql
4. 20261016105637_inventory_location_operations.sql

Installation and activation are separate. Installing these files leaves movement authority disabled. No app role can update inventory_transfer_settings and no activation RPC is exposed.

Before a company is enabled, use a staging copy to check migration compatibility, review Supabase advisors and role policies, preserve a restore point, certify actual opening quantities and identity coverage, prepare missing main custody with an owner reason, and resolve every reconciliation difference. Specialist Textile custody must not be enabled through this generic adapter without its own certification.

Only after that review and explicit release authorization should a controlled per-company enablement be performed. Keep the app and migrations compatible and verify the real receiving/sale/return flows for the selected company. Production promotion and live financial or stock test writes were not performed in this implementation task.

## Repeatable verification

scripts/verify-inventory-transfers.mjs runs the actual four prepared migrations against a synthetic source schema. It checks transfers, exact identities, reservations, audited repair/opening preparation, permissions, tenant isolation, stale-command rejection, replay and transaction rollback.

The default isolated runtime is @electric-sql/pglite@0.3.14. Set INVENTORY_TEST_MODULE to its entry point (a file URL on Windows). Real concurrency checks use pg@8.16.3 with INVENTORY_TEST_URL: the script refuses non-loopback hosts and any database name other than lakbiz_inventory_test.

Real PostgreSQL races cover simultaneous reservations, sale-versus-transfer, duplicate receipts and two stale device commands. Verify CI runs both the isolated suite and a disposable PostgreSQL 17 service. These synthetic fixtures certify the prepared authority boundaries, not the correctness of an existing company's historical data or the complete production authenticated matrix.

inventory-snapshot.test.ts covers source command payloads, disabled-organization compatibility, network failures, stale full/bulk snapshots, metadata-only quantity rejection and quantity-safe metadata updates. qa-phase1-workflows.mjs includes the transfer workspace at 390px, 768px and 1440px with rejected saves, draft preservation, load recovery and role restriction checks.

## Release boundary and later phases

Phase 2 code is prepared for review. Live migration, company data certification/enablement and production promotion remain pending. General purchasing/shipment persistence belongs to Phase 3; complete financial posting belongs to Phase 4; subscription/offline certification and the full authenticated failure matrix remain in their existing phases. These transfers do not claim to complete those engines.