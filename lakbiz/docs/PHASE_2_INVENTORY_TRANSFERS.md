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

`lakbiz/app/scripts/verify-inventory-transfers.mjs` executes the three prepared SQL
migrations against an isolated PGlite PostgreSQL database. It checks aggregate
preservation, location quantities, partial lot/variant identity, serialized
custody, overselling, multi-line rollback, duplicate lines, NaN rejection,
cancellation, replay rejection, permissions and tenant isolation.

Run from `lakbiz/app` with `INVENTORY_TEST_MODULE` set to a disposable install of
`@electric-sql/pglite@0.3.14` (use a `file:///` URL on Windows). The Verify workflow
installs the pinned runtime outside the app dependency tree and runs the script.
This checkpoint passed 32 database checks. These fixtures do not certify live
data reconciliation or simultaneous transactions on a production Postgres server.

## Reconciliation and stock-writer audit

`get_inventory_location_reconciliation(organization_id, product_id)` returns
source, located, in-transit and difference quantities for each exact identity,
plus a product-level total. The product filter is optional. Owner, manager and
data-entry membership is required; the report contains no internal costs and
performs no stock repairs. Sold/written-off serial units are excluded from
physical on-hand; other unit statuses follow the existing registration guard.

The dispatch facade locks the transfer and affected products, checks every
reported identity and product total, and rejects nonzero differences before
calling the private movement implementation. App roles cannot bypass this
check through the internal schema. This is drift detection, not full writer
integration or concurrent-sale certification.

The audit identified these integration points:

| Existing writer | Pending integration |
| --- | --- |
| `business-sync.ts` product upsert/full sync | Replace aggregate snapshots with explicit location-aware mutation authority. |
| `finalize_sale_with_tenders` and `allocate_sale_inventory` | Consume location availability and exact identities in the same transaction. |
| Variant assignment and identity registration | Assign newly registered custody to an explicit location. |
| Sale returns and hold resolution | Restore original identity and the reviewed receiving location. |
| Blocked-lot disposition and stock adjustments | Remove location stock consistently with aggregate and identity stock. |

Specialist Textile stock and roll custody need their existing adapter preserved;
the generic report must not be treated as certified for that specialist engine.

## Remaining Phase 2 work

1. Integrate existing stock mutations and location-aware availability.
2. Add atomic reservation/release operations and controlled reconciliation repairs.
3. Certify simultaneous sale/transfer, receipt retry and failure recovery.
4. Add the production transfer/location workspace with clear blocked states.
5. Review compatible schema/app rollout before requesting live activation.
