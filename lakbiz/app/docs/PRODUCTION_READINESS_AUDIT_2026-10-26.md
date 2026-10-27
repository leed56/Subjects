# LakBiz production-readiness audit — 26 October 2026

**Verdict: not cleared for production promotion.** This is a focused audit of
the optional grocery grinding-mill range and its release path, not a claim that
every LakBiz module has been audited.

## Completed locally

- Added 36 owner-opt-in, SKU-stable grinding-mill templates and 36 original
  illustrations. All start inactive, unpriced and without stock or barcode.
  Existing grocery shops receive nothing until their owner explicitly imports.
- Added a grocery Stock action, spice category navigation and English/Sinhala/
  Tamil display/search aliases. Existing owner-edited names take precedence.
- Typecheck and production build pass. Full Vitest suite: 37 files, 236 tests
  passed. i18n parity check passes against the existing baseline. ESLint exits
  successfully with eight warnings in pre-existing or unrelated code.
- A local production-server browser check passed at 1280px and 390px: the
  Stock action and localized confirmation render without horizontal overflow,
  and the cumin illustration URL resolves. A disposable, unauthenticated demo
  browser imported all 36 records, reloaded them, and confirmed they remain
  inactive and absent from the sellable POS. No live shop was changed.

## Release blockers and unresolved evidence

1. **Live database audit unavailable.** The connected Supabase account lists
   a different project. LakBiz's configured project `zestppstpwjxriwcuykc`
   returns `INVALID_ARGUMENT` through this connection. Its RLS, migration
   state, backup/restore, advisors and live shop isolation were therefore not
   verified in this audit.
2. **CI/deployed QA has not checked this change.** The current HEAD is
   `2d3a9f05a9e2f384471fe374375d255956e16589`. Its GitHub combined status
   shows Vercel success but no workflow run; no open PR was found for
   `claude/world-class-banking-ui`. The `LakBiz Verify` push trigger does not
   include this branch, and the deployed UI QA normally runs on a PR.
3. **Batch cloud-save recovery needs proof and likely hardening.**
   `saveProductToCloud` updates browser/local state before cloud sync. On a
   cloud failure, the import pauses; the next attempt identifies missing items
   from local SKUs, so an unsynced local item may be skipped. Test partial
   failure, reconnect and repeated import against an isolated staging shop;
   implement a server-confirmed, idempotent per-shop import or reconciliation
   before trusting this action for live owners.
4. **POS price gate beyond local code.** The grocery POS and local `createSale`
   helper now exclude inactive/unpriced items. The Stock editor still permits
   an owner to activate an unpriced item; make that state explicit and verify
   the cloud checkout/RPC rejects invalid prices independently of the browser.
5. **Stock audit trail cloud proof.** The regular Stock edit path now logs a
   direct quantity correction and includes the new log in its product sync.
   Verify the cloud transaction, actor attribution and role permissions in
   staging before treating this as a complete inventory audit trail.
6. **Unrelated local changes are mixed in the checkout.** The working tree
   contains modified pharmacy, messaging, login, sidebar and other files.
   Isolate the grocery changes in a clean branch/PR, review its exact diff,
   and keep unrelated work out of the production release.
7. **Language and workflow finish.** The parity checker reports tolerated
   baseline debt of 1 English and 1,480 Tamil keys; this is not a completed
   Tamil QA. Have native Sinhala/Tamil reviewers check the 36 product names,
   pack units, full owner/stock/POS flows and receipt text. Grocery Hold Bill
   and Recall Bill remain disabled in the current UI and must be clearly
   labelled or implemented before being advertised as usable shortcuts.

## Required final gates

Use an isolated staging grocery shop and a clean PR. Obtain passing code,
security and deployed UI checks on the exact commit. Verify import twice,
interrupted sync recovery, owner/cashier permissions, edit-to-POS price update,
checkout/receipt/stock deduction, returns and low-stock reporting; then verify
backup and rollback against the actual LakBiz Supabase and Vercel projects.
Promote only that exact reviewed commit after explicit release approval.
