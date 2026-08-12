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

## Dashboard command center (`/dashboard`, post-Phase-18 refinement)
Supersedes the old Phase 10 dashboard entirely — the black VAT card and
indigo income-tax card mentioned in the original Phase 10 QA note are
gone, replaced by the Financial Snapshot section below, so that specific
item no longer applies. None of the following has been visually checked.
- [ ] Load `/dashboard` as an owner with real sales/jobs data. Confirm
      the 4 KPI cards (today's sales, gross profit, payments received,
      jobs today) render at the top with clear visual priority over
      everything below.
- [ ] Confirm Today's Operations shows today's scheduled jobs as a table
      on desktop and stacked cards on mobile; click a row and confirm it
      navigates to `/jobs` (this is a known, disclosed limitation — it
      does not deep-link into that specific job's drawer, since `/jobs`
      has no URL-driven way to open one).
- [ ] Confirm Needs Attention shows only real, currently-true alerts
      (create an unassigned job, an over-limit customer, or a low-stock
      product to verify each one appears; delete/resolve it and confirm
      the alert disappears without a page reload issue).
- [ ] With zero alerts, confirm the single "operations are clear" line
      shows instead of nothing / instead of empty alert cards.
- [ ] Confirm the Financial Snapshot + Revenue & Gross Profit chart sit
      side-by-side on desktop (≥1024px) and stack on mobile; toggle the
      "Estimated income tax" collapsed panel open/closed.
- [ ] Switch the chart's period selector (30 days / 3 / 6 / 12 months) —
      confirm both revenue and profit bars redraw and the totals below
      update. The 30-day view specifically exercises a date-matching fix
      made in this pass (`Sale.date` is a full ISO timestamp, not a
      plain date) — worth checking this one isn't silently empty.
- [ ] Confirm Teams Today groups jobs by assigned technician/contractor
      correctly, and an "Unassigned" group appears in amber if any job
      today has no assignee.
- [ ] Sign in as **data_entry** and **cashier** — confirm neither sees
      any profit/bank/receivables/payables/VAT figure anywhere on the
      page. Confirm **cashier** additionally sees no AC-jobs section at
      all (Today's Operations, Teams Today, "+ New job" button) — this
      was a bug caught and fixed during this pass, worth double-checking
      it actually holds in a real browser.
- [ ] Sign in as **technician** — confirm `/dashboard` now loads (was
      previously an infinite-redirect bug) and shows the simplified
      "Today's Jobs" list with call/navigate icons, no financial figures
      anywhere.
- [ ] Sign in to a brand-new org with zero customers/products/sales/jobs
      — confirm the 3-step "Start using LakBiz" onboarding state shows
      instead of the full dashboard; add one customer and confirm it
      switches to the real dashboard automatically on next load.
- [ ] Tab through the header's `More ▾` menu and each Needs Attention
      row's action button with a keyboard only — confirm focus is
      visible throughout.

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
