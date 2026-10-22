# Phase 2 — general ledger foundation

## Delivered implementation

A new authenticated `/accounting` workspace reads the connected organization's chart of accounts, all-time trial balance and latest 50 posted journals. Owner-only navigation and route checks supplement database RLS. No demo values or historical business balances are injected.

The additive `20261011062938_general_ledger_foundation.sql` migration creates tenant-scoped ledger accounts, journal batches and journal lines. Three SECURITY INVOKER RPCs initialize accounts, post a manual journal and obtain the trial balance. All require owner membership; writes additionally require the existing active banking entitlement. Expired subscriptions retain owner read access. Anonymous access is revoked.

Accounts initialize idempotently to 14 LKR accounts. Posting validates integer minor units, account ownership, one side per line, positive equal debit/credit totals and two to 200 lines. Compound foreign keys prevent cross-tenant account/batch references. Deferred database checks reject incomplete or unbalanced direct API writes. Posted headers and lines are immutable. Manual source keys are unique within an organization; retries return the original journal, while a changed payload with the same key fails. The client freezes an attempted draft for a same-key retry, avoids double-click races and resets state across tenant/role changes.

## Release status

The foundation migration was applied to the connected Supabase project on 11 October 2026 after explicit user approval, recorded by Supabase as `20261011094954_general_ledger_foundation`. Table RLS, seven owner policies, anonymous-denied permissions and SECURITY INVOKER RPCs were verified. Tables were empty after migration; accounts and balances were not automatically initialized. Existing products, stock, sales, returns, subscriptions and financial calculations are unchanged. Full authenticated accounting browser certification remains pending.

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

The new opt-in sale revenue/VAT adapter and its pending migration are tracked separately in [PHASE_2_SALES_LEDGER_BRIDGE.md](./PHASE_2_SALES_LEDGER_BRIDGE.md). The foundation alone does not activate that adapter.

- General location and reservation authority with explicit migration from existing quantities.
- Transactional purchasing/receipts and automatic source postings for sales, returns, imports, expenses and settlements.
- Inventory cost layers or carrying value, residual-cent handling and financial/subledger reconciliation.
- Closed accounting periods, controlled reversal workflows and a durable draft/retry lifecycle across browser reloads.
- Multi-currency documents and FX settlement; this foundation deliberately supports LKR only.
- Account maintenance, period-based statements and report exports.
- Complete localized form/error copy; the workspace heading and scope explanation support Sinhala/Tamil, but some new labels remain English.
- Authenticated accounting browser and multi-session production-equivalent certification.

Manual journals do not change customer balances, supplier balances, physical stock or existing banking records. Until automatic source adapters and reconciliation are delivered, this ledger must not be presented as a complete representation of the business's existing accounts.

## Entry tracing

Trial-balance account names open paginated posted transaction history. Recent journal references open their line details. Both show journal date, description, reference, account and exact debit/credit amounts, 50 entries per page ordered by journal reference and line number. They use the normal browser client and existing owner RLS, explicitly filter both lines and parent journals by organization, and include posted journals only. Pagination does not represent an opening or running balance. No migration changes or live activation are included.

## Date filters and exports

Entry tracing supports optional inclusive start/end journal dates, validated before querying, with a reset to page one on application. The displayed applied range is distinct from edited form values. Refresh/retry reloads the same query and stale responses are ignored. CSV exports contain only the currently loaded page (up to 50 entries), with page/range/currency metadata; they are not complete statements. Unicode, quoted and multiline descriptions are preserved, formula-like text is neutralized, and amounts are exported from integer minor units without decimal rounding. No new database migration is required. Full period statements and automatic source integration remain pending.

## All-time ledger financial summaries

The accounting workspace now derives all-time profit/loss and a balance sheet from the database-aggregated trial balance, not from the latest 50 journal records. Income, expenses, assets, liabilities and posted equity retain negative/opposite-side balances. Unclosed earnings are included once in calculated equity without posting a closing journal. The asset = liability + equity + unclosed earnings equation is checked visibly; a balanced equation does not certify data completeness or reconciliation.

These summaries explicitly include all posted journal dates, including future dates. They are not date-filtered period statements, statutory accounts, or a complete view of existing business balances. Existing sales, purchases, stock, payments and opening balances remain outside these reports unless explicitly journaled. Account lines link to entry tracing. CSV contains the supplied trial-balance rows and summary totals, with scope warnings, exact decimal magnitudes and separate signs for negative totals. Financial totals use integer minor units with bigint intermediate arithmetic and reject unsafe aggregates, duplicate accounts and invalid classifications. No database schema changes are part of this report step. Some report labels still require Sinhala/Tamil translation.
