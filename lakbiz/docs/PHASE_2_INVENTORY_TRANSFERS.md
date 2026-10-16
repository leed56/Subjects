# Phase 2 inventory transfer checkpoint

General inventory transfers now have a prepared database implementation for
draft creation, dispatch, transit confirmation, receipt and cancellation.
These migrations have not been applied to the live database.

## Behavior

- Simple stock, pure variants and lots use physical balances per location.
  Dispatch removes unreserved source quantity; receipt adds destination quantity.
  A partial lot retains its original lot identity in both locations.
- Serialized units retain their original serial/IMEI row. Dispatch marks custody
  in transit; receipt assigns the destination location. Existing sale writers
  cannot sell an in-transit unit.
- Internal transfers preserve aggregate product, variant and lot quantities.
- Transfer and balance writes go through authorized database functions. App
  roles cannot directly forge statuses, movement counts or physical balances.
- Database transactions lock transfers and source stock. A failed line rolls
  back the entire operation. Repeated dispatch or receipt fails without adding
  stock twice. Draft creation rejects duplicate identities and invalid quantities.
- Only organization stock operators (owner, manager, data entry) may operate
  transfers. Read access follows organization membership. Anonymous access is
  denied. Textile specialist custody remains separate.

## Activation boundary

Dispatch is disabled by default. `inventory_transfer_settings` has no app-role
write grant or activation RPC. Sales, returns, purchases, adjustments and new
identity registration must first maintain location balances consistently.
Opening balances are migration snapshots, not ongoing reconciliation.
An organization must not be enabled until those integrations and concurrent
sale/transfer behavior have been certified. The isolated fixtures enable their
synthetic tenant using the test database administrator only.

## Verification

`lakbiz/app/scripts/verify-inventory-transfers.mjs` executes both prepared SQL
migrations against an isolated PGlite PostgreSQL database. It checks aggregate
preservation, location quantities, partial lot/variant identity, serialized
custody, overselling, multi-line rollback, duplicate lines, NaN rejection,
cancellation, replay rejection, permissions and tenant isolation.

Run from `lakbiz/app` with `INVENTORY_TEST_MODULE` set to a disposable install of
`@electric-sql/pglite@0.3.14` (use a `file:///` URL on Windows). The Verify workflow
installs the pinned runtime outside the app dependency tree and runs the script.
This checkpoint passed 24 database checks. These fixtures do not certify live
data reconciliation or simultaneous transactions on a production Postgres server.

## Remaining Phase 2 work

1. Integrate existing stock mutations and location-aware availability.
2. Add atomic reservation/release operations and reconciliation controls.
3. Certify simultaneous sale/transfer, receipt retry and failure recovery.
4. Add the production transfer/location workspace with clear blocked states.
5. Review compatible schema/app rollout before requesting live activation.
