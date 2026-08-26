"use client";

/**
 * Business Pulse — a clean, glanceable owner-only view of "what's going on
 * with the business", separate from the operational dashboard. Where
 * /dashboard is built for running today's work (jobs, alerts, tables),
 * Pulse answers one question in under five seconds: is the business healthy
 * right now, and what (if anything) needs a decision.
 *
 * v1 scope: textile sector, owner role only (see nav-sections.ts). Every
 * number here is read from the same sources /dashboard already uses —
 * getDashboardStats(), fetchSectorOperationalSnapshot(),
 * buildTextileAttentionActions(), getRevenueTrend() — plus two small,
 * honestly-derived local figures (see monthCashCollected below) built from
 * the exact same formula the dashboard already uses for "today", just
 * re-scoped to a month. No fabricated numbers, no fake trend lines: a
 * stat card only gets a sparkline where a real time series backs it.
 *
 * "Stock & spending" (stock value, expenses, needs-purchasing) was added
 * after explicit feedback that a sales/profit-only view isn't what an
 * owner actually wants first. Stock value comes from
 * fetchTextileOwnerIntelligence() — the same owner-gated RPC that backs
 * /textile/owner-intelligence — not the generic getDashboardStats().
 * stockValue, which is driven by a product-count field textile roll
 * receiving never updates and would be stale for a fabric business.
 * Expenses come from fetchOrgExpenses() (not part of the offline store,
 * so fetched separately here). "Needs purchasing" uses a fixed threshold
 * (LOW_STOCK_THRESHOLD) rather than a per-fabric reorder point, because
 * that setting doesn't exist yet — see the threshold's own docstring.
 *
 * A few more additions came from reviewing a sibling product's (nexus-erp)
 * owner mobile view for ideas worth porting: the phone-locked shell width
 * (PulseShell's max-w-md border-x wrapper — invisible on an actual phone,
 * keeps this from stretching into a wide dashboard on desktop), the
 * plain-language summary line (buildSummaryLine — assembled entirely from
 * numbers already computed on this page), the per-category Operating
 * costs breakdown (expensesByCategory, real, not padded), and the
 * Highlights feed (real positive facts, the counterpart to Needs
 * attention). Deliberately NOT ported: a synthesized "health score" hero
 * (would need a new, defensible scoring formula) and nexus-erp's dark
 * theme (a visual-identity decision, not an information-architecture one)
 * — both left for a separate decision if wanted later.
 */
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  BellIcon,
  ChevronDownIcon,
  HomeIcon,
  SalesIcon,
  StockIcon,
  MoreIcon,
  ShieldIcon,
  AlertTriangleIcon,
  CostingIcon,
  SuppliersIcon,
  SyncIcon,
  SignOutIcon,
  BoltIcon,
  TeamIcon,
  VehiclesIcon,
  ChatIcon,
  ExpenseIcon,
  SettingsIcon,
  ShopIcon,
  CheckIcon,
} from "@/components/ui/icons";
import { initialsFor } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { LOCALE_NAMES, nextLocale } from "@/lib/i18n/translations";
import { getDashboardStats } from "@/lib/store/actions";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Sale, CustomerPayment } from "@/lib/store/types";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { fetchSectorOperationalSnapshot, summarizeTextileRolls, type SectorOperationalSnapshot } from "@/lib/supabase/sector-dashboard-client";
import { buildTextileAttentionActions } from "@/components/dashboard/sector-command-center";
import { getRevenueTrend, type Locale } from "@/lib/revenue-trend";
import { fetchTextileOwnerIntelligence, type TextileOwnerIntelligence } from "@/lib/supabase/textile-intelligence-client";
import { fetchOrgExpenses, type Expense } from "@/lib/supabase/expenses-client";

/** Local 3-way locale pick — same convention as dashboard/page.tsx and
 * sector-command-center.tsx; kept duplicated per file rather than shared
 * for a two-line helper (see those files' identical docstrings). */
function tt(locale: Locale, si: string, en: string, ta: string): string {
  if (locale === "si") return si;
  if (locale === "ta") return ta;
  return en;
}

/** Compact currency for the big glanceable figures ("Rs. 4.82M") — the
 * hero/stat-card numbers this page is built around read faster abbreviated.
 * Itemized amounts (Needs Attention rows) stay on formatLkr's full form,
 * matching how buildTextileAttentionActions already formats them. */
function formatCompactLkr(amount: number): string {
  const compact = new Intl.NumberFormat("en-LK", { notation: "compact", maximumFractionDigits: 2 }).format(amount);
  return `Rs. ${compact}`;
}

/**
 * Illustrative numbers only — shown exclusively when noTransactionsYet is
 * true, always behind the "Sample preview" banner below, and never written
 * anywhere real numbers are read from (getDashboardStats, the snapshot,
 * etc). This exists purely so a brand-new owner can see what Business
 * Pulse looks like once it has something to show, per explicit request —
 * it must never be reachable once a real sale exists.
 */
const SAMPLE_PULSE = {
  netSales: 4_820_000,
  salesChangePct: 12,
  grossProfit: 1_160_000,
  marginPct: 24,
  cashCollected: 3_740_000,
  cashChangePct: 9,
  receivables: 1_080_000,
  receivablesOverdue: 286_000,
  stockValue: 8_640_000,
  stockValueChangePct: 6,
  // The first attempt at "gentle" undershot into nearly flat — visible
  // amplitude isn't the problem, sharp/frequent reversals are. Two clear
  // rounded "hills" with mild dips between them (not a spike, not a flat
  // line) is what a real premium sparkline (and the reference mockup)
  // actually looks like once smoothed.
  sparkline: [3.9, 4.05, 4.2, 4.1, 4.35, 4.5, 4.4, 4.82].map((m) => m * 1_000_000),
  todaySaleCount: 12,
  todaySalesValue: 684_500,
  todayCollected: 512_000,
};

/** Same collection formula getDashboardStats() uses for "payments received
 * today" (see actions.ts) — creditAmount is binary in this data model, so
 * total - creditAmount is exactly what was actually collected — just
 * re-scoped from "today" to an arbitrary month key so the hero's period
 * switch (this month / last month) has a real, not fabricated, number for
 * "Cash collected". `monthKey` must be in the same "YYYY-MM" shape
 * getRevenueTrend() already buckets by, so this stays consistent with the
 * sparkline built from the same trend array. */
function monthCashCollected(sales: Sale[], payments: CustomerPayment[], monthKey: string): number {
  const monthSales = sales.filter((s) => s.date.startsWith(monthKey));
  const monthPayments = payments.filter((p) => p.date.startsWith(monthKey));
  return (
    monthSales.reduce((s, x) => s + (x.total - x.creditAmount), 0) +
    monthPayments.reduce((s, p) => s + p.amount, 0)
  );
}

