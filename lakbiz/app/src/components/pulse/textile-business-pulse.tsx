"use client";

/**
 * Business Pulse — textile variant. See pulse-shared.tsx for the shell,
 * hero primitives (Sparkline/StatCard/summary line) and the Needs
 * attention / Highlights list components every sector variant shares.
 *
 * Every number here is read from the same sources /dashboard already
 * uses — getDashboardStats(), fetchSectorOperationalSnapshot(),
 * buildTextileAttentionActions(), getRevenueTrend() — plus two small,
 * honestly-derived local figures built from the exact same formula the
 * dashboard already uses for "today", just re-scoped to a month. No
 * fabricated numbers, no fake trend lines: a stat card only gets a
 * sparkline where a real time series backs it.
 *
 * "Stock & spending" (stock value, expenses, needs-purchasing): stock
 * value comes from fetchTextileOwnerIntelligence() — the same owner-gated
 * RPC that backs /textile/owner-intelligence — not the generic
 * getDashboardStats().stockValue, which is driven by a product-count
 * field textile roll receiving never updates and would be stale for a
 * fabric business. Expenses come from fetchOrgExpenses() (not part of the
 * offline store, so fetched separately here). "Needs purchasing" uses a
 * fixed threshold (LOW_STOCK_THRESHOLD) rather than a per-fabric reorder
 * point, because that setting doesn't exist yet.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  BoltIcon,
  TeamIcon,
  VehiclesIcon,
  ChatIcon,
  ExpenseIcon,
  SettingsIcon,
  ShopIcon,
} from "@/components/ui/icons";
import { useLocale } from "@/lib/i18n/locale-provider";
import { getDashboardStats } from "@/lib/store/actions";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { fetchSectorOperationalSnapshot, summarizeTextileRolls, type SectorOperationalSnapshot } from "@/lib/supabase/sector-dashboard-client";
import { buildTextileAttentionActions } from "@/components/dashboard/sector-command-center";
import { getRevenueTrend, type Locale } from "@/lib/revenue-trend";
import { fetchTextileOwnerIntelligence, type TextileOwnerIntelligence } from "@/lib/supabase/textile-intelligence-client";
import { fetchOrgExpenses, type Expense } from "@/lib/supabase/expenses-client";
import {
  tt,
  formatCompactLkr,
  monthCashCollected,
  Sparkline,
  StatCard,
  buildSummaryLine,
  PulseShell,
  PulseLoadingState,
  AttentionList,
  HighlightsCard,
  type PulseAction,
} from "@/components/pulse/pulse-shared";

/**
 * Illustrative numbers only — shown exclusively when noTransactionsYet is
 * true, always behind the "Sample preview" banner below, and never written
 * anywhere real numbers are read from. This exists purely so a brand-new
 * owner can see what Business Pulse looks like once it has something to
 * show — it must never be reachable once a real sale exists.
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
  sparkline: [3.9, 4.05, 4.2, 4.1, 4.35, 4.5, 4.4, 4.82].map((m) => m * 1_000_000),
  todaySaleCount: 12,
  todaySalesValue: 684_500,
  todayCollected: 512_000,
};

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
 * emoji; matches the rest of the codebase's de-emoji convention). Falls
 * through to ExpenseIcon for anything not explicitly mapped. */
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

/** Fixed, undisclosed-to-user threshold for the v1 "needs purchasing"
 * signal — there's no real reorder-point setting per fabric type yet, so
 * this is a simple, honest placeholder: flag any active fabric with 10 or
 * fewer units remaining across all its live rolls. Good enough to catch
 * "about to run out" without a settings screen; a real per-fabric
 * threshold is a follow-up. */
const LOW_STOCK_THRESHOLD = 10;

