# LakBiz UI/UX Premium Polish — Audit

**Scope:** Focused UI/UX polish pass. Not a rebuild, no new business modules.
**Method:** Full-file code review of the shared component layer and the flagship
pages named in the brief. No browser/screenshot capability exists in this
sandbox (a standing constraint for this whole engagement) — visual QA below is
rigorous code-level inspection (computed classnames, layout structure, spacing
scale, breakpoints), explicitly **not** rendered screenshots. This is disclosed
here and again in the final report; nothing below is claimed as visually
verified in a browser.

Files read in full for this audit: `overlay.tsx`, `primitives.tsx`,
`pro-shell.tsx`, `form.tsx`, `table.tsx`, `icons.tsx`, `sidebar.tsx`,
`app-shell.tsx`, `mobile-nav.tsx`, `nav-sections.ts`, `jobs/page.tsx` (1216
lines — list + New/Edit drawer + Job Detail drawer), `login/page.tsx`,
`banking/page.tsx`, `landing-hero.tsx`, `globals.css`.

---

## 1. Root cause: two competing design systems

- **`pro-shell.tsx`** (older/heavier): `rounded-[2rem]`/`rounded-[1.5rem]`,
  heavy shadows, `font-black` on nearly all text (including body copy and
  table cells), gradient `ProStatCard` tiles, **emoji icons in
  `ProEmptyState`** (`✨`) and inline emoji used directly as stat-card icons
  (`🏦 🧾 📥 💸` on `banking/page.tsx`). Used by **22 pages**.
- **`primitives.tsx`** (newer/calmer): `rounded-xl`, subtle single borders,
  `font-semibold`/`font-medium`, no emoji, professional inline SVG icon set
  (`icons.tsx`). Its own header comment says it is explicitly meant to
  replace `pro-shell.tsx` page-by-page. Used by **10 pages**.
- Several pages **mix both systems in the same file** (e.g. `jobs/page.tsx`
  wraps `primitives.tsx` content in `pro-shell.tsx`'s `ProMain`/
  `ProLoadingState`), so even a single page's typography weight and radius
  scale is inconsistent top to bottom.

This is the single biggest driver of the "6.5–7/10, heavy, inconsistent"
impression: dark heavy headers, oversized empty states, ALL-CAPS/`font-black`
overuse, and emoji all trace back to `pro-shell.tsx`, and inconsistent
rounding/weight between pages traces back to the split itself.

**Decision for this pass:** per "not a rebuild," we do not migrate all 22
pages off `pro-shell.tsx`. Instead we fix `pro-shell.tsx`'s worst offenders
*at the component level* (de-emoji `ProEmptyState`, tone down `font-black`
default, add compact empty-state sizing) so all 22 pages benefit immediately,
and we apply full primitive-based treatment only to the flagship pages named
in the brief (AC Jobs, Banking, Login). This matches "fix shared primitives
first, then apply thoroughly to a flagship set rather than shallow touches
everywhere."

---

## 2. Shared-component findings

### `overlay.tsx` (Drawer/Dialog)
- Structurally **already correct** for sticky header/footer: header and
  footer are flex siblings of the scrollable body (`flex-1 overflow-y-auto`),
  not inside the scroll container. The "drawer buttons get clipped" symptom
  the brief describes is not reproducible from this component's own layout —
  it's more likely page-level (e.g. Banking's *hand-rolled* modals below,
  which don't use this component at all).
- Gaps vs. spec: no size-variant prop (only free-form `widthClassName` per
  call site → inconsistent widths across pages), no status-badge header slot,
  no mobile full-screen behavior, no real focus trap (`useOverlayLifecycle`
  only handles Escape + body scroll lock + focus restore — Tab can escape the
  drawer to the page behind it), no unsaved-changes-aware close guard (overlay
  click / Escape close unconditionally even mid-edit).
- **Action:** extend in place — add `size: "sm"|"md"|"lg"|"xl"`, `statusBadge`
  slot, `confirmClose` guard prop, mobile full-screen breakpoint, real focus
  trap in `useOverlayLifecycle`. This is enhancement, not a rebuild.

