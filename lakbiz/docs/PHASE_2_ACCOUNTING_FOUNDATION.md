# Phase 2 — general ledger foundation

## Delivered implementation

A new authenticated `/accounting` workspace reads the connected organization's chart of accounts, all-time trial balance and latest 50 posted journals. Owner-only navigation and route checks supplement database RLS. No demo values or historical business balances are injected.

The additive `20261011062938_general_ledger_foundation.sql` migration creates tenant-scoped ledger accounts, journal batches and journal lines. Three SECURITY INVOKER RPCs initialize accounts, post a manual journal and obtain the trial balance. All require owner membership; writes additionally require the existing active banking entitlement. Expired subscriptions retain owner read access. Anonymous access is revoked.

Accounts initialize idempotently to 14 LKR accounts. Posting validates integer minor units, account ownership, one side per line, positive equal debit/credit totals and two to 200 lines. Compound foreign keys prevent cross-tenant account/batch references. Deferred database checks reject incomplete or unbalanced direct API writes. Posted headers and lines are immutable. Manual source keys are unique within an organization; retries return the original journal, while a changed payload with the same key fails. The client freezes an attempted draft for a same-key retry, avoids double-click races and resets state across tenant/role changes.

## Release status

Implemented and tested in isolation; not yet applied to the live Supabase project. The UI reports that the database update is unavailable when the migration is absent. Existing products, stock, sales, returns, subscriptions and financial calculations are unchanged.

## Verification

Run the existing app verification suite with `npm run verify`.

The PostgreSQL migration tests run against PGlite in memory, with small auth/membership/entitlement fixtures. They never connect to production. They verify balanced posting, retry behavior, rollback, immutability, direct-write constraints, compound foreign keys, role/tenant isolation, expired read access and denied writes. The fixtures test the new migration's integration contract; they do not certify the entire existing Supabase permission system or concurrent multi-session behavior.

To reproduce without adding a production dependency:

```bash
npm install --prefix /path/to/disposable-pg-test @electric-sql/pglite
LEDGER_TEST_MODULE=/path/to/disposable-pg-test/node_modules/@electric-sql/pglite/dist/index.js node scripts/verify-general-ledger.mjs
```

TypeScript tests verify exact monetary input, balanced entry validation and owner-only route access. All 271 app tests pass, as do TypeScript, changed-file lint and the clean production build. The isolated PostgreSQL suite passes 22 checks. The initial production build encountered a stale Turbopack persistence-cache panic; moving the derived cache aside resolved it.

## Still pending in Phase 2

- General location and reservation authority with explicit migration from existing quantities.
- Transactional purchasing/receipts and automatic source postings for sales, returns, imports, expenses and settlements.
- Inventory cost layers or carrying value, residual-cent handling and financial/subledger reconciliation.
- Closed accounting periods, controlled reversal workflows and a durable draft/retry lifecycle across browser reloads.
- Multi-currency documents and FX settlement; this foundation deliberately supports LKR only.
- Account maintenance, period-based statements and report exports.
- Complete localized form/error copy; the workspace heading and scope explanation support Sinhala/Tamil, but some new labels remain English.
- Authenticated browser and multi-session production-equivalent certification before activation.

Manual journals do not change customer balances, supplier balances, physical stock or existing banking records. Until automatic source adapters and reconciliation are delivered, this ledger must not be presented as a complete representation of the business's existing accounts.

## Entry tracing

Trial-balance account names open paginated posted transaction history. Recent journal references open their line details. Both show journal date, description, reference, account and exact debit/credit amounts, 50 entries per page ordered by journal reference and line number. They use the normal browser client and existing owner RLS, explicitly filter both lines and parent journals by organization, and include posted journals only. Pagination does not represent an opening or running balance. No migration changes or live activation are included.
