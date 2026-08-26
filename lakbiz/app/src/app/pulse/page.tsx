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
 */
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { ProLoadingState } from "@/components/ui/pro-shell";
import { EmptyState } from "@/components/ui/primitives";
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
  sparkline: [3.9, 4.15, 3.75, 4.3, 4.0, 4.55, 4.25, 4.82].map((m) => m * 1_000_000),
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
 * No axes, no labels: it exists purely to show shape/direction at a glance. */
function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  if (values.length < 2) return null;
  const w = 96;
  const h = 32;
  const padY = 4;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * w,
    y: padY + (h - padY * 2) - ((v - min) / range) * (h - padY * 2),
  }));
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-24 shrink-0" aria-hidden="true">
      <path d={smoothPath(points)} fill="none" stroke={stroke} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="2.5" fill={stroke} />
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
  default: "text-slate-950",
  positive: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700",
};

/** One card in the horizontally-scrolling stat row. Deliberately no
 * sparkline here — unlike the hero, none of these (receivables balance,
 * active reservations, quality holds) have a real historical series
 * cheaply available, and a fabricated trend line would misrepresent one
 * that doesn't exist. */
function StatCard({ label, value, hint, tone = "default" }: { label: string; value: string; hint: string; tone?: StatTone }) {
  return (
    <div className="w-[13.5rem] shrink-0 snap-start rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tracking-[-0.02em] ${STAT_VALUE_TONE[tone]}`}>{value}</p>
      <p className={`mt-1 text-xs font-medium ${tone === "danger" ? "text-rose-600" : "text-slate-400"}`}>{hint}</p>
    </div>
  );
}

type AttentionActionKey = "roll-holds" | "overdue-credit" | "pending-cuts" | "pending-dispatches";

function attentionIcon(key: string) {
  if (key === "roll-holds") return ShieldIcon;
  if (key === "overdue-credit") return AlertTriangleIcon;
  if (key === "pending-cuts") return CostingIcon;
  return SuppliersIcon;
}

