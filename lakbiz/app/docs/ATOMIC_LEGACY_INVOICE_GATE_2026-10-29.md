# Atomic legacy invoice gate — 2026-10-29

## Fix completed

The legacy invoice bridge now has an optional atomic side-effect route. A
reconnecting checkout can commit its immutable invoice header and lines,
server-derived stock decrement, append-only stock movement, customer credit,
bank receipt and cheque record in one transaction. Replaying the same invoice
identifier returns the original result without applying those effects twice.

The browser sync path rehydrates the pre-sale product quantity before the
server decrement, sends only stable identifiers/display metadata as context,
and no longer performs separate stock, bank or cheque writes after a successful
atomic commit.

## Local evidence

- Disposable PostgreSQL clone: `scripts/qa-completed-invoices.mjs`
- 19 database checks passed, including interruption/retry, concurrent
  confirmation, shop isolation, cashier price protection, append-only history,
  bank/stock side-effect atomicity and idempotent replay.
- `npm run typecheck` passed.
- `npm run test` passed: 46 files, 303 tests.
- `npm run lint` passed with 0 errors and 11 pre-existing warnings.
- `npm run check:i18n` passed with no new gaps (existing baseline: `ta 1480`).
- `npm run build` passed and generated all application routes.

## Still required before promotion

This is a code and local-database gate only. It is not live production
approval. A separate disposable Supabase staging project is still required to
verify Auth/RLS/PostgREST, browser checkout and restore behaviour before the
catalogue and invoice migrations are applied to project `zestppstpwjxriwcuykc`.
The live project still lacks the catalogue/readiness functions and its security
advisor findings remain open.