/** Small inline sparkline — only ever fed a real series (see hero below).
 * No axes, no labels: it exists purely to show shape/direction at a glance.
 *
 * Scales to the series' OWN min..max, not to zero. Anchoring the floor at
 * zero (the previous `Math.min(...values, 0)`) meant a month range of
 * 3.9M..4.8M occupied only ~19% of the box — every wave got flattened into
 * a sliver near the top no matter what the underlying numbers did. A
 * sparkline's job is relative shape, not absolute magnitude (the real
 * figure is printed right next to it), so the series range is the correct
 * domain here. */
function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length < 2) return null;
  const w = 128;
  const h = 48;
  const padY = 6;
  const max = Math.max(...values);
  const min = Math.min(...values);
  // Guard a perfectly flat series (every value identical) against /0 — it
  // then draws as a centred straight line, which is the honest rendering.
  const range = max - min || 1;
  const plot = h - padY * 2;
  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: padY + plot - ((v - min) / range) * plot,
  }));
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-32 shrink-0" aria-hidden="true">
      <path d={smoothPath(points)} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="3" fill={stroke} />
    </svg>
  );
}

/** Catmull-Rom → cubic Bézier (standard 1/6-tension conversion) — turns a
 * raw point list into one continuous, flowing curve. The straight polyline
 * this replaced connected points with sharp corners, which at a 96x32
 * sparkline size reads as a jagged, hand-drawn zigzag rather than the
 * smooth line every reference fintech sparkline (this app's own mockup
 * included) actually uses. Passes exactly through every real value —
 * nothing here is smoothed away, only how the segments between them are
 * drawn. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

type StatTone = "default" | "positive" | "warning" | "danger";
const STAT_VALUE_TONE: Record<StatTone, string> = {
  default: "text-slate-50",
  positive: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-rose-400",
};

/** One card in the horizontally-scrolling stat row. Deliberately no
 * sparkline here — unlike the hero, none of these (receivables balance,
 * active reservations, quality holds) have a real historical series
 * cheaply available, and a fabricated trend line would misrepresent one
 * that doesn't exist. */
function StatCard({ label, value, hint, tone = "default" }: { label: string; value: string; hint: string; tone?: StatTone }) {
  return (
    <div className="w-[13.5rem] shrink-0 snap-start rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tracking-[-0.02em] ${STAT_VALUE_TONE[tone]}`}>{value}</p>
      <p className={`mt-1 text-xs font-medium ${tone === "danger" ? "text-rose-400" : "text-slate-500"}`}>{hint}</p>
    </div>
  );
}

type AttentionActionKey = "roll-holds" | "overdue-credit" | "pending-cuts" | "pending-dispatches" | "low-stock-fabric";

function attentionIcon(key: string) {
  if (key === "roll-holds") return ShieldIcon;
  if (key === "overdue-credit") return AlertTriangleIcon;
  if (key === "pending-cuts") return CostingIcon;
  if (key === "low-stock-fabric") return StockIcon;
  return SuppliersIcon;
}

function attentionActionLabel(key: string, locale: Locale): string {
  if (key === "roll-holds") return tt(locale, "සමාලෝචනය", "Review", "மறுஆய்வு");
  if (key === "overdue-credit") return tt(locale, "එකතු කරන්න", "Collect", "வசூலி");
  if (key === "pending-cuts") return tt(locale, "කපන්න", "Cut", "வெட்டு");
  if (key === "low-stock-fabric") return tt(locale, "මිලදී ගන්න", "Buy", "வாங்கு");
  return tt(locale, "යවන්න", "Dispatch", "அனுப்பு");
}

/** Icon per expense category — reuses the app's existing icon set (no
 * emoji; matches the rest of the codebase's de-emoji convention) rather
 * than inventing a parallel style just for this card. Falls through to
 * ExpenseIcon for anything not explicitly mapped. */
function expenseCategoryIcon(category: string) {
  if (category === "utilities") return BoltIcon;
  if (category === "salaries") return TeamIcon;
  if (category === "fuel" || category === "transport") return VehiclesIcon;
  if (category === "supplies" || category === "parts_purchase") return SuppliersIcon;
  if (category === "maintenance" || category === "equipment_rental") return SettingsIcon;
  if (category === "insurance") return ShieldIcon;
  if (category === "marketing") return ChatIcon;
  if (category === "rent") return ShopIcon;
  return ExpenseIcon;
}

/** One plain-language sentence summarizing the month, the way a person
 * would say it out loud rather than making the reader assemble it from
 * separate numbers — built entirely from figures already computed on this
 * page (salesChangePct, attentionCount), nothing new fetched or invented. */
function buildSummaryLine(locale: Locale, salesChangePct: number | null, attentionCount: number): string {
  const salesPhrase =
    salesChangePct == null
      ? tt(locale, "අලෙවිය මෙම මාසය ස්ථාවරයි", "Sales are steady this month", "இந்த மாதம் விற்பனை நிலையானது")
      : salesChangePct > 0
        ? tt(locale, `අලෙවිය මෙම මාසය ${salesChangePct}%කින් ඉහළ ගොස් ඇත`, `Sales are up ${salesChangePct}% this month`, `இந்த மாதம் விற்பனை ${salesChangePct}% அதிகரித்துள்ளது`)
        : salesChangePct < 0
          ? tt(locale, `අලෙවිය මෙම මාසය ${Math.abs(salesChangePct)}%කින් පහළ ගොස් ඇත`, `Sales are down ${Math.abs(salesChangePct)}% this month`, `இந்த மாதம் விற்பனை ${Math.abs(salesChangePct)}% குறைந்துள்ளது`)
          : tt(locale, "අලෙවිය මෙම මාසය ස්ථාවරයි", "Sales are flat this month", "இந்த மாதம் விற்பனை மாறவில்லை");
  const attentionPhrase =
    attentionCount > 0
      ? tt(locale, `${attentionCount} ක් ඔබේ තීරණය අවශ්‍යයි`, `${attentionCount} item${attentionCount === 1 ? "" : "s"} need your attention`, `${attentionCount} உருப்படி(கள்) உங்கள் கவனம் தேவை`)
      : tt(locale, "දැනට කිසිවක් ඔබේ තීරණය අවශ්‍ය නොවේ", "nothing needs your attention right now", "தற்போது எதுவும் உங்கள் கவனத்திற்குத் தேவையில்லை");
  return `${salesPhrase} — ${attentionPhrase}.`;
}