function attentionActionLabel(key: string, locale: Locale): string {
  if (key === "roll-holds") return tt(locale, "සමාලෝචනය", "Review", "மறுஆய்வு");
  if (key === "overdue-credit") return tt(locale, "එකතු කරන්න", "Collect", "வசூலி");
  if (key === "pending-cuts") return tt(locale, "කපන්න", "Cut", "வெட்டு");
  return tt(locale, "යවන්න", "Dispatch", "அனுப்பு");
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
    <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
      <div className="rounded-xl bg-slate-50 px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-slate-950">{org.name}</p>
        <p className="truncate text-xs text-slate-500">{user?.email}</p>
      </div>
      <button
        type="button"
        onClick={() => setLocale(nextLocale(locale))}
        className="mt-1.5 flex min-h-10 w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <span>{LOCALE_NAMES[locale]}</span>
        <span className="text-xs font-semibold text-teal-700">{LOCALE_NAMES[nextLocale(locale)]} →</span>
      </button>
      <Link href="/dashboard" className="flex min-h-10 w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
        {tt(locale, "සම්පූර්ණ dashboard", "Full dashboard", "முழு dashboard")} →
      </Link>
      {user && (
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
        >
          <SignOutIcon className="h-4 w-4" />
          {tt(locale, "පිටවන්න", "Sign out", "வெளியேறு")}
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_18%_0%,rgba(20,184,166,0.055),transparent_28rem),radial-gradient(circle_at_95%_12%,rgba(56,189,248,0.035),transparent_26rem),linear-gradient(180deg,#f5f8fc_0%,#edf3f8_100%)] pb-24 text-slate-950 lg:pb-6">
      {/* Not sticky — a pinned header on a page this short adds a seam
          (and, in full-page screenshot tools that capture in scrolled
          slices, can visually duplicate mid-page) for no real benefit;
          Alerts/More in the bottom tab bar already cover the same
          reachability on mobile. */}
      <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 text-xs font-bold text-white shadow-sm shadow-teal-900/20">L</span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold tracking-tight text-slate-950">LakBiz</p>
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                className="flex items-center gap-0.5 truncate text-xs font-medium text-slate-500 hover:text-slate-700"
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
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:border-teal-200 hover:bg-teal-50"
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
              className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white"
            >
              {initialsFor(org.name, user?.email)}
            </button>
            {accountPanel}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-5 sm:px-6 sm:py-8">{children}</main>
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

  const scrollToAttention = () => {
    attentionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!ready || !data) {
    return (
      <PulseShell attentionCount={0} onBellClick={() => {}}>
        <ProLoadingState label={t("common.loading")} />
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
        <EmptyState
          title={tt(locale, "හිමිකරු පමණි", "Owner access only", "உரிமையாளர் அணுகல் மட்டும்")}
          description={tt(
            locale,
            "Business Pulse දැනට රෙදි ව්‍යාපාර හිමිකරුවන් සඳහා පමණි.",
            "Business Pulse is available to textile business owners for now.",
            "Business Pulse தற்போது துணி வணிக உரிமையாளர்களுக்கு மட்டுமே கிடைக்கும்.",
          )}
          action={
            <Link href="/dashboard" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
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

  return (
    <PulseShell attentionCount={attentionActions.length} onBellClick={scrollToAttention}>
      {/* Title row + period switch. */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-slate-950">{tt(locale, "හිමිකරු දළ විශ්ලේෂණය", "Owner overview", "உரிமையாளர் கண்ணோட்டம்")}</h1>
        <div className="relative shrink-0" ref={periodRef}>
          <button
            type="button"
            onClick={() => setPeriodOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            {period === "this_month" ? tt(locale, "මෙම මාසය", "This month", "இந்த மாதம்") : tt(locale, "පසුගිය මාසය", "Last month", "கடந்த மாதம்")}
            <ChevronDownIcon className="h-4 w-4 text-slate-400" />
          </button>
          {periodOpen && (
            <div className="absolute right-0 top-full z-20 mt-1.5 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {(["this_month", "last_month"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPeriod(p);
                    setPeriodOpen(false);
                  }}
                  className={`flex w-full items-center px-3 py-2 text-left text-sm font-medium ${period === p ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {p === "this_month" ? tt(locale, "මෙම මාසය", "This month", "இந்த மாதம்") : tt(locale, "පසුගිය මාසය", "Last month", "கடந்த மாதம்")}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {org.isAuthenticated && (
        <p className="-mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <SyncIcon className="h-3.5 w-3.5" />
          {t("dash.cloud_synced")}
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        </p>
      )}

      {/* Sample-preview banner — the one, unmistakable disclosure that
          everything inside the hero, the stat row and Today-at-a-glance
          below is illustrative (SAMPLE_PULSE), not real, until a first
          sale exists. Needs Attention and Roll inventory are NOT covered
          by this banner because they're already real. */}
      {noTransactionsYet && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-white">i</span>
          <p className="text-xs leading-5 text-amber-900">
            <span className="font-bold">{tt(locale, "නියැදි දත්ත", "Sample preview", "மாதிரி முன்னோட்டம்")}</span>{" "}
            {tt(
              locale,
              "පහත ව්‍යාපාර ස්පන්දනය, ලාභය සහ අද දිනය කොටස් නියැදි ගණන් පෙන්වයි — ඔබේ පළමු අලෙවියෙන් පසු සැබෑ ගණන් වලින් ප්‍රතිස්ථාපනය වේ. Roll තොගය සහ අවධානය අවශ්‍ය කොටස් සැබෑය.",
              "The pulse, profit and Today sections below show sample numbers — they're replaced by your real figures after your first sale. Roll inventory and Needs attention are already real.",
              "கீழே உள்ள துடிப்பு, லாபம் மற்றும் இன்று பிரிவுகள் மாதிரி எண்களைக் காட்டுகின்றன — உங்கள் முதல் விற்பனைக்குப் பிறகு உண்மையான எண்களால் மாற்றப்படும். Roll சரக்கு மற்றும் கவனம் தேவை பிரிவுகள் ஏற்கனவே உண்மையானவை.",
            )}
          </p>
        </div>
      )}

      {/* Hero — Business pulse. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">{tt(locale, "ව්‍යාපාර ස්පන්දනය", "Business pulse", "வணிக துடிப்பு")}</p>
            <p className="mt-1.5 text-[2.1rem] font-bold leading-none tracking-[-0.03em] text-slate-950 sm:text-4xl">
              {formatCompactLkr(noTransactionsYet ? SAMPLE_PULSE.netSales : selected.revenue)}
            </p>
            <p className="mt-1.5 text-xs font-medium text-slate-500">{tt(locale, "නිකුත් අලෙවිය", "Net sales", "நிகர விற்பனை")}</p>
            {(noTransactionsYet || salesChangePct != null) && (
              <p className={`mt-2 flex items-center gap-1 text-sm font-bold ${noTransactionsYet || salesUp ? "text-emerald-700" : "text-rose-700"}`}>
                ↑ {Math.abs(noTransactionsYet ? SAMPLE_PULSE.salesChangePct : (salesChangePct ?? 0))}%
                <span className="font-medium text-slate-400">{tt(locale, "පසුගිය මාසයට වඩා", "vs last month", "கடந்த மாதத்தை விட")}</span>
              </p>
            )}
          </div>
          <Sparkline values={noTransactionsYet ? SAMPLE_PULSE.sparkline : sparklineValues} stroke="#0d9488" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
          <div>
            <p className="text-xs font-semibold text-slate-500">{tt(locale, "දළ ලාභය", "Gross profit", "மொத்த லாபம்")}</p>
            <p className="mt-1 text-xl font-bold tracking-[-0.02em] text-slate-950">
              {formatCompactLkr(noTransactionsYet ? SAMPLE_PULSE.grossProfit : selected.profit)}
            </p>
            <p className="mt-0.5 text-xs font-medium text-emerald-700">
              {noTransactionsYet ? SAMPLE_PULSE.marginPct : marginPct}% {tt(locale, "ආන්තිකය", "margin", "விளிம்பு")}
            </p>
          </div>
          <div className="border-l border-slate-100 pl-4">
            <p className="text-xs font-semibold text-slate-500">{tt(locale, "එකතු කළ මුදල්", "Cash collected", "வசூலிக்கப்பட்ட பணம்")}</p>
            <p className="mt-1 text-xl font-bold tracking-[-0.02em] text-slate-950">
              {formatCompactLkr(noTransactionsYet ? SAMPLE_PULSE.cashCollected : cashCollected)}
            </p>
            {(noTransactionsYet || cashChangePct != null) && (
              <p className="mt-0.5 text-xs font-medium text-emerald-700">
                ↑ {Math.abs(noTransactionsYet ? SAMPLE_PULSE.cashChangePct : (cashChangePct ?? 0))}% {tt(locale, "පසුගිය මාසයට වඩා", "vs last month", "கடந்த மாதத்தை விட")}
              </p>
            )}
          </div>
        </div>
      </div>

      {noTransactionsYet && (
        <p className="-mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
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
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === activeCard ? "w-4 bg-teal-600" : "w-1.5 bg-slate-300"}`} />
        ))}
      </div>

      {/* Needs attention — same single source of truth as the dashboard's
          Needs Attention card and the sector command centre
          (buildTextileAttentionActions). Never a separate, potentially
          contradictory list. */}
      <div ref={attentionSectionRef} className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-bold tracking-tight text-slate-900">{tt(locale, "අවධානය අවශ්‍යයි", "Needs attention", "கவனம் தேவை")}</h2>
          {attentionActions.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white">{attentionActions.length}</span>
          )}
        </div>
        {attentionActions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-500">
            {tt(locale, "සියල්ල පැහැදිලිය — කිසිවක් ඔබේ තීරණය අවශ්‍ය නොවේ.", "Everything is clear — nothing needs your decision right now.", "அனைத்தும் தெளிவாக உள்ளது — தற்போது எதுவும் உங்கள் முடிவுக்குத் தேவையில்லை.")}
          </p>
        ) : (
          <AttentionList actions={attentionActions} locale={locale} />
        )}
      </div>

      {/* Roll inventory. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-slate-900">{tt(locale, "රෙදි Roll තොගය", "Roll inventory", "துணி Roll சரக்கு")}</h2>
          <Link href="/stock/rolls" className="text-xs font-semibold text-teal-700 hover:underline">
            {tt(locale, "සියලු Rolls බලන්න →", "View all rolls →", "அனைத்து Rolls பார்க்க →")}
          </Link>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
          <div className="p-3.5">
            <p className="text-xl font-bold text-slate-950">{rollSummary ? rollSummary.activeRolls : "—"}</p>
            <p className="text-xs text-slate-500">{tt(locale, "විකිණිය හැකි Rolls", "Sellable rolls", "விற்கக்கூடிய Rolls")}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xl font-bold text-slate-950">
              {rollSummary ? rollSummary.metres.toLocaleString("en-LK", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : "—"}
              <span className="ml-1 text-xs font-medium text-slate-400">m</span>
            </p>
            <p className="text-xs text-slate-500">{tt(locale, "මුළු මීටර්", "Total metres", "மொத்த மீட்டர்கள்")}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xl font-bold text-slate-950">
              {rollSummary ? rollSummary.yards.toLocaleString("en-LK", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : "—"}
              <span className="ml-1 text-xs font-medium text-slate-400">yd</span>
            </p>
            <p className="text-xs text-slate-500">{tt(locale, "මුළු යාර්ඩ්", "Total yards", "மொத்த யார்டுகள்")}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xl font-bold text-slate-950">{rollSummary ? rollSummary.remnants : "—"}</p>
            <p className="text-xs text-slate-500">{tt(locale, "ඉතිරි කැබලි", "Remnants", "மீதிகள்")}</p>
          </div>
        </div>
      </div>

      {/* Today at a glance — real "today" figures from getDashboardStats()
          while a real sale exists; SAMPLE_PULSE (covered by the banner
          above) while noTransactionsYet. The reference mockup's third
          tile was a same-day cut count; no reliably real, date-scoped
          "cuts today" figure exists yet (the workflow snapshot only
          tracks currently-pending cuts, not a completed-today count), so
          the real state uses payments collected today instead. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
        <h2 className="mb-3 text-base font-bold tracking-tight text-slate-900">{tt(locale, "අද දිනය", "Today at a glance", "இன்று ஒரு பார்வையில்")}</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-lg font-bold text-slate-950">{noTransactionsYet ? SAMPLE_PULSE.todaySaleCount : stats.saleCount}</p>
            <p className="text-xs text-slate-500">{tt(locale, "අද අලෙවි", "Sales today", "இன்று விற்பனை")}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-950">{formatCompactLkr(noTransactionsYet ? SAMPLE_PULSE.todaySalesValue : stats.todaySales)}</p>
            <p className="text-xs text-slate-500">{tt(locale, "අද අලෙවි අගය", "Sales value", "விற்பனை மதிப்பு")}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-950">{formatCompactLkr(noTransactionsYet ? SAMPLE_PULSE.todayCollected : stats.paymentsReceivedToday)}</p>
            <p className="text-xs text-slate-500">{tt(locale, "අද එකතු කළ", "Collected today", "இன்று வசூலிக்கப்பட்டது")}</p>
          </div>
        </div>
      </div>

      {/* Primary actions — always both, matching the reference layout;
          the hero no longer carries its own inline CTA. */}
      <div className="space-y-2 pb-2">
        <Link
          href="/sales"
          className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-teal-700"
        >
          + {tt(locale, "නව රෙදි අලෙවියක්", "New fabric sale", "புதிய துணி விற்பனை")}
        </Link>
        <Link
          href="/stock/rolls?receive=1"
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {tt(locale, "Roll ලබාගන්න", "Receive roll", "Roll பெறவும்")}
        </Link>
      </div>

      {/* Mobile-only quick nav — mirrors the header's account panel and
          the needs-attention anchor rather than duplicating the full
          operational sidebar (see PulseShell's docstring). */}
      <nav
        aria-label={tt(locale, "ඉක්මන් සංචලනය", "Quick navigation", "விரைவு வழிசெலுத்தல்")}
        className="fixed inset-x-0 bottom-0 z-30 grid h-[4.25rem] grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden"
      >
        <span className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-teal-700" aria-current="page">
          <HomeIcon className="h-5 w-5" />
          {tt(locale, "මුල් පිටුව", "Home", "முகப்பு")}
        </span>
        <Link href="/sales" className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-500">
          <SalesIcon className="h-5 w-5" />
          {tt(locale, "අලෙවි", "Sales", "விற்பனை")}
        </Link>
        <Link href="/stock/rolls" className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-500">
          <StockIcon className="h-5 w-5" />
          {tt(locale, "Rolls", "Rolls", "Rolls")}
        </Link>
        <button type="button" onClick={scrollToAttention} className="relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-500">
          <BellIcon className="h-5 w-5" />
          {tt(locale, "ඇඟවීම්", "Alerts", "விழிப்பூட்டல்")}
          {attentionActions.length > 0 && (
            <span className="absolute right-[calc(50%-1.35rem)] top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white">
              {attentionActions.length > 9 ? "9+" : attentionActions.length}
            </span>
          )}
        </button>
        <Link href="/dashboard" className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-500">
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
        const tone = action.tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600";
        return (
          <div key={action.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{action.title}</p>
                <p className="truncate text-xs text-slate-500">{action.detail}</p>
              </div>
            </div>
            <Link
              href={action.href}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold ${action.tone === "danger" ? "border-rose-200 text-rose-700 hover:bg-rose-50" : "border-amber-200 text-amber-700 hover:bg-amber-50"}`}
            >
              {attentionActionLabel(action.key as AttentionActionKey, locale)}
            </Link>
          </div>
        );
      })}
      {actions.length > 2 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-center gap-1 pt-1 text-xs font-semibold text-teal-700 hover:underline">
          {expanded ? tt(locale, "අඩුවෙන් පෙන්වන්න", "Show less", "குறைவாகக் காட்டு") : tt(locale, `තව ${actions.length - 2}ක් බලන්න`, `View ${actions.length - 2} more`, `மேலும் ${actions.length - 2} பார்க்க`)}
          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
