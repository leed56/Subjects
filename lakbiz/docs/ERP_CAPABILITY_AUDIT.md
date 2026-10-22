# Full-scope implementation audit

The original four-surface architecture and entire suggested page list are now documented and represented in the interactive sample suite. This matrix separates observed live code from demonstration behavior and production work; table presence is not production certification.

| Requirement | Existing production code | This release | Remaining production work |
| --- | --- | --- | --- |
| One platform with industry templates | Typed sectors, module matrix, provisioning, fields and tracking defaults | Versioned showcase registry; hardware/stationery/wholesale added alongside cosmetics | Consolidate configuration registries; tenant assignment/version persistence |
| Retail POS | Atomic retail checkout, tenders, textile sales, customer prices | Complete connected sample POS design | Bring design into each existing lane; full scanner/role QA |
| Business ERP | Purchases, suppliers, banking, VAT, reports, jobs and assets | Complete page designs and sample engine | General new-domain cloud adapters and transactional posting |
| Owner Mobile | Textile/pharmacy Pulse | All-industry sample Owner Pulse | Production all-industry projections; return and collection reconciliation |
| SaaS Admin | Protected shops, provisioning, messaging and subscription controls | Sample tenant portfolio and edit design | Template release and cohort control persistence |
| Grocery/pharmacy/cosmetics/textile | Existing deep grocery/pharmacy/textile workflows; cosmetics increment | Independent demos for each | Authenticated role/browser certification; cosmetics migration release |
| Electronics/mobile/spares/vehicles | Sector fields, serial/IMEI, parts, vehicle workflow | Dedicated catalogues and identity metadata demos | Deep per-industry regression and production UI reconciliation |
| Hardware/stationery/wholesale | Missing named template packs | Runtime/provisioning configuration, product fields, tracking defaults and additive migration | Deploy compatible app+migration; wholesale pack/pricing/location integration |
| Purchasing | PO, receipt, supplier payable; sequential cloud snapshots | Create/receive sample orders; duplicate-post prevention | Atomic production receipt across all identities and ledgers |
| Imports/landed cost | Specialized textile and vehicle imports/costs | General sample shipment/currency/cost allocation and receipt | General shipment schema/adapters; partial receipts; payment FX; documents |
| Inventory/expiry/serial/variant | Advanced inventory identities, lot/serial/variant allocation, returns | Sample location quantities and identity design; cosmetics expiry fix | Location authority/conversions across all existing identities |
| Damage/loss | Existing write-offs and hold resolution | Connected reasoned sample loss with journal | General approval/location/valuation adapters |
| Warehouses/branches/transfers | Specialized textile warehouse/dispatch support | General sample transfer conservation and trail | True general location partitions and in-transit state in production |
| Accounting/COGS/profit | Owner privacy, sales/profit, banking, expenses and return adjustments | Balanced sample journal and trial balance | Complete source postings, cost layers/residuals, period closing and reconciliation |
| VAT | Existing VAT calculation and UI | Editable sample VAT with return reversal and separate import VAT | Verify current official invoice/filing requirements; production policy versioning |
| Customers/credit | Customers, payments, per-product prices and textile credit terms | Sample credit limits and balance updates | Atomic credit reservations; ageing/collections QA |
| Loyalty | No complete shared production point ledger observed | Earn/redeem/reverse sample engine and UI | Durable point ledger, policy snapshots, expiry and POS integration |
| Staff | Organization roles/team; HVAC workforce | General people/access sample design | Generic schedules/attendance where desired; invitation and role QA |
| BI/reports | Existing report and specialized owner intelligence | Connected sample chart/ranking/CSV | General location/industry reports and reconciled projections |
| Subscriptions/entitlements | Existing plans, addons, statuses, read-only guards | Sample subscription configuration | End-to-end activation/expiry/webhook/offline certification |
| Template Studio | No full release-control UI observed | Contract inspector and real static config checks | Immutable release records, migration runs, cohorts and rollback |
| Client demo per industry | No complete isolated multi-industry showcase | 14 public demo identities, 17 pages each, mock data, reset and session isolation | Deployed client catalogue, sample entry and checkout verified; production capabilities remain separate |

## Verified by this change

Unit tests check every industry seed, credentials, independent sample keys, role denial, balanced trial balances, stock conservation, expiry/holds, credit limits, negative/non-finite inputs, landed-cost rounding, import VAT separation, duplicate receipt/return prevention and reward reversal. Production build and TypeScript/lint are required before publishing the draft.

## Explicit boundaries

The sample suite is not a production financial/accounting service. Mock quantities are aggregate example data; serial, IMEI, VIN and roll metadata are illustrative. Specialist production allocation engines remain authoritative. New templates do not rewrite existing product profiles or stock. General imports, warehouses, loyalty, ledger and release management still need production database adapters before being advertised as live features.

No live database migration was applied as part of the design-suite change. No existing shop data was replaced with mock data. All further production integration is part of the full platform goal rather than a silently dropped requirement.


## Phase 2 implementation increment

The owner-only general ledger schema, exact-input posting adapter and `/accounting` workspace are implemented on the enhancement branch. The foundation migration was activated in live Supabase on 11 October 2026 after explicit approval; the separately implemented opt-in sales bridge migration remains unapplied. See [PHASE_2_ACCOUNTING_FOUNDATION.md](PHASE_2_ACCOUNTING_FOUNDATION.md) for constraints, reproducible verification, release status and the remaining stock/source-posting/reconciliation work. This adds a real persistence contract rather than changing the demo finance engine.


## Specialist textile UI increment — 12 October 2026

The actual textile `/sales` lane now has a sector banner, matched-roll and separate metre/yard availability KPIs, a selectable dye/shade/rack catalogue, measured-line builder and adjacent allocation/payment sidebar. Its subtotal, discount and amount due use light surfaces and two-decimal display. The existing finalizer, reservation quantities, pricing priority and tender validation remain authoritative. Exact scanning now resolves eligible rolls across the preceding fabric filter, without selecting an empty barcode. Load failures have an explicit Retry state, and the textile route resets draft component state when organization or role changes.

Local validation: 37 browser scenarios against the actual component with isolated adapters, including three languages/four viewports, mixed units, reservations, over-allocation, wholesale/customer/manual prices, split-tender payloads, cashier/read-only controls, empty/error states and long desktop checkout. The Verify workflow now runs this repeatable local fixture suite after its production build and saves screenshots. This is not authenticated end-to-end certification of textile stock or financial posting; no live sale, message or migration was performed.