### `primitives.tsx`
- `ActionMenu` already exists and already works (click-outside + Escape) —
  directly reusable for the spec's "More ▾" pattern; no new component needed.
- `EmptyState` has one fixed size (`px-6 py-10`) — needs `size:
  "compact"|"standard"` variant for Part 8/9.
- `SectionHeader` forces `uppercase` unconditionally — needs a non-uppercase
  variant so it isn't used as the default for section titles that should read
  as normal-case hierarchy (Part 10).
- No shared `Button` component exists yet — every page hand-rolls button
  classes (`ProButton` in pro-shell, ad hoc classes elsewhere). Part 3 needs
  one shared component with Primary/Secondary/Ghost/Destructive/Text/Icon
  variants.

### `pro-shell.tsx`
- `ProEmptyState` icon defaults to `"✨"` — literal emoji in production UI,
  directly against the brief's "avoid emoji icons" instruction. Also fixed
  large padding (`py-12`), no compact variant.
- `ProButton`, `ProCard`, `ProStatCard` all default to `font-black`, which
  reads as shouty at body-copy sizes — appropriate for large stat numbers,
  not for card titles/labels/table cells (`banking/page.tsx` uses
  `font-black` even for ledger rows and cheque numbers).

### `table.tsx` (`DataTable`)
- Already implements exactly what Part 6 (Cards|List toggle) needs: desktop
  table that degrades to stacked mobile cards, with `hideOnMobile` per
  column, click/keyboard row activation, focus-visible outline. **Directly
  reusable** for the AC Jobs list view — no new table component needed.

### `icons.tsx`
- Clean, consistent, hand-rolled SVG set, explicitly documented as the
  "no emoji as primary production icons" direction. No issues found. Good
  baseline already in place across the app (nav icons, action icons).

### `mobile-nav.tsx`
- Solid slide-out drawer: body-scroll lock, closes on route change, `aria-
  label`s present, active-state styling matches desktop sidebar. Minor gap:
  same missing-focus-trap issue as `overlay.tsx` (shares no code with it —
  duplicated pattern, not called through `useOverlayLifecycle`). Not a
  blocking issue for this pass; noted for parity once `overlay.tsx`'s trap
  lands.

### `nav-sections.ts` / `sidebar.tsx`
- The brief's specific label-truncation example ("Installation & Maintenance
  Teams" → "Field Teams") is **already resolved** in code —
  `nav.field_teams` = "Field Teams" in `translations.ts`, and section
  grouping (Sales/Inventory/Service/Finance/Management) already matches the
  brief's target structure closely. `sidebar.tsx` already applies `truncate`
  to org name/email in the footer block. No structural redesign needed here;
  only a light consistency pass (spacing/icon sizing) is warranted, and this
  finding should be called out rather than re-solving an already-solved
  problem.
- "Bills" → "Invoices" rename: `nav.bills` currently drives the Sales-section
  supplier/customer **bills** module, which in this codebase means purchase
  bill capture (money owed to suppliers), not sales invoices — renaming would
  make it *less* accurate, not more. Recommend **not** renaming.

### `form.tsx`
- `FormField`, `TextInput`, `MoneyInput` (Rs. prefix + 2-decimal regex),
  `DateInput`, `SelectInput` are functional and reasonably consistent already.
  The gap is entirely at the page level — `jobs/page.tsx`'s create/edit form
  doesn't group these into sections at all (see below).

---

## 3. Page-specific findings

### AC Jobs (`jobs/page.tsx`, 1216 lines — list, New/Edit drawer, Job Detail drawer)

- **Filters:** two always-visible `FilterBar` blocks (job-type pills +
  status pills), ~13+ individual pill buttons rendered inline with no shared
  chip/segmented-control component — exactly the "too many chips" complaint.
  No search input, no assigned-team filter, no sort, no card/list toggle.
- **Job cards:** dark `bg-slate-900` header block per card; body can render
  **7-8 simultaneous action buttons** (Call, message-customer, notify-
  assignee, Service-done/Mark-installed/Complete (status-conditional), Job
  sheet, Edit, Delete) with no grouping — the literal "6-8 equal buttons"
  problem. Metrics grid (Quote/Deposit/Balance/Subcontract/Margin) is
  reasonable but competes visually with the header weight.