export function TextileBusinessPulse() {
  const { data, ready } = useAppStore();
  const { locale, t } = useLocale();
  const { org, canSeeFinancials } = useSubscription();
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
    if (!org.isAuthenticated || !org.id) {
      setTextileSnapshot(null);
      return;
    }
    let cancelled = false;
    void fetchSectorOperationalSnapshot(org.id, "textile", canSeeFinancials).then((result) => {
      if (!cancelled) setTextileSnapshot(result);
    });
    return () => {
      cancelled = true;
    };
  }, [canSeeFinancials, org.id, org.isAuthenticated]);

  // Real stock value (Σ remaining_length × real roll cost) — the same
  // owner-gated database function that backs /textile/owner-intelligence's
  // "Stock value" figure, not the generic stats.stockValue. stock_by_unit
  // is a current-state snapshot, not period-bound, so the from/to window
  // only needs to be wide enough for the RPC call to succeed.
  const [ownerIntelligence, setOwnerIntelligence] = useState<TextileOwnerIntelligence | null>(null);
  useEffect(() => {
    if (!org.isAuthenticated || !org.id) {
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
  }, [org.id, org.isAuthenticated]);

  // This month's / last month's expenses — real, from the same expense
  // tracker /expenses uses. Never loaded into the offline app store, so
  // it's fetched here separately.
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

  const stats = getDashboardStats(data);
  const rollSummary = textileSnapshot ? summarizeTextileRolls(textileSnapshot) : null;
  const rawAttentionActions = textileSnapshot ? buildTextileAttentionActions(textileSnapshot, locale) : [];
  const qualityHolds = textileSnapshot ? textileSnapshot.textileRolls.filter((roll) => roll.status === "quarantined").length : 0;
  // Same "inventory ready, nothing sold yet" state the dashboard's Phase 1
  // fix already handles — a hero showing "Rs. 0" everywhere reads as a
  // broken app, not a premium one, for a shop that just finished
  // onboarding. Real rolls exist, real sales don't yet: show that
  // honestly instead of a wall of zeros.
  const noTransactionsYet = (rollSummary?.activeRolls ?? 0) > 0 && data.sales.length === 0;
  // Receivables + [Stock value while noTransactionsYet] + Reservations + Quality holds.
  const statCardCount = noTransactionsYet ? 4 : 3;

  // One 12-month trend backs the hero, its sparkline and both period
  // options ("this month" / "last month") — a single bucket definition
  // instead of mixing it with getDashboardStats()'s separately-bucketed
  // monthSales, so the hero number and the sparkline it sits next to can
  // never quietly disagree.
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
  // intelligence RPC. null while the RPC hasn't returned yet, so the UI
  // can show "—" instead of a false Rs. 0.
  const stockValueLkr = ownerIntelligence ? ownerIntelligence.stock_by_unit.reduce((sum, unit) => sum + (unit.stock_value_lkr ?? 0), 0) : null;

  // Expenses for whichever period the page's own "This month / Last month"
  // switch is set to, so a reader flipping the switch sees every figure
  // on the page move together.
  const monthExpenses = expenses ? expenses.filter((expense) => expense.expenseDate.startsWith(selected.key)) : null;
  const expensesTotal = monthExpenses ? monthExpenses.reduce((sum, expense) => sum + expense.amount, 0) : null;
  // Per-category breakdown (Operating costs) — only categories that
  // actually have spend this period show up; nothing padded in with a
  // zero to fill a fixed row. Sorted highest first.
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
  // measured against a fixed placeholder threshold rather than a
  // per-fabric reorder point nobody has set yet.
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

  const attentionActions: PulseAction[] = rawAttentionActions.map((action) => ({
    ...action,
    Icon: attentionIcon(action.key),
    actionLabel: attentionActionLabel(action.key, locale),
  }));
  const lowStockActions: PulseAction[] = lowStockFabrics.slice(0, 5).map((entry) => ({
    key: "low-stock-fabric",
    title: entry.product.name,
    detail:
      entry.remaining <= 0
        ? tt(locale, "තොගයේ නැත", "Out of stock", "கையிருப்பு இல்லை")
        : tt(
            locale,
            `${entry.remaining.toFixed(1)} ${entry.unit === "metre" ? "m" : "yd"} ඉතිරිය`,
            `${entry.remaining.toFixed(1)} ${entry.unit === "metre" ? "m" : "yd"} remaining`,
            `${entry.remaining.toFixed(1)} ${entry.unit === "metre" ? "m" : "yd"} மீதம்`,
          ),
    href: "/stock/rolls?receive=1",
    tone: entry.remaining <= 0 ? "danger" : "warning",
    actionLabel: attentionActionLabel("low-stock-fabric", locale),
    Icon: attentionIcon("low-stock-fabric"),
  }));
  const allAttentionActions = [...attentionActions, ...lowStockActions];

  // Highlights — the positive counterpart to Needs attention: real good
  // news, not manufactured praise. Every entry here is a fact already
  // derivable from data computed above; skipped entirely when there's
  // nothing genuine to report. The sales-up entry naturally doesn't
  // appear during noTransactionsYet since salesChangePct is null then.
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
    highlights.push({ key: "well-stocked", title: tt(locale, "සියලුම රෙදි වර්ග ප්‍රමාණවත් ලෙස තොගයේ ඇත", "All fabrics well stocked", "அனைத்து துணி வகைகளும் போதுமான கையிருப்பில் உள்ளன") });
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
          sale exists. Needs Attention, Roll inventory, Stock & spending
          and Highlights are NOT covered because they're already real. */}
      {noTransactionsYet && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-white">i</span>
          <p className="text-xs leading-5 text-amber-200">
            <span className="font-bold">{tt(locale, "නියැදි දත්ත", "Sample preview", "மாதிரி முன்னோட்டம்")}</span>{" "}
            {tt(
              locale,
              "පහත ව්‍යාපාර ස්පන්දනය, ලාභය සහ අද දිනය කොටස් නියැදි ගණන් පෙන්වයි — ඔබේ පළමු අලෙවියෙන් පසු සැබෑ ගණන් වලින් ප්‍රතිස්ථාපනය වේ. Roll තොගය, තොගය සහ වියදම්, විශේෂාංග, සහ අවධානය අවශ්‍ය කොටස් සැබෑය.",
              "The pulse, profit and Today sections below show sample numbers — they're replaced by your real figures after your first sale. Roll inventory, Stock & spending, Highlights, and Needs attention are already real.",
              "கீழே உள்ள துடிப்பு, லாபம் மற்றும் இன்று பிரிவுகள் மாதிரி எண்களைக் காட்டுகின்றன — உங்கள் முதல் விற்பனைக்குப் பிறகு உண்மையான எண்களால் மாற்றப்படும். Roll கையிருப்பு, கையிருப்பு & செலவு, சிறப்பம்சங்கள், மற்றும் கவனம் தேவை பிரிவுகள் ஏற்கனவே உண்மையானவை.",
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
              {noTransactionsYet ? SAMPLE_PULSE.marginPct : marginPct}% {tt(locale, "ආන්තිකය", "margin", "லாப வரம்பு")}
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
            `உண்மையான ${rollSummary?.activeRolls ?? 0} Rolls கையிருப்பில் தயாராக உள்ளன.`,
          )}
        </p>
      )}

      {/* Stat carousel. Receivables and Stock value use SAMPLE_PULSE while
          noTransactionsYet; Reservations and Quality holds are always
          real — no fabricated trend line either way. */}
      <div
        ref={carouselRef}
        onScroll={(e) => {
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
            label={tt(locale, "තොග වටිනාකම", "Stock value", "கையிருப்பு மதிப்பு")}
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
      <div className="-mt-1.5 flex items-center justify-center gap-1.5" aria-hidden="true">
        {Array.from({ length: statCardCount }, (_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === activeCard ? "w-4 bg-teal-500" : "w-1.5 bg-slate-700"}`} />
        ))}
      </div>

      {/* Needs attention — same single source of truth as the dashboard's
          Needs Attention card and the sector command centre. */}
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
          <AttentionList actions={allAttentionActions} />
        )}
      </div>

      {highlights.length > 0 && (
        <HighlightsCard title={tt(locale, "විශේෂාංග", "Highlights", "சிறப்பம்சங்கள்")} highlights={highlights} />
      )}

      {/* Roll inventory. */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-slate-100">{tt(locale, "රෙදි Roll තොගය", "Roll inventory", "துணி Roll கையிருப்பு")}</h2>
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

      {/* Stock & spending. */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
        <h2 className="mb-3 text-base font-bold tracking-tight text-slate-100">{tt(locale, "තොගය සහ වියදම්", "Stock & spending", "கையிருப்பு & செலவு")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-lg font-bold text-slate-50">{stockValueLkr != null ? formatCompactLkr(stockValueLkr) : "—"}</p>
            <p className="text-xs text-slate-400">{tt(locale, "තොග වටිනාකම", "Stock value", "கையிருப்பு மதிப்பு")}</p>
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

      {/* Today at a glance. */}
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

      {/* Primary actions. */}
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

      {/* Mobile-only quick nav. */}
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
          {tt(locale, "ඇඟවීම්", "Alerts", "எச்சரிக்கைகள்")}
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