/** Fixed, undisclosed-to-user threshold for the v1 "needs purchasing"
 * signal — there's no real reorder-point setting per fabric type yet (see
 * the Business Pulse planning discussion), so this is a simple, honest
 * placeholder: flag any active fabric with 10 or fewer units remaining
 * across all its live rolls. Good enough to catch "about to run out"
 * without a settings screen; a real per-fabric threshold is a follow-up. */
const LOW_STOCK_THRESHOLD = 10;

/** Dark-themed loading state, local to this page — the shared
 * ProLoadingState (pro-shell.tsx) is hardcoded light (bg-white) and used
 * across the rest of the app, which stays light; swapping its colors
 * would break every other page that uses it. Small enough to duplicate
 * rather than add a theme prop to a component ~30 other pages share. */
function PulseLoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-400">
        <span aria-hidden="true" className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-400" />
        {label}
      </div>
    </div>
  );
}

/** Dark-themed empty state, local to this page for the same reason as
 * PulseLoadingState above — the shared EmptyState (primitives.tsx) is
 * hardcoded light and shared app-wide. */
function PulseEmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/60 px-6 py-11 text-center">
      <p className="text-sm font-bold text-slate-100">{title}</p>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Business Pulse's own chrome — deliberately not <AppShell>. AppShell's
 * Sidebar carries the full 20+-item operational nav (Sales, Stock, Jobs,
 * Banking, VAT, Settings, ...), which is exactly the clutter this page
 * exists to get away from. An owner opening Business Pulse should see the
 * brand, which shop they're in, a way to check what needs attention, and
 * nothing else competing for it — a genuinely separate, minimal "owner
 * app" feel. Language switch, sign-out and the door back to the full
 * operational app live in one account panel instead of a nav rail.
 */