- **New/Edit Job drawer:** single flat `<form className="space-y-4">` — job
  type, customer, contact, address, equipment, units, quote/deposit,
  assignee, status/schedule, complaint, diagnosis, notes, then two
  `bg-slate-50` boxes for service-interval/service-due, then AMC checkbox —
  ~20 sequential fields with zero section grouping. This is the literal
  "continuous list of inputs" complaint. Footer already correctly wires
  `form="job-form"` to an external submit button (good pattern, keep it).
- **Job Detail drawer (`JobSheetDrawer`):** already tabbed
  (Overview/Parts/Labor/Economics/Invoice) via the shared `Tabs` component —
  structurally close to the spec already. Gaps: no status-badge in the
  header (Drawer doesn't support the slot yet), top action row has
  Invoice/Call/Navigate but no "More" menu despite `ActionMenu` already
  existing, financial summary shows Quote/Material/Labor/Net-profit but not
  Collected/Balance, Overview tab is a flat single-column list rather than a
  two-column property layout, status history lives inside Overview rather
  than a separate History tab.
- **List view:** does not exist at all today — grid-of-cards only. `table.tsx`
  already provides everything needed to add one.

### Banking (`banking/page.tsx`)

- **Three separate `ProEmptyState` blocks** (accounts / transactions /
  cheques), each with full padding and its own icon+title+description —
  exactly the "3 giant empty states" complaint, confirmed in code.
- **`ProStatCard` icons are literal emoji** (`🏦 🧾 📥 💸`) — the clearest,
  most direct instance of the "no emoji icons" violation in the whole
  codebase.
- **Does not use the shared `Drawer`/`Dialog` component at all.** All four
  modals (Add account / Record transaction / Transfer / Add cheque, plus a
  fifth for cheque status update) are hand-rolled
  `fixed inset-0 z-50 ... backdrop-blur-sm` overlays with a manual `✕`
  close button — no Escape handling, no focus trap, no body-scroll lock, no
  unsaved-changes guard, and `rounded-[2rem]` differs from the Drawer's
  `rounded-xl`. This is a second, independent implementation of "modal" that
  the Part 1 Drawer rebuild will not automatically fix — Banking needs to be
  migrated onto `Dialog`/`Drawer` directly for Part 1's guarantees to apply
  here at all.
- Ledger/cheque tables use `font-black` throughout, including on data cells
  (dates, descriptions), reinforcing the shouty-typography finding.

### Login (`login/page.tsx`)

- Already close to the brief's suggested layout: `SiteHeader` (not full app
  nav) + centered card, admin-login mode already visually distinct
  (`slate-950` theme, separate copy), already has a "Need access? Contact
  LakBiz" message, already has a signed-in-state banner
  (`SignedInBanner`) with sign-out/continue affordances. This page is in
  much better shape than the brief assumes — needs polish (spacing,
  radius/shadow consistency with the rest of the redesigned surfaces,
  tab-toggle visual weight), not a structural redesign.

### Landing (`landing-hero.tsx`, `globals.css`)

- Already reasonably premium: mesh-gradient hero, glass-morphism stat tiles,
  a device-preview mockup card, one primary CTA + one secondary CTA. Not the
  "generic AI-website" the brief worries about. Minor: the preview mockup's
  "Live" badge next to static illustrative numbers could be softened to
  avoid any reading as a real live data claim — recommended copy tweak, not
  a required fix. No major restructuring needed for this pass; a lighter
  typography/spacing consistency pass is enough here.

---

## 4. Proposed changes (this pass)

**Shared primitives (fix once, benefit everywhere):**
1. `overlay.tsx` — size variants (sm/md/lg/xl), status-badge slot, mobile
   full-screen sheet, real focus trap, unsaved-changes-aware close guard,
   new `DrawerFooter` convention (Cancel · optional Save draft · Primary).
2. New shared `Button` component (`primitives.tsx`) — Primary/Secondary/
   Ghost/Destructive/Text/Icon variants, consistent sizing/radius.
