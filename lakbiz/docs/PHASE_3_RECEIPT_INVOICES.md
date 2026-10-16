# Phase 3 checkpoint: receipt-linked supplier invoice authority

Status: database foundation prepared and verified; application integration and activation remain pending.

## Behavior

`20261016172522_purchase_receipt_supplier_invoices.sql` introduces an owner-only, organization-scoped invoice ledger and `record_purchase_receipt_invoice_atomic`. Apply it only after the two prepared purchasing migrations and their Phase 2 inventory prerequisites during an authorized rollout. This checkpoint does not apply any live migration.

The function records an unpaid LKR supplier invoice against 1–20 existing atomic deliveries from one purchase order. Every line of every selected delivery is billed in full; one delivery cannot be allocated to two invoices. A bill spanning multiple POs, partial billing of a delivery, paid invoices, credit notes and invoice corrections are outside this increment.

The caller supplies an invoice UUID, supplier invoice number, invoice date, explicit input VAT and actual unit prices keyed by receipt/PO-line identity. The database derives supplier, product identity and quantity from the recorded deliveries. Client-supplied quantities are ignored. Prices may differ from the receipt's estimated cost; billing does not rewrite the product buy price or historical receipt cost. Cost variance and general-ledger posting remain later accounting work.

Line amounts are rounded individually to integer minor units using exact numeric arithmetic. The invoice subtotal is the sum of those rounded lines. Input VAT remains a separate amount and is added once to the gross payable. This records the supplied VAT amount; it does not implement VAT-rate eligibility or tax-return certification. Money and source payable overflow abort the whole transaction.

Order locks, sorted receipt locks, product identity locks and one supplier lock serialize allocation and payable updates. Product-before-supplier ordering matches receiving and avoids a foreign-key lock inversion between concurrent invoices and receipts. A durable invoice key with the same canonical request returns the original invoice. Changed key payloads, already billed deliveries and duplicate supplier invoice numbers (trimmed, case-insensitive within supplier/company) fail. Document, line and allocation creation plus payable increase commit together; failure leaves none of them posted. No products, physical balances, stock logs, bank records or existing purchase/GRN records are changed.

Invoice headers, receipt allocations and lines are immutable to app roles. Read access follows the existing owner-only financial capability. The function requires purchasing/stock access and both the earlier purchasing gate and a new invoice gate. The new gate defaults disabled and has no app activation permission.

## Activation boundary

Do not enable the invoice gate yet. When it is enabled, a trigger rejects direct client changes to supplier payable balances, including stale whole-business snapshots. Unchanged balances and ordinary supplier metadata remain editable. The existing legacy GRN and payment writers are not adapted to this authority and must be replaced or blocked before enablement.

The Supplier screen, purchase history, supplier ledger and payable snapshot adapters do not yet consume this new invoice ledger. The next application increment must provide receipt selection, rate/VAT entry, persistent request recovery, server refresh/merge and clear separation of linked invoices from stock-receiving GRNs. Settlement integration, backdated/reporting behavior, full authenticated historical-schema security review and company certification remain necessary. No live company is enabled by this migration or test suite.

## Verification

`verify-receipt-invoices.mjs` is included in the existing isolated database pipeline. Native PostgreSQL 17.4 passed 40 invoice checks plus the preceding 113 inventory/purchasing checks: 153 total. The PGlite equivalent passed 142 checks (37 invoice checks) without a server. Fixtures use the actual prepared migrations with a synthetic source schema; they do not certify every historical policy, trigger, report or company balance.

Checks cover disabled activation, owner/manager/anonymous/foreign-company access, complete receipt coverage, invalid rates/VAT, duplicate identities/numbers, canonical replay, immutable audit, late payable overflow rollback, exact fractional rounding, unchanged stock/custody/audit/cost and native races for identical retries, competing invoices and invoicing versus another PO receipt with a supplier foreign key.
