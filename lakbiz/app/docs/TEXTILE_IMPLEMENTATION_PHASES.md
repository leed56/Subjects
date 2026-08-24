# LakBiz Textile — implementation roadmap

## Product boundary

The Textile sector supports one shared catalogue and stock pool across:

- wholesale full-roll sales;
- wholesale measured cuts;
- retail measured cuts; and
- fixed pieces, bundles and accessories.

It is a trading and distribution workflow, not apparel manufacturing. Production BOMs,
factory planning and garment work orders are outside the initial scope.

## Phase 1 — sector and roll-safe foundation

### Deliverables

- Provisionable `textile` business sector with the correct modules and permissions.
- Textile catalogue fields: fabric family, construction, composition, width, GSM,
  colour, shade, design, finish, origin and supplier reference.
- Selling units for metre, yard, roll, piece, bundle and kilogram.
- Roll-aware inventory profile and typed roll domain model.
- Decimal quantity and metre/yard conversion helpers with explicit precision rules.
- Textile dashboard, onboarding, categories, reporting labels and inventory navigation.
- Database reference data for business provisioning and module gates.

### Acceptance criteria

- A new Textile business can be provisioned without falling back to Grocery.
- Textile products can be created with textile-specific fields and units.
- Existing sectors retain their current defaults and routes.
- Unit conversion never silently rounds a measured cut to a whole number.
- Lint, type checking, unit tests and production build pass.

## Phase 2 — physical rolls and receiving

- Roll receipt against supplier purchase orders and goods receipts.
- Unique roll number/barcode, supplier lot, dye lot, shade, width, received length,
  usable length, defects, landed unit cost and rack/bin location.
- Opened, unopened, reserved, exhausted, quarantined and returned roll states.
- Roll labels, stocktake and controlled measurement adjustments.
- Owner-only landed cost and margin visibility.

## Phase 3 — wholesale and retail selling

- Sale modes: full roll, wholesale cut, retail cut and fixed piece/bundle.
- Retail, wholesale, quantity-break and customer-specific price books.
- Decimal cut entry with roll selection and real-time remaining length.
- Quotations, negotiated-price approval and quotation-to-order conversion.
- Cash, card, transfer, cheque, credit and mixed settlement.

## Phase 4 — cutting, remnants and reservations

- Mobile-friendly Cutting Desk with roll scanning.
- Immutable cut ledger, waste/damage reason and cutter identity.
- Automatic remnant creation and remnant ageing.
- Customer/order reservation with expiry and release controls.
- Same dye-lot allocation warnings and manager-approved exceptions.

## Phase 5 — warehouse and dispatch

- Pick lists by warehouse, rack, roll and dye lot.
- Partial fulfilment, packing, dispatch note and delivery status.
- Branch/warehouse transfers with scan-based custody.
- Returns inspection tied to the original sale, roll and cut.
- WhatsApp quotation, order confirmation and dispatch notification.

## Phase 6 — credit, purchasing and imports

- Customer credit limits, payment terms, ageing and collection workflow.
- Post-dated cheque lifecycle and due/bounce alerts.
- Supplier price history, purchase planning and replenishment.
- Import shipment/container reference, duties, freight and landed-cost allocation.
- Salesperson commission based on collected revenue or approved margin policy.

## Phase 7 — owner controls and intelligence

- Roll, lot, shade, location and remnant stock reports.
- Sales and margin by metre/yard, roll, fabric family, customer and salesperson.
- Measurement variance, cutting waste, shrinkage and adjustment audit.
- Slow-moving stock, ageing, reorder and dead-stock recommendations.
- Wholesale/retail channel performance, receivables exposure and cash forecasting.
- Multi-branch owner dashboard and exportable audit packs.

## Non-negotiable controls

- A physical roll has one immutable identity; cuts create ledger movements.
- Remaining length cannot become negative.
- Unit conversion is explicit and recorded on the transaction.
- Reserved quantity is not shown as freely available stock.
- Different dye lots cannot be silently combined for one matched order.
- Price, cost, credit and stock adjustments follow role-based approval rules.