3. `EmptyState` — add `size: "compact"|"standard"`, keep icon set
   emoji-free (already true here).
4. `ProEmptyState` — remove emoji default, add compact sizing, so all 22
   `pro-shell` pages improve without individual edits.
5. `SectionHeader` — add non-uppercase variant.

**Flagship pages (full treatment):**
6. AC Jobs — sectioned New/Edit form; card redesign (lighter header,
   consistent height, primary actions + "More ▾" via `ActionMenu`); simplified
   filter toolbar (search/type/status/team/sort, mobile "Filters" sheet);
   Cards|List toggle using `DataTable`, remembered in `localStorage`; Job
   Detail drawer gets status badge, More menu, Collected/Balance in summary,
   two-column Overview.
7. Banking — migrate all 5 modals onto `Dialog`; collapse the 3 empty states
   into 1 compact onboarding block when there is no data at all; drop emoji
   stat-card icons for the SVG icon set; reduce `font-black` on data rows.
8. Login — spacing/radius/shadow consistency pass to match the redesigned
   surfaces; no logic changes.
9. Sidebar — light spacing/icon consistency pass only; no relabeling beyond
   what's already correct.
10. Landing — light typography/spacing consistency pass only.

**Out of scope for this pass** (explicitly deferred): full migration of all
22 `pro-shell` pages to `primitives.tsx`; Parts/Materials business features;
any new database/business logic.

---

## 5. Responsive concerns (code-level, breakpoints 1440/1366/1280/1024/768/430/390/375)

- Banking's 5 hand-rolled modals use `max-w-2xl`/`max-w-md` with `p-4` outer
  padding and `max-h-[90vh] overflow-y-auto` on the *whole* dialog (header +
  form + footer all scroll together) — on short mobile viewports (667px and
  below, i.e. most phones in landscape or with a browser chrome bar) the
  Save/Cancel row can scroll out of view. This is the real mechanism behind
  the brief's "clipped drawer buttons" complaint, and it's exactly what
  moving these onto the real `Dialog` (sticky footer) fixes.
- AC Jobs' `xl:grid-cols-2` card grid and metrics `grid-cols-2 sm:grid-cols-3`
  are fine down to 375px (both is `grid`, no fixed widths found), but the
  7-8-button action row will wrap awkwardly on narrow phones — direct
  consequence of the button-count finding, fixed by moving secondary actions
  into `ActionMenu`.
- `DataTable`'s existing mobile-card fallback (`sm:hidden`) is already
  responsive-correct — reusing it for the new List view carries that
  correctness forward for free.
- No horizontal-scroll-causing fixed widths were found in the reviewed
  files (Banking's `sm:grid-cols-2 lg:grid-cols-3` modal grids and Jobs'
  drawer `max-w-2xl` are both relative/capped, not fixed-px).

## 6. Accessibility concerns (code-level)

- Banking's 5 hand-rolled modals: no `role="dialog"`, no
  `aria-modal="true"`, no labelled-by, no focus trap, no Escape-to-close,
  close button is a bare `✕` glyph with no `aria-label`. All fixed by the
  `Dialog` migration.
- `overlay.tsx`'s Drawer/Dialog: Escape and focus-restore already work;
  missing a real focus trap (Tab can leave the dialog) — to be added.
- AC Jobs card action buttons: several are icon-adjacent text buttons with
  clear labels already (good); status is always paired with text labels, not
  color alone (`StatusBadge`/`ProBadge` render text, not just a colored dot) —
  no color-only-status violations found in the reviewed files.
- Form inputs in `form.tsx` (`TextInput`, `MoneyInput`, etc.) already use
  `<FormField>` wrapping with an associated `<label>` — no orphaned inputs
  found in the reviewed components. Banking's inline modal inputs, by
  contrast, use bare `<input>`/`<select>` with `placeholder` only, no
  `<label>` — a real gap, fixed as part of the `Dialog` migration (labeled
  fields, matching `form.tsx` conventions).

---

*Audit complete. Proceeding to implementation per section 4, shared
primitives first.*
