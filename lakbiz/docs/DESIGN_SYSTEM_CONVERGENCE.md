# LakBiz Design System Convergence — Global Premium UI Phase

Re-audit of the design-system split Phase A (`docs/UI_POLISH_AUDIT.md`)
first identified, plus the canonical token system this phase converges
toward. Written before any code change, per this phase's own audit-first
requirement. Files read in full for this pass: `primitives.tsx`,
`pro-shell.tsx`, `overlay.tsx`, `form.tsx`, `icons.tsx`, `table.tsx`,
`sidebar.tsx`, `login/page.tsx`, `sign-out-button.tsx`, plus a full grep
sweep of every `page.tsx` for which primitive system it imports.

**Screenshots/mockups disclosure:** the task brief references screenshots
of the current state and proposed mockups as attachments — none were
actually attached to the message that started this phase. Every finding
below is from reading the actual component/page source, the same
code-level method Phase A used (and disclosed identically) — not from
images that don't exist in this session. If mockups exist and are shared
later, this doc's "target quality" section can be revisited against them
without redoing the underlying audit.

---

## 1. What changed since Phase A's audit

Phase A's audit (`UI_POLISH_AUDIT.md`) found 22 pages on `pro-shell.tsx`
and 10 on `primitives.tsx`, several mixing both. Phase A itself, plus the
HVAC job-parts phase (PR #78, unmerged — see branch-strategy note in
`UI_ROUTE_INVENTORY.md`), migrated several pages' *content* onto
`primitives.tsx` while leaving `pro-shell.tsx`'s `ProMain`/
`ProLoadingState`/`ProEmptyState` as the outer page-shell wrapper (a
deliberate, disclosed choice — see Phase 1's note in
`IMPLEMENTATION_PROGRESS.md`: "pro-shell.tsx itself is untouched; pages
migrate off it page-by-page in later phases, not in one sweep").

Current split, re-measured directly against the repository at commit
`7d66103`:

### Pages still using the *heavy* `pro-shell` components
(`ProCard` / `ProStatCard` / `ProPageHeader` / `ProButton` / `ProBadge` —
`rounded-[1.5rem]`–`rounded-[2rem]`, `shadow-lg`/`shadow-xl`,
`font-black`, gradient stat tiles):

`banking`, `bills`, `bills/[id]`, `jobs/[id]/invoice`, `sales`,
`settings/plans`, `settings/shop`, `settings/team`, `suppliers`, `vat`,
`vehicles`, `workforce` — **12 pages.**

### Pages on the light `primitives.tsx` system
(only `ProMain`/`ProLoadingState`/`ProEmptyState` from `pro-shell.tsx` as
outer shell — content is `PageHeader`/`MetricCard`/`DataTable`/`Drawer`/
`Dialog`/`FormSection`/`Button` etc.):

`jobs`, `teams`, `assets`, `customers`, `expenses`, `schedule`, `reports`,
`dashboard`, `job-costing`, `stock` — **10 pages.**

### Neither (own bespoke shell, not app-shop chrome)
`login`, `sectors`, `sectors/[id]`, `/` (landing) — public pages, out of
the shop-shell system entirely by design; addressed separately in Stage 5
(login) and Stage 6 (landing).

### Remaining production emoji icons
Confirmed by direct unicode-range search of `src/app` + `src/components`
(not the earlier report's word — verified again now): exactly the same
**6 files** Phase A flagged as a known, disclosed gap remain unfixed —
`vat`, `workforce`, `sales`, `suppliers`, `vehicles`, `bills` all still
pass an emoji literal into a `ProStatCard`'s `icon` prop at the call site.
`ProEmptyState`'s own default icon (the `✨` Phase A replaced) has not
regressed — confirmed clean. A broader sweep also found emoji in
`translations.ts`, `sectors.ts`, `messaging/templates.ts`,
`admin/templates.ts`, `message-composer.tsx`,
`bulk-whatsapp-composer.tsx`, `ac-job-reminder-timeline.tsx`, and the
landing components — these need individual triage during
implementation (WhatsApp message *content*/templates are legitimate
user-facing text, not a "production icon," and are explicitly allowed by
Part 28: "Emoji may appear only as actual user-generated/content data
where appropriate"; each will be checked against that line, not
blanket-stripped).

---

## 2. Token comparison — why the two systems visually clash

| Token | `primitives.tsx` (calmer, newer) | `pro-shell.tsx` (heavier, older) |
|---|---|---|
| Button radius | `rounded-lg` (8px) | `rounded-2xl` (16px) |
| Button weight | `font-semibold` | `font-black` |
| Button shadow | none (border-based) | `shadow-lg shadow-teal-700/20` |
| Card radius | `rounded-xl` (12px) | `rounded-[1.5rem]`–`rounded-[2rem]` (24-32px) |
| Card shadow | none / hairline border | `shadow-lg shadow-slate-950/5` + `ring-1` |
| Card extra | — | `backdrop-blur-xl` on the page-header card (glassmorphism) |
| Badge shape | `rounded-md`, `font-medium` | `rounded-full`, `font-black` |
| Empty state | compact, SVG icon, one CTA | `rounded-2xl`, larger icon box |

This is the exact mismatch Part 3 (Global Visual Tokens) and Part 6
(Cards) ask to resolve: two visually different applications sharing one
codebase. `primitives.tsx`'s values already sit close to this phase's
target token scale (radius 6-12px, sparse shadow) — so **`primitives.tsx`
is the convergence target, `pro-shell.tsx`'s heavy components move toward
it**, not the reverse. This matches Part 2's explicit instruction: fix
shared primitives first, don't reinvent a third system.

---

## 3. Canonical design tokens (this phase)

### Color
- **Primary (teal):** `teal-600` (`#0d9488`) for filled primary actions,
  selected nav, active tab; `teal-700` for hover/pressed. Reserved for
  primary emphasis — not a decorative fill.
- **Neutral background:** `slate-50` (very pale cool gray) for page
  background (`AppShell`'s `<main>` already uses this).
- **Surfaces:** white (`bg-white`).
- **Primary text:** `slate-900` (near-black, not pure `#000`).
- **Secondary text:** `slate-500`/`slate-600`.
- **Borders:** `slate-200` (`slate-300` for form control borders, matching
  `form.tsx`'s existing convention).
- **Semantic** (status/feedback only, never decorative): success
  `emerald-600`/`emerald-50`, warning `amber-600`/`amber-50`, destructive
  `rose-600`/`rose-50`, informational `blue-600`/`blue-50`.

### Radius
- Buttons, inputs, nav items: `rounded-lg` (8px) — already
  `primitives.tsx`'s `Button`/`form.tsx` default; `pro-shell.tsx`'s
  `ProButton` (`rounded-2xl`) converges down to this.
- Small cards / badges: `rounded-md`–`rounded-lg` (6-8px).
- Major panels / KPI cards: `rounded-xl` (12px) — `primitives.tsx`'s
  existing `MetricCard`/generic card default; `pro-shell.tsx`'s `ProCard`
  (`rounded-[1.5rem]`–`[2rem]`) converges down to this.
- Drawers/dialogs: `rounded-t-xl`/`rounded-xl` at the sheet edges,
  unchanged from `overlay.tsx`'s existing implementation (already correct
  per Phase A's audit).

### Shadow
- Default: border only, no shadow (`primitives.tsx`'s existing pattern).
- Sparse elevation allowed for: overlays, floating menus (`ActionMenu`'s
  existing `shadow-lg` on its popover — correct, keep), drawers/dialogs
  (`overlay.tsx`'s existing shadow — correct, keep).
- Removed: `ProCard`/`ProStatCard`/`ProPageHeader`'s `shadow-lg`/`shadow-xl`
  ambient shadow on ordinary page surfaces, and the page-header card's
  `backdrop-blur-xl`.

### Typography
- Page title: `text-2xl font-bold text-slate-900` (matches
  `PageHeader`'s current weight — not `font-black`).
- Section/card heading: `text-sm font-semibold uppercase tracking-wide
  text-slate-500` for eyebrow labels (compact, already used by
  `MetricCard`); `text-base font-semibold text-slate-900` for card titles.
- Body: `text-sm text-slate-700`, default line-height.
- Money: `font-mono tabular-nums` where already used (`formatLkr`
  call sites in the migrated pages) — extend to the 12 pages still on
  `pro-shell.tsx` as they converge, so every LKR figure in the product
  scans with the same fixed-width digit rhythm.
- Uppercase reserved for eyebrow labels and compact metadata only —
  `pro-shell.tsx`'s current `font-black` body/table-cell text (Phase A's
  own finding, still true) is the main offender to fix.

### Spacing
Standardize on the 4/8/12/16/20/24/32/40/48px scale already implicit in
Tailwind's default spacing tokens (`primitives.tsx` and `form.tsx` already
follow this; `pro-shell.tsx`'s `p-5`/`p-6`/`p-7` mix on the same component
is the inconsistency to remove).

---

## 4. Convergence strategy (Part 2's "preferred approach")

1. **Fix shared primitives first** (Stage 1): tone down `pro-shell.tsx`'s
   `ProButton`/`ProCard`/`ProStatCard`/`ProBadge`/`ProPageHeader` to the
   token scale above, *without changing their prop APIs* — every one of
   the 12 pages still importing them gets the calmer look with zero
   per-page changes, the same leverage Phase A got from de-emoji-ing
   `ProEmptyState` once.
2. **Migrate selectively where structure also needs to improve** (Stages
   3-4): AC Jobs/Job Detail (already on `primitives.tsx`, needs the
   *layout* changes Part 11-16 ask for, not a system swap), Dashboard
   (already migrated, needs the KPI/Today's Operations restructuring in
   Part 9), then the highest-value remaining `pro-shell` pages (Banking,
   Sales/Bills, VAT, Suppliers, Workforce, Vehicles) get full
   `primitives.tsx` migrations where Part 27's per-page audit finds a
   structural reason to, not merely to "finish the migration" for its own
   sake.
3. **No third design system.** Every new pattern this phase needs (KPI
   card vs. operational panel vs. entity card vs. alert row — Part 6's
   card taxonomy) is expressed as new, narrowly-scoped components inside
   `primitives.tsx` (or a sibling file re-exporting from it), never a
   parallel set of `Card2`/`Panel2`-style components.

---

## 5. Sidebar / navigation baseline

`sidebar.tsx` (119 lines) already implements the grouped-section
structure Part 4 asks for (Overview/Sales/Inventory/Service/Finance/
Management, role- and subscription-filtered via `use-shop-nav.ts`) — this
matches Part 4's own instruction ("the sidebar structure is fundamentally
correct, do not radically restructure it"). This phase's sidebar work is
therefore visual refinement (icon stroke/size consistency, active-state
polish, spacing) against the token scale above, not a rebuild.

---

## 6. Files this phase will touch, roughly in the Part 45 stage order

- **Stage 1:** `pro-shell.tsx` (token convergence), `primitives.tsx`
  (new card taxonomy variants, table polish primitives), `overlay.tsx`
  (verify sticky footer/mobile safe-area, already close per Phase A).
- **Stage 2:** `sidebar.tsx`, `mobile-nav.tsx`, `icons.tsx` (button
  system + card audit fixes surfaced while touching shared chrome).
- **Stage 3:** `dashboard/page.tsx`, `jobs/page.tsx` (Job cards/list/
  detail drawer/Parts UI — preserving every PR #78 behavior).
- **Stage 4:** the 12 remaining `pro-shell`-heavy pages, per-page audit
  in Part 27.
- **Stage 5:** `login/page.tsx`, `sign-out-button.tsx` (the lingering
  signed-in-banner fix, Part 19/35 — root cause confirmed below).
- **Stage 6:** `page.tsx` (landing), `landing-hero.tsx`,
  `landing-sections.tsx`, `landing-sectors.tsx`, `marketing-header.tsx`.
- **Stage 7-8:** responsive/accessibility pass + regression tests across
  all of the above, no new files.

### Login lingering-banner root cause (confirmed, fixed in Stage 5)

`login/page.tsx` renders `<SignedInBanner>` (from `sign-out-button.tsx`)
whenever `user && !authLoading` — with **no timer and no auto-redirect**
— directly above the still-fully-rendered sign-in/sign-up form. Visiting
`/login` while already authenticated currently shows the banner *and* the
complete tabbed form below it indefinitely, exactly the "stale
Signed-in-as banner" + "full login form unnecessarily below it" bug Part
19 describes. The post-submit sign-in path already navigates immediately
via `window.location.assign(destination)` with no lingering message — that
half is correct today. Stage 5 fix: replace the "already signed in" render
branch with the compact `Continue to Dashboard` / `Sign out and use
another account` card Part 19 specifies, and hide the form entirely in
that state.

---

## 7. Stage 2 findings — sidebar/nav/table/form/badge audit

Read in full before changing anything, per this phase's own discipline:

- **`icons.tsx`** — already fully consistent (Part 4's "icons consistent
  in stroke/size"): every icon composes through one shared `base()`
  factory (24x24 viewBox, 1.75 stroke weight, `currentColor`). No change
  needed or made.
- **`table.tsx` (`DataTable`)** — already satisfies most of Part 29:
  consistent header height, row hover, keyboard-accessible clickable rows
  with a real focus-visible ring, right/center/left column alignment,
  `emptyState` support, responsive mobile card fallback, minimal grid
  lines (row dividers only, no vertical rules). **Deliberately not
  changed:** generic header-click-to-sort with a visual indicator.
  Retrofitting that onto the shared component would change behavior for
  every existing consumer; the pages that need sorting today already use
  a consistent dropdown-based sort selector (job-costing, etc.), which
  already satisfies "sortable where supported" without a structural
  change. Documented as a conscious deferral, not an oversight.
- **`jobStatusClass`/`jobStatusLabel` (`ac-jobs.ts`)** — already exactly
  the semantic grouping Part 31 asks for (neutral=slate, informational=
  blue, positive-operational=teal, needs-attention=amber, success=
  emerald, destructive=red) — not a unique color per status. No change
  needed.
- **`form.tsx` control height** — measured: `py-2` (8px) + `text-sm`'s
  20px line-height + 2px border ≈ 38px, under the 40-44px target.
  Changed to `py-2.5` (10px) ≈ 42px, inside the target range and close to
  the 44px+ mobile touch-target guidance, applied once to the shared
  `inputClass` so every `TextInput`/`MoneyInput`/`DateInput`/
  `SelectInput` gets it at once.
- **`sidebar.tsx` / `mobile-nav.tsx` account block** — added an avatar-
  initials badge (new `initialsFor()` helper, `src/lib/format.ts`,
  tested) per Part 4's "organization/avatar initials." No separate user
  display-name field exists anywhere in this app's auth model (checked
  `auth-provider.tsx` — only `email` is carried) — org name stays the
  shown identity, initials derive from it with an email-initial fallback,
  never a fabricated name. Also fixed `mobile-nav.tsx`'s nav-item/account-
  card radius (`rounded-xl` → `rounded-lg`), which had drifted from
  `sidebar.tsx`'s own `rounded-lg` — same control, two different radii,
  exactly the token-inconsistency this phase converges away.
- **Global `:focus-visible` styling** — considered and **deliberately not
  changed** this stage. No `outline` reset exists anywhere in
  `globals.css`, so native browser focus-visible outlines are intact
  everywhere (a real, working baseline, not a gap) — several components
  (`table.tsx`'s row focus ring, `form.tsx`'s `focus:ring-2`) already
  layer their own on top. A blanket global override risks colliding with
  those existing per-component styles in ways that need a careful,
  individual look, not a one-line global change — deferred to Stage 7
  (accessibility cleanup) where that audit actually happens.
- **`globals.css` landing utilities** (`.lak-glass`, `.lak-mesh`,
  `.lak-shine`, `.lak-float`) — found during this pass, explicitly
  **out of scope for Stage 2**: translucent-blur/gradient/floating-
  animation utilities used only by the landing page, which directly
  match Part 48's "avoid excessive glassmorphism/gradients" and Part 32's
  "no bouncy/large-scale animation." Flagged here for Stage 6 (landing
  redesign) to resolve, not touched now since Stage 2 is shared shop-app
  chrome, not the public landing page.
