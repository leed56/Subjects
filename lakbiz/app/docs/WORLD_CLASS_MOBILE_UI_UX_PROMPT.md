# LakBiz world-class mobile UI/UX implementation prompt

Use this prompt as the single implementation brief for the remaining LakBiz UI/UX work.

---

You are upgrading LakBiz, a production-oriented Sri Lankan SME ERP built with Next.js 16,
React 19, TypeScript, Tailwind CSS and Supabase. The objective is a world-class operational
product, not a decorative redesign.

## Product outcome

Make LakBiz fast, calm and decision-oriented on mobile, tablet and desktop. Each screen must
lead with the next useful task, expose exceptions before passive statistics, and use space in
proportion to information value. A polished empty card is not useful density.

## Non-negotiable constraints

- Preserve every working route, calculation, database contract, Supabase RPC, RLS rule,
  subscription gate, role permission, localization key and sector workflow.
- Financial data remains owner-authorized through server/database controls; visual hiding is
  never treated as security.
- Preserve English and Sinhala. Test both languages for wrapping, truncation and font metrics.
- Textile is Pettah-style wholesale fabric-roll trading plus retail measured cuts. It is not a
  fashion boutique or garment-manufacturing POS.
- Vehicle is a sales/inventory sector. Do not add workforce/team concepts unless a real service
  workflow needs them.
- Do not invent data, customer proof, analytics or success states.
- Do not redesign strong screens from scratch when a shared primitive or ordering change solves
  the problem.
- Avoid card soup, giant empty areas, gratuitous gradients, excessive pills/uppercase text,
  emoji icons, weak disabled states and multiple equal primary actions.
- Keep primary operational targets at least 44px where practical and meet WCAG 2.2 AA target,
  focus, contrast, reflow, label and status-message requirements.

## Visual language

- Dark navy/slate navigation, cool slate workspace and refined white operational surfaces.
- Teal for primary actions, amber for warnings and rose for destructive/error states.
- Crisp SVG icons, restrained borders/shadows, strong typographic hierarchy and normal body
  letter spacing.
- One obvious primary action per screen. Secondary actions remain secondary; exports/settings
  move into an overflow menu when space is constrained.
- Mobile must work at 320, 360 and 390 CSS pixels without horizontal page scrolling.

## Phase 1 — mobile density system

1. Introduce compact mobile metric-card behavior in shared primitives.
2. Use 2-column mobile metric grids where values remain readable.
3. Reduce mobile padding, icon size, decorative accent weight and vertical gaps without reducing
   operational touch targets.
4. Prevent long values from overflowing; support wrapping or controlled text sizing.
5. Apply the system first to Customers, Bills and Textile POS.
6. Keep desktop grids and visual hierarchy intact.

Acceptance:

- Customers' four metrics fit as a 2×2 mobile block.
- Bills' metrics use a 2-column mobile grid; owner-only metrics still obey permissions.
- Textile POS uses two compact metrics plus a full-width invoice total on mobile.
- No metric value or Sinhala/English label clips at 320px.
- Lint, TypeScript, tests and production build pass.

## Phase 2 — sector- and role-aware dashboard command centre

1. Replace generic textile onboarding with: add fabrics, receive first roll, configure customer
   terms and make the first fabric sale.
2. Order dashboard content: compact identity/sync header, quick actions, needs attention, today,
   stock/operations pulse, recent activity and owner-only finance.
3. Textile KPIs: active rolls, metre balance, yard balance, remnants, reservations, quarantined
   rolls, pending cuts/dispatches, wholesale/retail sales and overdue receivables.
4. Vehicle KPIs: available/reserved/sold vehicles, capital tied up, ageing, preparation cost,
   unsettled sales and gross margin—financial values owner-only.
5. Cashier, manager, warehouse and owner see task-relevant panels only.
6. Onboarding disappears progressively when each real milestone is complete.

Acceptance:

- The first viewport answers “what needs attention?” and “what can I do now?”
- No dashboard contains equal-weight cards for every number.
- Empty, loading, stale, offline and error states are explicit.

## Phase 3 — Customers task-first restructuring

1. Mobile order: title/primary Add Customer action, search, compact type filter, customer list,
   then credit summary when relevant.
