# LakBiz manual QA checklist (Phase 18)

Why this exists: Phase 18 attempted a full automated browser click-through
of every flow added in Phases 1–17, using Playwright against a local dev
server backed by the real production Supabase project. The backend/data
layer was verified end-to-end this way (see `IMPLEMENTATION_PROGRESS.md`
Phase 18) — but the browser itself could not reach any external host at
all in this session's sandbox (confirmed with a control test against
`https://example.com`, which failed identically to Supabase calls — see
Phase 18 for the full diagnosis), so no actual UI could be exercised or
screenshotted. This checklist is the fallback: a QA pass a human (or an
agent with a working browser) should run before treating Phases 6–18 as
production-ready. Every item below is something no phase in this project
has ever had eyes on.

Sign in as an **owner** account with the **AC/HVAC sector** selected at
signup, so every `ac_jobs`-gated nav item is visible.

## Phase 10 — Dashboard
- [ ] Load `/dashboard`. Confirm the "ESTIMATED INCOME TAX · 30%" meter
      card renders its eyebrow/title on one line, with the action button
      on its own row below (this was the one item already visually
      confirmed via a user-provided screenshot mid-project — re-check it
      hasn't regressed since).
- [ ] Confirm all other MeterCards (dark variants) render without text
      being squeezed vertically.

## Phase 14 — Reports (`/reports`)
- [ ] Switch between all four period filters (7d/30d/month/all) — confirm
      metric cards and tables update.
- [ ] Confirm the 14-day bar chart renders bars proportional to daily
      totals, and the empty state shows correctly with zero sales.
- [ ] Confirm top-products / top-customers tables render and truncate
      long names without breaking layout.
- [ ] Sign in as a non-owner/manager role and confirm the access-denied
      `EmptyState` shows instead of financial data.

## Phase 15 — Mobile field UX
- [ ] On a job card in `/jobs`, tap the navigate icon next to the address
      — confirm it opens Google Maps (or the device's default maps app)
      with the correct address.
- [ ] Tap the call chip next to a job's phone number — confirm it opens
      the device dialer with the correct number.
- [ ] Open a job's job-sheet drawer — confirm the call/navigate chips
      next to "View invoice" work the same way.
- [ ] In `/schedule`, open the reschedule drawer for a job — confirm the
      new address block (with call/navigate chips) renders above the
      date picker, and that it did not push the "set date" button off
      screen on a small viewport.
- [ ] Repeat the tap-to-call/navigate checks on an actual phone, not just
      desktop Chrome — `tel:`/maps deep-linking behaves differently
      per-platform and was never tested on real hardware.

## Phase 16 — Performance/a11y
- [ ] Open a message composer (e.g. from a job's WhatsApp/SMS button)
      on a **fresh page load** — confirm it still opens correctly now
      that `MessageComposer` is lazy-loaded via `next/dynamic`, and
      check the browser Network tab for a separate chunk request the
      first time it's clicked (confirming the lazy-load actually
      deferred the fetch, not just that it still works).
  - [ ] Confirm no console error like "Loading chunk failed" appears.
- [ ] Tab through the Schedule week-navigation prev/next buttons with a
      keyboard only — confirm focus is visible and a screen reader
      announces "Previous week" / "Next week" (not silence or "button").

## Cross-cutting
- [ ] Full sign-up → onboarding → first job → first sale flow on a
      throwaway test account, start to finish, watching for any console
      errors (Phase 18 confirmed this works at the API layer; it has
      never been watched render in an actual browser).
- [ ] Resize each new page (Reports, Crews, Expenses, Job Costing) to a
      narrow mobile viewport and confirm nothing overflows horizontally.
- [ ] Check dark-mode / high-contrast OS settings don't break anything
      (not addressed by any phase — the design system doesn't have a
      dark mode, this is just confirming no OS-level color-scheme
      override breaks legibility).

## Not this checklist's job
Cross-tenant RLS isolation, API route authorization, and the Phase 17
database-hardening fixes were all verified live against the real backend
in Phase 17/18 (SQL role-impersonation + direct REST API calls) — no
need to re-test those manually; they're the one category of "final QA"
this project could actually finish end-to-end without a working browser.
