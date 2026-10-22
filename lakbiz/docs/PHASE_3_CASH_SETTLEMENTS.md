# Receipt invoice cash settlements and supplier statements

Status: prepared implementation; unapplied live, with existing rollout gates unchanged.

## Behavior

`20261017025855_purchase_invoice_cash_settlements.sql` follows the three prepared purchasing migrations. Its owner-only `settle_purchase_invoice_cash_atomic` records a positive two-decimal LKR cash payment against an existing receipt-linked invoice. Partial payments are allowed. The payment cannot precede the invoice date, exceed its outstanding balance or consume an unreconciled supplier payable. Invoice and supplier locks serialize payments. Replaying the same company-scoped settlement key returns the original audit row; changed details fail. Audit insertion and payable reduction commit together. No stock, custody, receipt cost, legacy payment record or bank balance is changed.

The settlement table is immutable to application roles, with owner financial read access and explicit grants. Manager, anonymous and foreign-company access is denied. The RPC requires the existing purchasing and invoice gates. It never enables them. Direct legacy purchase, purchase-line and supplier-payment document changes are rejected while invoice authority is enabled, protecting the statement from forged legacy entries.

## Application

The invoice history exposes **Review / pay cash**. The inline payment panel shows server-derived total, paid and outstanding amounts, retains amount/date/reference after rejection, and supports an explicit balance refresh. Company/user-scoped local storage and Web Locks preserve the original request across uncertain responses. The client verifies the payment audit and refreshes the server summary before acknowledging the recovery key. The panel lists the latest 50 cash payments; the paid total includes all payments.

The supplier Ledger action now opens a cloud statement with stable 50-entry pages and running balances across pages. It combines legacy credit GRNs and supplier payments with receipt-linked invoices and cash settlements. A clearly labelled opening/reconciliation amount accounts for retained opening balances and historical differences; the closing amount matches the supplier payable. Disabled/missing-schema companies keep the legacy statement when the new read authority is absent. Permission/network failures do not fall back to incomplete local financial history. The dialog manages keyboard focus, Escape, tab containment and focus restoration.

Legacy authenticated GRN and unallocated-payment commands verify invoice authority online before optimistic mutation. Targeted GRN/payment snapshot writers also verify before writing stock or payables. Full-business snapshots fail before writes when invoice authority is enabled; safe metadata-only supplier/full-snapshot adapters remain required before activation. Disabled and missing-schema companies retain existing online behavior. Authenticated GRNs/payments now require an online check; local demonstration behavior remains available.

## Boundaries

This is LKR cash already paid to the supplier. Bank settlement, bank-ledger integration, FX differences, reversals, credit notes, cash-till control and general-ledger posting are not provided here. Legacy GRNs/payments remain readable but cannot be created or modified after invoice authority is enabled. Supplier metadata/full-snapshot adapters, historical-schema and authenticated company certification must be completed before enabling the gate. No live company, migration, production promotion or real financial test transaction was used.

The invoice-selection history still has its previously documented size limits; the supplier statement itself is now server-paginated. Phase 3 remains in progress.

## Verification

The isolated inventory pipeline imports `verify-invoice-settlements.mjs`, applying the actual migration with a synthetic source schema. The new fixtures cover disabled gates, roles/tenant boundaries, legacy-source protection, amount/date validation, partial payments, exact retry, changed payload rejection, immutable audit, stale payable rollback, combined statements, pagination and unchanged stock. Native PostgreSQL additionally checks simultaneous identical retries and competing payments against the same invoice. These fixtures do not certify every historical migration or live company balance.

Verified: 439 application tests in 60 files, TypeScript, lint with no new errors/warnings (two existing provider warnings), a 325-route production build, 184 native PostgreSQL checks (31 settlement checks), 171 PGlite checks (29 settlement checks) and six isolated Supplier/invoice browser fixtures at 390/768/1440 widths. The browser checks cover draft preservation, recovery, statement pagination, keyboard close, failed-load retry and owner access. Same-day invoice entries precede their payments deterministically. No live financial writes were made.