2. Move CSV and bulk messaging into responsive secondary/overflow actions.
3. Hide or collapse zero-only finance metrics for brand-new organizations.
4. Use distinct first-use, no-search-result and data-error empty states.
5. Make credit exposure and over-limit customers actionable rather than decorative totals.

## Phase 4 — Bills task-first restructuring

1. Mobile order: title/Create Sale, search/filter, invoice list/empty state, compact summary.
2. Keep Create Sale primary; Returns secondary; exports and Shop Details in overflow.
3. Explain disabled export actions rather than displaying apparently broken buttons.
4. Collapse filters behind a single control on narrow screens while keeping active-filter status
   visible.
5. Preserve pagination and full-dataset exports.

## Phase 5 — Textile POS operational redesign

1. Lead with scan/search roll, channel, customer, measured quantity and allocation—not totals.
2. When no rolls exist, show Receive First Roll immediately before passive metrics.
3. Keep a compact sticky cart/amount-due bar above the mobile safe area.
4. Make full-roll, wholesale-cut and retail-cut modes unmistakable.
5. Preserve metre/yard separation, dye-lot warnings, reservation rules, atomic checkout, mixed
   settlement and owner/manager price controls.
6. Optimize for fast counter use with minimal typing and barcode-camera testing.

## Phase 6 — mobile navigation and header

1. Reduce sticky mobile header height while preserving brand recognition and language switch.
2. Change trial copy to a concise status such as “14 days left in your trial”.
3. Add strong selected-route treatment and unique icons for Trade Control and Owner Intelligence.
4. Group navigation as Sell, Inventory, Operations, Finance and Management.
5. Put low-frequency settings/plans/sign-out actions in the drawer footer.
6. Evaluate a four-item mobile bottom navigation: Dashboard, Sales, Stock and More.
7. Ensure focus trapping, scroll lock, escape/close behavior and safe-area padding.

## Phase 7 — typography, localization and accessibility

1. Remove excessive body/button letter spacing; retain tracking only for short eyebrows.
2. Tune Sinhala font fallback, line height and control widths independently where required.
3. Complete WCAG 2.2 AA checks: contrast, keyboard order, visible focus, focus not obscured,
   accessible names, error association, status announcements and 320px reflow.
4. Test 200% text resize and 400% browser zoom/reflow.
5. Respect reduced-motion and do not rely on colour alone.

## Phase 8 — resilience and perceived performance

1. Add meaningful skeletons only where layout stability benefits; avoid fake progress.
2. Provide retryable failures with safe, specific copy.
3. Make cloud sync freshness, offline changes and reconciliation status understandable.
4. Test slow 4G, interrupted saves, duplicate taps and expired sessions.
5. Optimize long customer, invoice, product and roll collections with pagination/virtualization
   only where evidence supports it.

## Phase 9 — real workflow and visual QA

1. Create representative Vehicle and Textile organizations with owner, manager, cashier,
   salesperson and warehouse roles as applicable.
2. Test complete workflows with realistic data, not zero-only screenshots.
3. Textile journey: receive/import roll → reserve → cut/remnant → wholesale/retail sale → mixed
   payment/credit → dispatch → return → collection → owner report.
4. Vehicle journey: acquire → cost/preparation → list/reserve → sell → invoice → settle → banking
   reconciliation → margin report.
5. Capture desktop/tablet/390/360/320 screenshots for English and Sinhala.
6. Run accessibility, console, network, visual-regression and role-isolation checks.
7. Conduct observed task testing with real Pettah textile staff and vehicle-sales staff; record
   completion time, errors, assistance and recovery.

## Phase 10 — release certification and production promotion

1. Run lint, TypeScript, full tests and production build.
2. Validate Supabase migrations, RLS, advisors and data isolation.
3. Deploy a Vercel preview, test authenticated workflows and inspect runtime errors.
4. Document known limitations honestly.
5. Promote the exact verified artifact to production with a rollback target.

## Definition of done

“World-class” is not declared from screenshots. It is earned only when the interface is coherent,
fast and accessible; representative users complete critical tasks without coaching; role/data
boundaries hold; realistic datasets remain usable; and the exact deployed artifact passes the
full certification matrix.

---