function PulseShell({
  children,
  attentionCount,
  onBellClick,
}: {
  children: ReactNode;
  attentionCount: number;
  onBellClick: () => void;
}) {
  const { locale, setLocale } = useLocale();
  const { user, logout } = useAuth();
  const { org } = useSubscription();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [accountOpen]);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const accountPanel = accountOpen && (
    <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-800 bg-slate-900 p-2 shadow-xl">
      <div className="rounded-xl bg-slate-800/60 px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-slate-50">{org.name}</p>
        <p className="truncate text-xs text-slate-400">{user?.email}</p>
      </div>
      <button
        type="button"
        onClick={() => setLocale(nextLocale(locale))}
        className="mt-1.5 flex min-h-10 w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/60"
      >
        <span>{LOCALE_NAMES[locale]}</span>
        <span className="text-xs font-semibold text-teal-300">{LOCALE_NAMES[nextLocale(locale)]} →</span>
      </button>
      <Link href="/dashboard" className="flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/60">
        {tt(locale, "සම්පූර්ණ dashboard", "Full dashboard", "முழு dashboard")} →
      </Link>
      {user && (
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-400/10"
        >
          <SignOutIcon className="h-4 w-4" />
          {tt(locale, "පිටවන්න", "Sign out", "வெளியேறு")}
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_0%,rgba(45,212,191,0.09),transparent_28rem),radial-gradient(circle_at_95%_12%,rgba(56,189,248,0.05),transparent_26rem),linear-gradient(180deg,#0a1613_0%,#070f0d_100%)] pb-24 text-slate-50 lg:pb-6">
      {/* Locked to phone width (max-w-md) and bordered on both sides —
          on an actual phone this is invisible (the viewport IS this
          width), but on a desktop browser it stops Pulse from stretching
          into a wide dashboard and keeps the "separate, dedicated owner
          app" feel the rest of this page is built around. */}
      <div className="mx-auto max-w-md min-h-screen border-x border-slate-800/70">
        {/* Not sticky — a pinned header on a page this short adds a seam
            (and, in full-page screenshot tools that capture in scrolled
            slices, can visually duplicate mid-page) for no real benefit;
            Alerts/More in the bottom tab bar already cover the same
            reachability on mobile. */}
        <header className="border-b border-slate-800/70 bg-slate-900/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-white shadow-sm shadow-teal-900/20">L</span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-bold tracking-tight text-slate-50">LakBiz</p>
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex items-center gap-0.5 truncate text-xs font-medium text-slate-400 hover:text-slate-300"
                >
                  <span className="truncate">{org.name}</span>
                  <ChevronDownIcon className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>
            </div>
            <div className="relative flex shrink-0 items-center gap-2" ref={accountRef}>
              <button
                type="button"
                onClick={onBellClick}
                aria-label={tt(locale, "දැනුම්දීම්", "Notifications", "அறிவிப்புகள்")}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:border-teal-400/30 hover:bg-teal-400/10"
              >
                <BellIcon className="h-4.5 w-4.5" />
                {attentionCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white">
                    {attentionCount > 9 ? "9+" : attentionCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                aria-label={tt(locale, "ගිණුම", "Account", "கணக்கு")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-xs font-bold text-white"
              >
                {initialsFor(org.name, user?.email)}
              </button>
              {accountPanel}
            </div>
          </div>
        </header>
        <main className="space-y-4 px-4 py-5 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

export default function BusinessPulsePage() {
  const { data, ready } = useAppStore();
  const { locale, t } = useLocale();
  const { org, orgRole, canSeeFinancials } = useSubscription();
  const [period, setPeriod] = useState<"this_month" | "last_month">("this_month");
  const [periodOpen, setPeriodOpen] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);
  const attentionSectionRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeCard, setActiveCard] = useState(0);

  useEffect(() => {
    if (!periodOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!periodRef.current?.contains(event.target as Node)) setPeriodOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [periodOpen]);

  // Same fetch, same gating, as the dashboard and command centre — one
  // snapshot shape, never a second independently-derived textile view.
  const [textileSnapshot, setTextileSnapshot] = useState<SectorOperationalSnapshot | null>(null);
  useEffect(() => {
    if (org.sector !== "textile" || !org.isAuthenticated || !org.id) {
      setTextileSnapshot(null);
      return;
    }
    let cancelled = false;
    void fetchSectorOperationalSnapshot(org.id, org.sector, canSeeFinancials).then((result) => {
      if (!cancelled) setTextileSnapshot(result);
    });
    return () => {
      cancelled = true;
    };
  }, [canSeeFinancials, org.id, org.isAuthenticated, org.sector]);

  // Real stock value (Σ remaining_length × real roll cost) — the same
  // owner-gated database function that backs /textile/owner-intelligence's
  // "Stock value" figure, not the generic stats.stockValue (that one is
  // driven by a product-count field roll receiving never updates, so it's
  // stale/meaningless for a fabric business — confirmed while planning
  // this addition, deliberately not reused here). stock_by_unit is a
  // current-state snapshot, not period-bound, so the from/to window only
  // needs to be wide enough for the RPC call to succeed; 30 days is enough.
  const [ownerIntelligence, setOwnerIntelligence] = useState<TextileOwnerIntelligence | null>(null);
  useEffect(() => {
    if (org.sector !== "textile" || !org.isAuthenticated || !org.id) {
      setOwnerIntelligence(null);
      return;
    }
    let cancelled = false;
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    void fetchTextileOwnerIntelligence(org.id, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)).then((result) => {
      if (!cancelled) setOwnerIntelligence(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [org.id, org.isAuthenticated, org.sector]);

  // This month's / last month's expenses (rent, utilities, salaries, ...) —
  // real, from the same expense tracker /expenses uses. Never loaded into
  // the offline app store, so it's fetched here the same way textileSnapshot
  // and ownerIntelligence are.
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  useEffect(() => {
    if (!org.isAuthenticated || !org.id) {
      setExpenses(null);
      return;
    }
    let cancelled = false;
    void fetchOrgExpenses(org.id).then((result) => {
      if (!cancelled) setExpenses(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [org.id, org.isAuthenticated]);

  const scrollToAttention = () => {
    attentionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!ready || !data) {
    return (
      <PulseShell attentionCount={0} onBellClick={() => {}}>
        <PulseLoadingState label={t("common.loading")} />
      </PulseShell>
    );
  }

  // Owner + textile only for v1 (see the Business Pulse plan). Not routed
  // through ShopRouteGuard's SHOP_PREFIXES — same deliberate in-page gate
  // as /textile/owner-intelligence, since canAccessShopRoute already
  // returns true unconditionally for "owner" regardless of href.
  if (org.sector !== "textile" || orgRole !== "owner") {
    return (
      <PulseShell attentionCount={0} onBellClick={() => {}}>
        <PulseEmptyState
          title={tt(locale, "හිමිකරු පමණි", "Owner access only", "உரிமையாளர் அணுகல் மட்டும்")}
          description={tt(
            locale,
            "Business Pulse දැනට රෙදි ව්‍යාපාර හිමිකරුවන් සඳහා පමණි.",
            "Business Pulse is available to textile business owners for now.",
            "Business Pulse தற்போது துணி வணிக உரிமையாளர்களுக்கு மட்டுமே கிடைக்கும்.",
          )}
          action={
            <Link href="/dashboard" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-800 px-3.5 text-sm font-semibold text-slate-300 hover:bg-slate-800/60">
              {tt(locale, "සම්පූර්ණ dashboard", "Full dashboard", "முழு dashboard")} →
            </Link>
          }
        />
      </PulseShell>
    );
  }

  const stats = getDashboardStats(data);
  const rollSummary = textileSnapshot ? summarizeTextileRolls(textileSnapshot) : null;
  const attentionActions = textileSnapshot ? buildTextileAttentionActions(textileSnapshot, locale) : [];
  const qualityHolds = textileSnapshot ? textileSnapshot.textileRolls.filter((roll) => roll.status === "quarantined").length : 0;
  // Same "inventory ready, nothing sold yet" state the dashboard's Phase 1
  // fix already handles (see dashboard/page.tsx's textileNoTransactions) —
  // a hero showing "Rs. 0" everywhere reads as a broken app, not a premium
  // one, for a shop that just finished onboarding. Real rolls exist, real
  // sales don't yet: show that honestly instead of a wall of zeros.
  const noTransactionsYet = (rollSummary?.activeRolls ?? 0) > 0 && data.sales.length === 0;
  // Receivables + [Stock value while noTransactionsYet] + Reservations + Quality holds.
  const statCardCount = noTransactionsYet ? 4 : 3;

  // One 12-month trend backs the hero, its sparkline and both period
  // options ("this month" / "last month") — a single bucket definition
  // (see getRevenueTrend's month-key convention) instead of mixing it with
  // getDashboardStats()'s separately-bucketed monthSales, so the hero
  // number and the sparkline it sits next to can never quietly disagree.
  const trend = getRevenueTrend(data.sales, "12m", locale, new Date());
  const selectedIdx = period === "this_month" ? trend.length - 1 : trend.length - 2;
  const priorIdx = selectedIdx - 1;
  const selected = trend[selectedIdx];
  const prior = priorIdx >= 0 ? trend[priorIdx] : null;
  const salesChangePct = prior && prior.revenue > 0 ? Math.round(((selected.revenue - prior.revenue) / prior.revenue) * 100) : null;
  const marginPct = selected.revenue > 0 ? Math.round((selected.profit / selected.revenue) * 100) : 0;
  const cashCollected = monthCashCollected(data.sales, data.customerPayments, selected.key);
  const priorCashCollected = prior ? monthCashCollected(data.sales, data.customerPayments, prior.key) : null;
  const cashChangePct = priorCashCollected && priorCashCollected > 0 ? Math.round(((cashCollected - priorCashCollected) / priorCashCollected) * 100) : null;
  const sparklineValues = trend.slice(-8).map((p) => p.revenue);

  const salesUp = (salesChangePct ?? 0) >= 0;

  // Real stock value — Σ across both length units from the owner
  // intelligence RPC (see the fetch effect above for why this, not
  // stats.stockValue). null while the RPC hasn't returned yet, so the UI
  // can show "—" instead of a false Rs. 0.
  const stockValueLkr = ownerIntelligence ? ownerIntelligence.stock_by_unit.reduce((sum, unit) => sum + (unit.stock_value_lkr ?? 0), 0) : null;

  // Expenses for whichever period the page's own "This month / Last month"
  // switch is set to — same monthKey convention as the sparkline/hero
  // above, so a reader flipping the switch sees every figure on the page
  // move together instead of some numbers changing period and others not.
  const monthExpenses = expenses ? expenses.filter((expense) => expense.expenseDate.startsWith(selected.key)) : null;
  const expensesTotal = monthExpenses ? monthExpenses.reduce((sum, expense) => sum + expense.amount, 0) : null;
  // Per-category breakdown (Operating costs) — only categories that
  // actually have spend this period show up; nothing is padded in with
  // a zero to fill a fixed row. Sorted highest first so the categories
  // actually worth an owner's attention lead.
  const expensesByCategory = monthExpenses
    ? Array.from(
        monthExpenses.reduce((map, expense) => {
          map.set(expense.category, (map.get(expense.category) ?? 0) + expense.amount);
          return map;
        }, new Map<string, number>()),
      )
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
    : [];

  // "Needs purchasing" — real fabric names and real remaining quantities,
  // just measured against a fixed placeholder threshold rather than a
  // per-fabric reorder point nobody has set yet (see LOW_STOCK_THRESHOLD).
  const remainingByProduct = new Map<string, { remaining: number; unit: "metre" | "yard" }>();
  if (textileSnapshot) {
    for (const roll of textileSnapshot.textileRolls) {
      if (roll.status === "exhausted" || roll.status === "returned") continue;
      const existing = remainingByProduct.get(roll.productId);
      remainingByProduct.set(roll.productId, { remaining: (existing?.remaining ?? 0) + roll.remainingLength, unit: roll.lengthUnit });
    }
  }
  const lowStockFabrics = textileSnapshot
    ? data.products
        .filter((product) => product.active && product.sectorId === "textile")
        .map((product) => {
          const stock = remainingByProduct.get(product.id);
          return { product, remaining: stock?.remaining ?? 0, unit: stock?.unit ?? ("metre" as const) };
        })
        .filter((entry) => entry.remaining <= LOW_STOCK_THRESHOLD)
        .sort((a, b) => a.remaining - b.remaining)
    : [];
  const lowStockActions = lowStockFabrics.slice(0, 5).map((entry) => ({
    key: "low-stock-fabric" as const,
    title: entry.product.name,
    detail:
      entry.remaining <= 0
        ? tt(locale, "තොගයේ නැත", "Out of stock", "சரக்கு இல்லை")
        : tt(
            locale,
            `${entry.remaining.toFixed(1)} ${entry.unit === "metre" ? "m" : "yd"} ඉතිරිය`,
            `${entry.remaining.toFixed(1)} ${entry.unit === "metre" ? "m" : "yd"} remaining`,
            `${entry.remaining.toFixed(1)} ${entry.unit === "metre" ? "m" : "yd"} மீதம்`,
          ),
    href: "/stock/rolls?receive=1",
    tone: (entry.remaining <= 0 ? "danger" : "warning") as "danger" | "warning",
  }));
  const allAttentionActions = [...attentionActions, ...lowStockActions];

  // Highlights — the positive counterpart to Needs attention: real good
  // news, not manufactured praise. Every entry here is a fact already
  // derivable from data computed above; skipped entirely (not shown as an
  // empty section) when there's nothing genuine to report. The sales-up
  // entry naturally doesn't appear during noTransactionsYet since
  // salesChangePct is null there (no real trend yet) — no special-casing
  // needed for that one.
  const activeTextileProductCount = data.products.filter((product) => product.active && product.sectorId === "textile").length;
  const highlights: { key: string; title: string }[] = [];
  if (salesChangePct != null && salesChangePct > 0) {
    highlights.push({
      key: "sales-up",
      title: tt(locale, `අලෙවිය පසුගිය මාසයට වඩා ${salesChangePct}%කින් ඉහළ`, `Sales up ${salesChangePct}% vs last month`, `கடந்த மாதத்தை விட விற்பனை ${salesChangePct}% அதிகரிப்பு`),
    });
  }
  if (textileSnapshot && textileSnapshot.textileWorkflow.overdueAmount === 0) {
    highlights.push({ key: "no-overdue", title: tt(locale, "පැහැර හැරුණු ලැබිය යුතු මුදල් නැත", "No overdue receivables", "தாமதமான பெறத்தக்கவை இல்லை") });
  }
  if (textileSnapshot && qualityHolds === 0) {
    highlights.push({ key: "no-holds", title: tt(locale, "තත්ත්ව රඳවා ගැනීම් 0 — සියල්ල පැහැදිලිය", "0 quality holds — all clear", "0 தர நிறுத்தங்கள் — அனைத்தும் தெளிவு") });
  }
  if (textileSnapshot && activeTextileProductCount > 0 && lowStockFabrics.length === 0) {
    highlights.push({ key: "well-stocked", title: tt(locale, "සියලුම රෙදි වර්ග ප්‍රමාණවත් ලෙස තොගයේ ඇත", "All fabrics well stocked", "அனைத்து துணி வகைகளும் போதுமான சரக்கில் உள்ளன") });
  }

  return (
    <PulseShell attentionCount={allAttentionActions.length} onBellClick={scrollToAttention}>
      {/* Title row + period switch. */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-slate-50">{tt(locale, "හිමිකරු දළ විශ්ලේෂණය", "Owner overview", "உரிமையாளர் கண்ணோட்டம்")}</h1>
        <div className="relative shrink-0" ref={periodRef}>
          <button
            type="button"
            onClick={() => setPeriodOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-300 shadow-sm hover:bg-slate-800/60"
          >
            {period === "this_month" ? tt(locale, "මෙම මාසය", "This month", "இந்த மாதம்") : tt(locale, "පසුගිය මාසය", "Last month", "கடந்த மாதம்")}
            <ChevronDownIcon className="h-4 w-4 text-slate-500" />
          </button>
          {periodOpen && (
            <div className="absolute right-0 top-full z-20 mt-1.5 w-40 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 py-1 shadow-lg">
              {(["this_month", "last_month"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPeriod(p);
                    setPeriodOpen(false);
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left text-sm font-medium ${period === p ? "bg-teal-400/10 text-teal-200" : "text-slate-300 hover:bg-slate-800/60"}`}
                >
                  {p === "this_month" ? tt(locale, "මෙම මාසය", "This month", "இந்த மாதம்") : tt(locale, "පසුගිය මාසය", "Last month", "கடந்த மாதம்")}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Plain-language summary — says what the numbers below mean in one
          sentence, the way a person would say it out loud, before making
          the reader assemble it themselves from separate cards. Built
          entirely from salesChangePct and allAttentionActions.length,
          both already real and computed above; skipped during
          noTransactionsYet since there's no real sales trend yet and the
          sample-preview banner already explains that state. */}
      {!noTransactionsYet && (
        <p className="-mt-2 text-sm text-slate-300">{buildSummaryLine(locale, salesChangePct, allAttentionActions.length)}</p>
      )}
      {org.isAuthenticated && (
        <p className="-mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
          <SyncIcon className="h-3.5 w-3.5" />
          {t("dash.cloud_synced")}
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
        </p>
      )}

      {/* Sample-preview banner — the one, unmistakable disclosure that
          everything inside the hero, the stat row and Today-at-a-glance
          below is illustrative (SAMPLE_PULSE), not real, until a first
          sale exists. Needs Attention and Roll inventory are NOT covered
          by this banner because they're already real. */}
      {noTransactionsYet && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-white">i</span>
          <p className="text-xs leading-5 text-amber-200">
            <span className="font-bold">{tt(locale, "නියැදි දත්ත", "Sample preview", "மாதிரி முன்னோட்டம்")}</span>{" "}
            {tt(
              locale,
              "පහත ව්‍යාපාර ස්පන්දනය, ලාභය සහ අද දිනය කොටස් නියැදි ගණන් පෙන්වයි — ඔබේ පළමු අලෙවියෙන් පසු සැබෑ ගණන් වලින් ප්‍රතිස්ථාපනය වේ. Roll තොගය, තොගය සහ වියදම්, විශේෂාංග, සහ අවධානය අවශ්‍ය කොටස් සැබෑය.",
              "The pulse, profit and Today sections below show sample numbers — they're replaced by your real figures after your first sale. Roll inventory, Stock & spending, Highlights, and Needs attention are already real.",
              "கீழே உள்ள துடிப்பு, லாபம் மற்றும் இன்று பிரிவுகள் மாதிரி எண்களைக் காட்டுகின்றன — உங்கள் முதல் விற்பனைக்குப் பிறகு உண்மையான எண்களால் மாற்றப்படும். Roll சரக்கு, சரக்கு & செலவு, சிறப்பம்சங்கள், மற்றும் கவனம் தேவை பிரிவுகள் ஏற்கனவே உண்மையானவை.",
            )}
          </p>
        </div>
      )}

      {/* Hero — Business pulse. */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400">{tt(locale, "ව්‍යාපාර ස්පන්දනය", "Business pulse", "வணிக துடிப்பு")}</p>
            <p className="mt-1.5 text-[2.1rem] font-bold leading-none tracking-[-0.03em] text-slate-50 sm:text-4xl">
              {formatCompactLkr(noTransactionsYet ? SAMPLE_PULSE.netSales : selected.revenue)}
            </p>
            <p className="mt-1.5 text-xs font-medium text-slate-400">{tt(locale, "නිකුත් අලෙවිය", "Net sales", "நிகர விற்பனை")}</p>
            {(noTransactionsYet || salesChangePct != null) && (
              <p className={`mt-2 flex items-center gap-1 text-sm font-bold ${noTransactionsYet || salesUp ? "text-emerald-400" : "text-rose-400"}`}>
                ↑ {Math.abs(noTransactionsYet ? SAMPLE_PULSE.salesChangePct : (salesChangePct ?? 0))}%
                <span className="font-medium text-slate-500">{tt(locale, "පසුගිය මාසයට වඩා", "vs last month", "கடந்த மாதத்தை விட")}</span>
              </p>
            )}
          </div>
          <Sparkline values={noTransactionsYet ? SAMPLE_PULSE.sparkline : sparklineValues} stroke="#2dd4bf" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
          <div>
            <p className="text-xs font-semibold text-slate-400">{tt(locale, "දළ ලාභය", "Gross profit", "மொத்த லாபம்")}</p>
            <p className="mt-1 text-xl font-bold tracking-[-0.02em] text-slate-50">
              {formatCompactLkr(noTransactionsYet ? SAMPLE_PULSE.grossProfit : selected.profit)}
            </p>
            <p className="mt-0.5 text-xs font-medium text-emerald-400">
              {noTransactionsYet ? SAMPLE_PULSE.marginPct : marginPct}% {tt(locale, "ආන්තිකය", "margin", "விளிம்பு")}
            </p>
          </div>
          <div className="border-l border-slate-800 pl-4">
            <p className="text-xs font-semibold text-slate-400">{tt(locale, "එකතු කළ මුදල්", "Cash collected", "வசூலிக்கப்பட்ட பணம்")}</p>
            <p className="mt-1 text-xl font-bold tracking-[-0.02em] text-slate-50">
              {formatCompactLkr(noTransactionsYet ? SAMPLE_PULSE.cashCollected : cashCollected)}
            </p>
            {(noTransactionsYet || cashChangePct != null) && (
              <p className="mt-0.5 text-xs font-medium text-emerald-400">
                ↑ {Math.abs(noTransactionsYet ? SAMPLE_PULSE.cashChangePct : (cashChangePct ?? 0))}% {tt(locale, "පසුගිය මාසයට වඩා", "vs last month", "கடந்த மாதத்தை விட")}
              </p>
            )}
          </div>
        </div>
      </div>

      {noTransactionsYet && (
        <p className="-mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          {tt(
            locale,
            `සැබෑ Rolls ${rollSummary?.activeRolls ?? 0}ක් තොගයේ ඇත — විකිණීමට සූදානම්.`,
            `${rollSummary?.activeRolls ?? 0} real rolls are stocked and ready to sell.`,
            `உண்மையான ${rollSummary?.activeRolls ?? 0} Rolls சரக்கில் தயாராக உள்ளன.`,
          )}
        </p>
      )}

      {/* Stat carousel. Receivables and Stock value use SAMPLE_PULSE while
          noTransactionsYet (covered by the banner above); Reservations and
          Quality holds are always real — see StatCard's docstring for why
          they never carry a fabricated trend line either way. */}
      <div
        ref={carouselRef}
        onScroll={(e) => {
          // StatCard is w-[13.5rem] (216px) with gap-3 (12px) between —
          // 228px per step. Rounding the scroll position to the nearest
          // step keeps the dot indicator honestly in sync with whichever
          // card is actually snapped into view, rather than a static
          // decoration that never moves.
          const index = Math.round(e.currentTarget.scrollLeft / 228);
          setActiveCard(Math.max(0, Math.min(statCardCount - 1, index)));
        }}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
      >
        <StatCard
          label={tt(locale, "ලැබිය යුතු මුදල්", "Receivables", "பெறத்தக்கவை")}
          value={formatCompactLkr(noTransactionsYet ? SAMPLE_PULSE.receivables : stats.creditOutstanding)}
          hint={
            noTransactionsYet
              ? tt(locale, `${formatCompactLkr(SAMPLE_PULSE.receivablesOverdue)} පැහැර හැරී ඇත`, `${formatCompactLkr(SAMPLE_PULSE.receivablesOverdue)} overdue`, `${formatCompactLkr(SAMPLE_PULSE.receivablesOverdue)} தாமதமானது`)
              : textileSnapshot && textileSnapshot.textileWorkflow.overdueAmount > 0
                ? tt(locale, `${formatCompactLkr(textileSnapshot.textileWorkflow.overdueAmount)} පැහැර හැරී ඇත`, `${formatCompactLkr(textileSnapshot.textileWorkflow.overdueAmount)} overdue`, `${formatCompactLkr(textileSnapshot.textileWorkflow.overdueAmount)} தாமதமானது`)
                : tt(locale, "පැහැර හැරීම් නැත", "None overdue", "தாமதம் இல்லை")
          }
          tone={noTransactionsYet || (textileSnapshot && textileSnapshot.textileWorkflow.overdueAmount > 0) ? "danger" : "default"}
        />
        {noTransactionsYet && (
          <StatCard
            label={tt(locale, "තොග වටිනාකම", "Stock value", "சரக்கு மதிப்பு")}
            value={formatCompactLkr(SAMPLE_PULSE.stockValue)}
            hint={`↑ ${SAMPLE_PULSE.stockValueChangePct}% ${tt(locale, "පසුගිය මාසයට වඩා", "vs last month", "கடந்த மாதத்தை விட")}`}
          />
        )}
        <StatCard
          label={tt(locale, "සක්‍රීය වෙන්කිරීම්", "Reservations", "முன்பதிவுகள்")}
          value={textileSnapshot ? String(textileSnapshot.textileWorkflow.activeReservations) : "—"}
          hint={tt(locale, "සක්‍රීය පාරිභෝගික වෙන්කිරීම්", "Active customer reservations", "செயலில் உள்ள வாடிக்கையாளர் முன்பதிவுகள்")}
        />
        <StatCard
          label={tt(locale, "තත්ත්ව රඳවා ගැනීම්", "Quality holds", "தர நிறுத்தங்கள்")}
          value={String(qualityHolds)}
          hint={qualityHolds > 0 ? tt(locale, "සමාලෝචනය අවශ්‍යයි", "Needs review", "மறுஆய்வு தேவை") : tt(locale, "සියල්ල පැහැදිලිය", "All clear", "அனைத்தும் தெளிவு")}
          tone={qualityHolds > 0 ? "warning" : "positive"}
        />
      </div>
      {/* Dot pagination — genuinely scroll-linked (see the carousel's
          onScroll above), not a static decoration; it tells the truth
          about which card is actually in view. */}
      <div className="-mt-1.5 flex items-center justify-center gap-1.5" aria-hidden="true">
        {Array.from({ length: statCardCount }, (_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === activeCard ? "w-4 bg-teal-500" : "w-1.5 bg-slate-700"}`} />
        ))}
      </div>

      {/* Needs attention — same single source of truth as the dashboard's
          Needs Attention card and the sector command centre
          (buildTextileAttentionActions). Never a separate, potentially
          contradictory list. */}
      <div ref={attentionSectionRef} className="scroll-mt-20 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-bold tracking-tight text-slate-100">{tt(locale, "අවධානය අවශ්‍යයි", "Needs attention", "கவனம் தேவை")}</h2>
          {allAttentionActions.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white">{allAttentionActions.length}</span>
          )}
        </div>
        {allAttentionActions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 bg-slate-800/40 px-4 py-3 text-sm text-slate-400">
            {tt(locale, "සියල්ල පැහැදිලිය — කිසිවක් ඔබේ තීරණය අවශ්‍ය නොවේ.", "Everything is clear — nothing needs your decision right now.", "அனைத்தும் தெளிவாக உள்ளது — தற்போது எதுவும் உங்கள் முடிவுக்குத் தேவையில்லை.")}
          </p>
        ) : (
          <AttentionList actions={allAttentionActions} locale={locale} />
        )}
      </div>

      {/* Highlights — the positive counterpart to Needs attention above.
          Real facts only (see the highlights array's own docstring);
          the whole card is skipped when there's nothing genuine to show,
          rather than rendering an empty "no highlights" state. */}
      {highlights.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
          <h2 className="mb-3 text-base font-bold tracking-tight text-slate-100">{tt(locale, "විශේෂාංග", "Highlights", "சிறப்பம்சங்கள்")}</h2>
          <div className="space-y-2">
            {highlights.map((highlight) => (
              <div key={highlight.key} className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-400">
                  <CheckIcon className="h-4 w-4" />
                </span>
                <p className="text-sm font-semibold text-emerald-200">{highlight.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roll inventory. */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-slate-100">{tt(locale, "රෙදි Roll තොගය", "Roll inventory", "துணி Roll சரக்கு")}</h2>
          <Link href="/stock/rolls" className="text-xs font-semibold text-teal-300 hover:underline">
            {tt(locale, "සියලු Rolls බලන්න →", "View all rolls →", "அனைத்து Rolls பார்க்க →")}
          </Link>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
          <div className="p-3.5">
            <p className="text-xl font-bold text-slate-50">{rollSummary ? rollSummary.activeRolls : "—"}</p>
            <p className="text-xs text-slate-400">{tt(locale, "විකිණිය හැකි Rolls", "Sellable rolls", "விற்கக்கூடிய Rolls")}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xl font-bold text-slate-50">
              {rollSummary ? rollSummary.metres.toLocaleString("en-LK", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : "—"}
              <span className="ml-1 text-xs font-medium text-slate-500">m</span>
            </p>
            <p className="text-xs text-slate-400">{tt(locale, "මුළු මීටර්", "Total metres", "மொத்த மீட்டர்கள்")}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xl font-bold text-slate-50">
              {rollSummary ? rollSummary.yards.toLocaleString("en-LK", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : "—"}
              <span className="ml-1 text-xs font-medium text-slate-500">yd</span>
            </p>
            <p className="text-xs text-slate-400">{tt(locale, "මුළු යාර්ඩ්", "Total yards", "மொத்த யார்டுகள்")}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xl font-bold text-slate-50">{rollSummary ? rollSummary.remnants : "—"}</p>
            <p className="text-xs text-slate-400">{tt(locale, "ඉතිරි කැබලි", "Remnants", "மீதிகள்")}</p>
          </div>
        </div>
      </div>

      {/* Stock & spending — the "what's on the shelf and what did it cost"
          half of the page, deliberately separate from the sales/profit
          hero above. Stock value is real (owner intelligence RPC — see the
          fetch effect's docstring for why this, not stats.stockValue);
          expenses follow the page's own This month / Last month switch, so
          it stays consistent with every other figure here. Not covered by
          the sample-preview banner — both sources are real regardless of
          whether a sale has happened yet. Operating costs breaks the total
          into its real categories (rent/utilities/salaries/...) rather than
          one lump figure — only categories with real spend this period
          render, nothing padded in. */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
        <h2 className="mb-3 text-base font-bold tracking-tight text-slate-100">{tt(locale, "තොගය සහ වියදම්", "Stock & spending", "சரக்கு & செலவு")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-lg font-bold text-slate-50">{stockValueLkr != null ? formatCompactLkr(stockValueLkr) : "—"}</p>
            <p className="text-xs text-slate-400">{tt(locale, "තොග වටිනාකම", "Stock value", "சரக்கு மதிப்பு")}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-50">{expensesTotal != null ? formatCompactLkr(expensesTotal) : "—"}</p>
            <p className="text-xs text-slate-400">
              {period === "this_month" ? tt(locale, "මෙම මාසයේ වියදම්", "Expenses this month", "இந்த மாத செலவுகள்") : tt(locale, "පසුගිය මාසයේ වියදම්", "Expenses last month", "கடந்த மாத செலவுகள்")}
            </p>
          </div>
        </div>

        {expensesByCategory.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              {tt(locale, "මෙහෙයුම් වියදම්", "Operating costs", "செயல்பாட்டு செலவுகள்")}
            </p>
            <div className="flex flex-wrap gap-2">
              {expensesByCategory.map(({ category, amount }) => {
                const Icon = expenseCategoryIcon(category);
                return (
                  <div key={category} className="flex min-w-[7.5rem] flex-1 items-center gap-2 rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-slate-400 ring-1 ring-inset ring-slate-800">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-300">{t(`expenses.cat_${category}`)}</p>
                      <p className="text-sm font-bold text-slate-50">{formatCompactLkr(amount)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Today at a glance — real "today" figures from getDashboardStats()
          while a real sale exists; SAMPLE_PULSE (covered by the banner
          above) while noTransactionsYet. The reference mockup's third
          tile was a same-day cut count; no reliably real, date-scoped
          "cuts today" figure exists yet (the workflow snapshot only
          tracks currently-pending cuts, not a completed-today count), so
          the real state uses payments collected today instead. */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
        <h2 className="mb-3 text-base font-bold tracking-tight text-slate-100">{tt(locale, "අද දිනය", "Today at a glance", "இன்று ஒரு பார்வையில்")}</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-lg font-bold text-slate-50">{noTransactionsYet ? SAMPLE_PULSE.todaySaleCount : stats.saleCount}</p>
            <p className="text-xs text-slate-400">{tt(locale, "අද අලෙවි", "Sales today", "இன்று விற்பனை")}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-50">{formatCompactLkr(noTransactionsYet ? SAMPLE_PULSE.todaySalesValue : stats.todaySales)}</p>
            <p className="text-xs text-slate-400">{tt(locale, "අද අලෙවි අගය", "Sales value", "விற்பனை மதிப்பு")}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-50">{formatCompactLkr(noTransactionsYet ? SAMPLE_PULSE.todayCollected : stats.paymentsReceivedToday)}</p>
            <p className="text-xs text-slate-400">{tt(locale, "අද එකතු කළ", "Collected today", "இன்று வசூலிக்கப்பட்டது")}</p>
          </div>
        </div>
      </div>

      {/* Primary actions — always both, matching the reference layout;
          the hero no longer carries its own inline CTA. */}
      <div className="space-y-2 pb-2">
        <Link
          href="/sales"
          className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-teal-500 px-4 text-sm font-bold text-white shadow-sm hover:bg-teal-600"
        >
          + {tt(locale, "නව රෙදි අලෙවියක්", "New fabric sale", "புதிய துணி விற்பனை")}
        </Link>
        <Link
          href="/stock/rolls?receive=1"
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800/60"
        >
          {tt(locale, "Roll ලබාගන්න", "Receive roll", "Roll பெறவும்")}
        </Link>
      </div>

      {/* Mobile-only quick nav — mirrors the header's account panel and
          the needs-attention anchor rather than duplicating the full
          operational sidebar (see PulseShell's docstring). */}
      <nav
        aria-label={tt(locale, "ඉක්මන් සංචලනය", "Quick navigation", "விரைவு வழிசெலுத்தல்")}
        className="fixed inset-x-0 bottom-0 z-30 mx-auto grid h-[4.25rem] max-w-md grid-cols-5 border-x border-t border-slate-800 bg-slate-900/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden"
      >
        <span className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-teal-300" aria-current="page">
          <HomeIcon className="h-5 w-5" />
          {tt(locale, "මුල් පිටුව", "Home", "முகப்பு")}
        </span>
        <Link href="/sales" className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-400">
          <SalesIcon className="h-5 w-5" />
          {tt(locale, "අලෙවි", "Sales", "விற்பனை")}
        </Link>
        <Link href="/stock/rolls" className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-400">
          <StockIcon className="h-5 w-5" />
          {tt(locale, "Rolls", "Rolls", "Rolls")}
        </Link>
        <button type="button" onClick={scrollToAttention} className="relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-400">
          <BellIcon className="h-5 w-5" />
          {tt(locale, "ඇඟවීම්", "Alerts", "விழிப்பூட்டல்")}
          {allAttentionActions.length > 0 && (
            <span className="absolute right-[calc(50%-1.35rem)] top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white">
              {allAttentionActions.length > 9 ? "9+" : allAttentionActions.length}
            </span>
          )}
        </button>
        <Link href="/dashboard" className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-400">
          <MoreIcon className="h-5 w-5" />
          {tt(locale, "තව", "More", "மேலும்")}
        </Link>
      </nav>
    </PulseShell>
  );
}

/** Attention list body — split out so the "View N more" expand/collapse
 * has its own small piece of state without cluttering the page component. */
function AttentionList({ actions, locale }: { actions: ReturnType<typeof buildTextileAttentionActions>; locale: Locale }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? actions : actions.slice(0, 2);
  return (
    <div className="space-y-2">
      {visible.map((action) => {
        const Icon = attentionIcon(action.key);
        const tone = action.tone === "danger" ? "bg-rose-400/10 text-rose-400" : "bg-amber-400/10 text-amber-400";
        return (
          <div key={action.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{action.title}</p>
                <p className="truncate text-xs text-slate-400">{action.detail}</p>
              </div>
            </div>
            <Link
              href={action.href}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold ${action.tone === "danger" ? "border-rose-400/30 text-rose-400 hover:bg-rose-400/10" : "border-amber-400/30 text-amber-400 hover:bg-amber-400/10"}`}
            >
              {attentionActionLabel(action.key as AttentionActionKey, locale)}
            </Link>
          </div>
        );
      })}
      {actions.length > 2 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-center gap-1 pt-1 text-xs font-semibold text-teal-300 hover:underline">
          {expanded ? tt(locale, "අඩුවෙන් පෙන්වන්න", "Show less", "குறைவாகக் காட்டு") : tt(locale, `තව ${actions.length - 2}ක් බලන්න`, `View ${actions.length - 2} more`, `மேலும் ${actions.length - 2} பார்க்க`)}
          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
