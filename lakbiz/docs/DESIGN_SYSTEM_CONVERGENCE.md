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

---

## 8. Stage 3 findings — Dashboard + AC Jobs + Job Detail Drawer

Read `dashboard/page.tsx` (928 lines) and `jobs/page.tsx` (2150+ lines)
in full before changing anything. Both were already close to Part 9-16's
target — this stage is real, verified refinement, not a rebuild:

**Dashboard (Part 9-10)** — already matched almost exactly: header with
shop name/date/cloud-sync indicator, +New Sale/+New Job primary actions
with everything else under "…", exactly 4 KPI metrics, a dominant Today's
Operations table, a genuinely compact "Needs Attention" list that only
ever shows active alerts (never a zero), a collapsible Financial
Snapshot, a real dual-series trend chart, and an onboarding empty state
with the 1-2-3 numbered-steps pattern the brief describes almost
verbatim. Changes made:
- Today's Operations table gains an Amount column (financial-gated) —
  the one genuinely missing field from Part 9's column list. A "Due"
  column was deliberately not added: `stats.todayJobs` is already
  filtered to `scheduledDate === today`, so a due-date column on an
  already-today-only list would repeat "today" on every row.
- Teams Today cards gain an avatar-initials badge (Part 9's "initials or
  uploaded staff avatars, don't require photography"), reusing Stage 2's
  `initialsFor()`.
- Onboarding copy aligned to the brief's suggested wording ("Welcome to
  LakBiz" / "Complete these steps to activate your business workspace.")
  in both locales.
- Not changed, deliberately: trend arrows on the KPI cards ("when
  historical comparison exists, show a small trend"). Real day-over-day
  comparison needs a new calculation in `getDashboardStats()`, not a UI
  change — noted as a scoped follow-up rather than rushed in as a
  UI-only stat that risks being wrong.

**AC Jobs (Part 11-13)** — the KPI strip (Pending/Scheduled/Service
Due/Quoted Value), the search+dropdown filter toolbar with a mobile
sheet, and the Cards|List toggle already matched Part 11 precisely. The
JobCard (Part 12) already carried every field the brief lists and a
sound primary/secondary/overflow button hierarchy. Changes made:
- `AcRemindersBanner` rewritten around the new `AlertRow` primitive:
  was a 3-line bordered box when SMS reminders were off and rendered
  *nothing* when on; now always shows one honest compact line ("SMS
  reminders off" + Enable, or "SMS reminders on" + Manage) — matching
  Part 11's explicit example almost verbatim.
- `AcInAppAlertSettings` (3 checkboxes + a day-count select) was
  permanently inline on the main page whenever the in-app-alerts feature
  was on — exactly the "detailed reminder configuration" Part 11 says to
  move out of the main page. Now opens from a small "Alert settings"
  trigger button into a Dialog; the component itself is unchanged
  content, only where it mounts changed. (Also found and fixed in
  passing: this component still had Phase-A-era `rounded-2xl`/
  `font-black` styling that Stage 1's pro-shell.tsx sweep couldn't have
  caught, since it isn't part of pro-shell.tsx or primitives.tsx — a
  reminder that Part 27's later per-page audit needs to look at
  standalone feature components too, not just the page files themselves.)
- Both JobCard's overflow menu and the list view's row actions gained an
  "Invoice" item (Part 12/13 both list it) — previously the only path to
  a job's invoice was opening the Job Sheet drawer first.
- List view gained an Equipment column (Part 13's explicit column list)
  showing description + BTU, `hideOnMobile` like Scheduled/Team.

**Job Detail Drawer (Part 14)** — tabs (Overview/Parts & Materials/
Labor & Other Costs/Job Economics/Invoice & Payment) and the
canSeeFinancials-gated financial summary row already matched. History is
folded into the Overview tab rather than split into its own tab — a
deliberate, pre-existing choice (a short status-change timeline reads
naturally as part of "overview"), not changed this pass. One real,
measured fix: the shared `xl` Drawer size (`overlay.tsx`, used only by
this drawer) was a *fixed* `sm:max-w-4xl` (896px) — not viewport-relative
despite reading as one. On a 1440px screen that's 62% of the viewport;
on a common 1366px laptop, 66% — both well past Part 14's 48-55% target.
Changed to `sm:w-[clamp(520px,52vw,896px)]`: 52% on any viewport in
between, the same 896px ceiling for ultra-wide monitors, floored at
520px so a narrower `sm:`-range viewport (tablet landscape) doesn't get
squeezed by a pure percentage.

**Parts & Materials / fast part-entry (Part 15-16)** — not touched this
stage: already rebuilt in the job-parts-materials phase (PR #78) against
column and fast-entry requirements nearly identical to this brief's
(Item/Source/Qty/Cost/Sell/Total/Warranty/Actions;
Job→Parts→+Add Part→From Stock/Manual/Purchased→Qty/Cost/Charge→
Replacing?→Disposition/Warranty→Save, all under the ~15-20s target — see
that phase's own commits). Re-verified present and unchanged, not
re-built.

---

## 9. Stage 4 findings — remaining emoji icon removal (Part 28)

Confirmed via direct unicode-range search (not re-asserting Phase A's
list from memory): the same 6 pages Phase A flagged still carried a raw
emoji `ProStatCard` icon — `vat`, `workforce`, `sales`, `suppliers`,
`vehicles`, `bills`. Every one replaced with a real SVG icon from
`icons.tsx`, matched to what the stat actually represents (e.g.
`AlertTriangleIcon` for vehicles' "60+ days in yard" aging stat,
`InboxIcon` for suppliers' outstanding-payable stat) — not a generic
placeholder glyph reused everywhere.

Broader sweep also found — and fixed, since it's the same underlying
issue — a second, larger emoji source: `SectorTemplate.icon` (grocery
🛒, electronics 📱, electricals ⚡, spare_parts 🔧, ac_hvac ❄️, car_sales
🚗), rendered in 6 places across the app: the sector picker (shop
signup), the public `/sectors/[id]` page, the landing page's
`SectorCard`, the platform-admin shop-creation template picker, the
platform-admin shops list, and `product-form.tsx`'s locked-sector
display.

- Added 3 new icons to `icons.tsx` (`CartIcon`, `DeviceIcon`,
  `BoltIcon`) for grocery/electronics/electricals — the other three
  sectors already had an exact-shape match: `AssetIcon` (wall-mount AC
  unit) for `ac_hvac`, `JobsIcon` (wrench) for `spare_parts`,
  `VehiclesIcon` for `car_sales`.
- New `sector-icon.tsx`: a `SECTOR_ICON_BY_ID` lookup (same convention
  as `NAV_ICON_BY_HREF`) behind a `<SectorIcon sectorId />` component,
  used at all 6 render sites.
- `SectorTemplate.icon` (a raw emoji string) removed from the type and
  every entry in `sectors.ts` — icon choice now lives in one place
  (`sector-icon.tsx`) instead of being data the sector list carried
  around.
- Found in passing while fixing this: `BusinessTemplate.icon`
  (`lib/admin/templates.ts`) was a *second*, independently-hardcoded
  emoji per template — redundant with the `sectorId` every template
  already carries, and could in principle drift from the sector's own
  icon (they happened to always match, but nothing enforced that).
  Removed the field entirely from the type, the 6 seed entries, and
  both places that backfilled it (`getTemplate`,
  `templateFromDbRow`) — the one remaining UI consumer (the
  platform-admin shop-creation template picker) now derives its icon
  from `template.sectorId` via `<SectorIcon>`, the same single source
  of truth as everywhere else.
- `admin/shops/page.tsx`'s shop list had an `sector?.icon ?? "🏪"`
  fallback for an unresolvable/legacy sector id — kept the same
  fallback *behavior* (a generic icon when the sector can't be
  resolved) but swapped the emoji for `ShopIcon`.

Verified zero remaining emoji `icon=` props anywhere in `src` (unicode-
range search), and zero emoji characters in the built static HTML for
every page touched this stage.

Verification: tsc clean, eslint clean, 89/89 tests passing, production
build succeeds (all 6 `/sectors/[id]` static params still generate),
same 41-route list.

---

## 10. Stage 4 findings — per-page typography/radius/shadow sweep

A count across the 12 pages still on `pro-shell.tsx` found `font-black`,
`rounded-[2rem]`/`rounded-[1.5rem]`, and `shadow-2xl` used **as literal
page-level Tailwind classes**, not inherited from the shared
`pro-shell.tsx` components Stage 1 already converged — meaning Stage 1's
fix, while real, didn't touch this: 288 `font-black` occurrences and 24
`rounded-[2rem]`/`rounded-[1.5rem]`/`shadow-2xl` occurrences, spread
unevenly (suppliers and workforce carried the most). This confirms these
12 pages are largely untouched since a much earlier, heavier design era
— exactly Part 27's "do not assume a page is good merely because it
wasn't in screenshots."

- `font-black` → `font-bold` across all 12 files (safe, mechanical — a
  font-weight utility swap changes no layout/spacing, only visual
  weight, matching Part 7's "reduce excessive... font weights
  disciplined").
- `rounded-[2rem]`/`rounded-[1.5rem]` → `rounded-xl`, `shadow-2xl` →
  `shadow-sm`, in the 6 files that had them (vat, workforce, suppliers,
  vehicles, sales, banking) — the same radius/shadow convergence Stage 1
  applied to `pro-shell.tsx` itself, applied here to page-level literal
  classes Stage 1 couldn't reach.
- One structural fix beyond the mechanical sweep: `vat/page.tsx`'s
  income-tax hero card was a full marketing-hero treatment
  (`rounded-[2rem]`, `shadow-2xl shadow-indigo-950/20 ring-1`, 4xl-5xl
  `font-black` figure) sitting inside an operational report — exactly
  "marketing aesthetics inside operational tables," Part 48's own
  example of what not to do. Kept as a deliberately darker card (it
  genuinely is the headline number on the page) but brought to the same
  `rounded-xl`/border/`font-bold` scale as every other card, no heavy
  shadow.

Not attempted this pass: a full structural per-page rebuild of all 12
pages (new card taxonomy, button hierarchy audit, spacing scale) — the
mechanical sweep addresses the dominant, measurable "heavy/dated" signal
across all of them at once; a deeper structural pass per page is real
remaining work, noted honestly rather than claimed as finished.

Verification: tsc clean, eslint clean, 89/89 tests passing, production
build succeeds, same 41-route list.

---

## 11. Stage 5 — Login/auth premium pass (Part 19/20/35)

Fixed the exact bug root-caused during the audit (§8 above): visiting
`/login` while already authenticated used to render `<SignedInBanner>`
(no timer, no auto-redirect) directly above the still-fully-rendered
sign-in/sign-up form, indefinitely — both the "stale Signed-in-as
banner" and "full login form unnecessarily below it" issues Part 19
names explicitly.

- New `alreadySignedIn` gate (`!!user && !authLoading`) now shows a
  single compact card — email, **Continue to Dashboard**, **Sign out
  and use another account** — and skips the tabs/form entirely, for
  both the regular and admin-login (`?next=/admin`) variants. "Continue"
  resolves the same way the existing post-submit redirect already does
  (`safeNextPath() ?? "/dashboard"`), so it's consistent with where a
  fresh sign-in would have landed.
- Confirmed the post-submit sign-in path was already correct — it calls
  `window.location.assign(destination)` immediately with no lingering
  success message — no change needed there, only disclosed as verified
  rather than assumed.
- Loading-button text changed from a bare `"..."` to `t("auth.signing_in")`
  ("Signing you in…") per Part 20 — a real, readable transitional state
  instead of an ellipsis.
- Admin login stays visually separated (dark slate-950 chrome,
  independent `adminLogin` branch) — unaffected structurally, just
  carries the same compact-card fix.
- `SignedInBanner` itself is untouched (still used by
  `admin-gate.tsx`) — only its two call sites in `login/page.tsx` were
  replaced, not the shared component.

New i18n: `auth.already_signed_in`, `auth.continue_dashboard`,
`auth.sign_out_other`, `auth.signing_in` (en/si).

Verification: tsc clean, eslint clean, 89/89 tests passing, production
build succeeds, same 41-route list. No browser exists in this sandbox
(disclosed consistently throughout this engagement) — this is code-level
verification of the render-gating logic, not a captured screenshot of
the interaction.

---

## 12. Stage 6 — Landing page premium pass (Part 21-26)

**Important discovery, disclosed rather than assumed:** the actual live
landing page (`/`, `src/app/page.tsx`) renders
`MarketingHomePage` (`src/components/marketing/marketing-home-page.tsx`)
— a completely separate, self-contained component. The files under
`src/components/landing/` (`landing-hero.tsx`, `landing-sections.tsx`,
`landing-sectors.tsx`, `marketing-header.tsx`) — the ones Phase A's own
audit described editing ("landing page's 6 feature-card icons...
replaced with SVG icons") — are **never imported anywhere** (confirmed
by grep across `src`). Phase A's landing-page fix was real code, but it
landed in a file the live site never renders; the actual public landing
page kept every emoji-free-but-still-heavy pattern this stage found.
Left the dead files in place (deleting exported components is out of
scope for a visual-convergence pass) but this is now on record so a
future pass doesn't repeat the mistake of editing the unused copy.

Fixed in `marketing-home-page.tsx` (the real, live file):

- **Token convergence** — same pattern as Stage 4: `font-black` (26
  occurrences) → `font-bold`; every `rounded-[2rem]`/`rounded-[1.75rem]`/
  `rounded-[1.5rem]`/`rounded-[2.5rem]` → `rounded-2xl`/`rounded-xl`;
  `shadow-2xl`/`shadow-xl` → removed or `shadow-sm`. Header lost its
  `backdrop-blur-2xl` (glassmorphism); the product-preview mockup lost
  its glow-blob + `backdrop-blur-xl` frame entirely.
- **One deliberate boldness spend, not six** — this page previously had
  a gradient on the header logo, the hero background blob, the primary
  CTA's shadow, the preview card's backdrop, the avatar circle, and the
  chart bars simultaneously. Flattened all but the hero's own ambient
  glow (now smaller/lower-opacity) and the final CTA section's gradient
  — matching the "spend your boldness in one place" principle instead of
  scattering it.
- **Plans section now sources real data** (Part 24's explicit
  instruction: "do not hardcode conflicting marketing prices"). It
  previously had its own independent `home.mkt.plan_*_price`/`_name`
  translation strings — today they happened to match `PLANS`
  (`lib/subscription/plans.ts`, the same source `/settings/plans` reads),
  but nothing enforced that; a future pricing change could have silently
  left the landing page wrong. Now imports `PLANS` directly and renders
  `formatLkrPrice(plan.priceMonthlyLkr)` + the locale-aware name — only
  the short marketing blurb per plan stays as translated copy (genuine
  copy, not data). Also now visually highlights the Business plan
  (`highlight: true` in the real config) as recommended, which the
  previous version ignored entirely, plus a max-users line and a
  footnote disclosing prices come from the live plan configuration.
- **Screenshot honesty (Part 21) — explicitly disclosed, not solved**:
  no browser exists in this sandbox (the standing constraint disclosed
  throughout this whole engagement), so the product-preview mockup
  remains a hand-built approximation, not an actual screenshot. Left a
  comment in the code saying so, and toned it down from a glassmorphism
  panel to a clean flat frame so it at least doesn't read as an
  "obviously fake generic illustration" — the one Part 21 requirement
  that's achievable without real screenshot capability.

**Not attempted this pass, disclosed as remaining work**: the deeper
structural asks in Part 22-23 (a distinct capability-row + industry-chip
section separate from the existing dark "solutions" block; splitting
the 4 generic feature cards into 3-4 named "feature story" sections with
real screenshots) and Part 26's full responsive-viewport verification
(covered instead in Stage 7). The existing structure already covers
the same ground reasonably (capability cards, a sector list, a plans
grid, a final CTA) — a full section-by-section rebuild is real,
separate work from token convergence, and rushing it risked a worse
result than being honest about what's done.

Verification: tsc clean, eslint clean, 89/89 tests passing, production
build succeeds (same 41-route list); confirmed in the built static HTML
that the real plan prices (Rs. 1,490 / 2,990 / 4,990) render and zero
`rounded-[`/`shadow-2xl`/`font-black`/`backdrop-blur` occurrences remain
on the landing page.
