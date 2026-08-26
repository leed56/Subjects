"use client";

/**
 * Business Pulse — pharmacy variant. See pulse-shared.tsx for the shell,
 * hero primitives and the Needs attention / Highlights list components
 * every sector variant shares; see textile-business-pulse.tsx for the
 * sibling this was extracted alongside.
 *
 * Almost everything here comes from one existing, already-real function —
 * buildRetailDashboardIntelligence() (retail-intelligence.ts) — the same
 * one /dashboard's pharmacy command centre already uses. It's computed
 * locally from data already in the offline store (no RPC round-trip like
 * textile needed for stock value), plus one real async fetch for batch/
 * lot rows (fetchRetailDashboardLots) the same command centre also uses.
 * Net sales/profit/cash-collected still come from getRevenueTrend() and
 * monthCashCollected() — both sector-agnostic (Sale[]/CustomerPayment[]),
 * so the hero and its period switch work identically to the textile page.
 *
 * "Needs attention" uses intel.expiryQueue (medicines going out of date
 * within 90 days) and intel.reorderQueue (active products at/under their
 * reorder level) — real, itemized, already computed. Expired-lot and
 * quarantine-lot counts are surfaced as aggregate figures instead (only
 * counts are available, not itemized rows, from buildExpiryMetrics).
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
  AlertTriangleIcon,
  CalendarIcon,
  SyncIcon,
} from "@/components/ui/icons";
import { useLocale } from "@/lib/i18n/locale-provider";
import { getDashboardStats } from "@/lib/store/actions";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { getRevenueTrend } from "@/lib/revenue-trend";
import { buildRetailDashboardIntelligence, type RetailLotSnapshot } from "@/lib/dashboard/retail-intelligence";
import { fetchRetailDashboardLots } from "@/lib/supabase/retail-dashboard-client";
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
 * true, always behind the "Sample preview" banner below, and never
 * written anywhere real numbers are read from. Mirrors
 * textile-business-pulse.tsx's SAMPLE_PULSE, scaled to a pharmacy-sized
 * shop instead of a fabric wholesaler.
 */
const SAMPLE_PULSE = {
  netSales: 1_640_000,
  salesChangePct: 8,
  grossProfit: 410_000,
  marginPct: 25,
  cashCollected: 1_260_000,
  cashChangePct: 6,
  receivables: 185_000,
  stockValue: 2_180_000,
  sparkline: [1.32, 1.4, 1.46, 1.42, 1.52, 1.58, 1.55, 1.64].map((m) => m * 1_000_000),
  todaySaleCount: 34,
  todaySalesValue: 96_500,
  todayCollected: 88_200,
};

export function PharmacyBusinessPulse() {
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

  // Real batch/lot rows — the same fetch the pharmacy command centre on
  // /dashboard already uses for expiry tracking (fetchRetailDashboardLots).
  const [lots, setLots] = useState<RetailLotSnapshot[]>([]);
  useEffect(() => {
    if (!org.isAuthenticated || !org.id) {
      setLots([]);
      return;
    }
    let cancelled = false;
    void fetchRetailDashboardLots(org.id).then((result) => {
      if (!cancelled) setLots(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [org.id, org.isAuthenticated]);

  // This month's / last month's expenses — same generic expense tracker
  // the textile variant uses, unchanged.
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
  const intel = buildRetailDashboardIntelligence(data, "pharmacy", canSeeFinancials, lots);
  // Same "inventory ready, nothing sold yet" state the dashboard's Phase 1
  // fix already handles for textile — a hero showing "Rs. 0" everywhere
  // reads as a broken app, not a premium one, for a shop that just
  // finished onboarding.
  const noTransactionsYet = intel.activeSkuCount > 0 && data.sales.length === 0;
  const statCardCount = noTransactionsYet ? 4 : 3;

  // Same trend engine the textile variant uses — sector-agnostic, sourced
  // from data.sales directly.
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

  // Real stock value — already computed locally by buildRetailDashboardIntelligence
  // from data.products (unlike textile, no separate RPC needed here since
  // pharmacy stock isn't roll-tracked). Cost basis when visible, sell
  // value otherwise — both real either way.
  const stockValueLkr = intel.inventoryCostValue ?? intel.inventorySellValue;

  const monthExpenses = expenses ? expenses.filter((expense) => expense.expenseDate.startsWith(selected.key)) : null;
  const expensesTotal = monthExpenses ? monthExpenses.reduce((sum, expense) => sum + expense.amount, 0) : null;
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

  const expiryActions: PulseAction[] = intel.expiryQueue.slice(0, 5).map((item) => ({
    key: `expiry-${item.id}`,
    title: item.productName,
    detail: tt(
      locale,
      `Batch ${item.batchNo} — දින ${item.daysToExpiry}කින් කල් ඉකුත් වේ`,
      `Batch ${item.batchNo} — expires in ${item.daysToExpiry} day${item.daysToExpiry === 1 ? "" : "s"}`,
      `Batch ${item.batchNo} — ${item.daysToExpiry} நாட்களில் காலாவதியாகும்`,
    ),
    href: "/stock",
    tone: item.daysToExpiry <= 14 ? "danger" : "warning",
    actionLabel: tt(locale, "සමාලෝචනය", "Review", "மறுஆய்வு"),
    Icon: item.daysToExpiry <= 14 ? AlertTriangleIcon : CalendarIcon,
  }));
  const reorderActions: PulseAction[] = intel.reorderQueue.slice(0, 5).map((item) => ({
    key: `reorder-${item.productId}`,
    title: item.name,
    detail:
      item.stockQty <= 0
        ? tt(locale, "තොගයේ නැත", "Out of stock", "சரக்கு இல்லை")
        : tt(locale, `${item.stockQty} ${item.unit} ඉතිරිය`, `${item.stockQty} ${item.unit} remaining`, `${item.stockQty} ${item.unit} மீதம்`),
    href: "/stock/advanced/receive",
    tone: item.stockQty <= 0 ? "danger" : "warning",
    actionLabel: tt(locale, "මිලදී ගන්න", "Buy", "வாங்கு"),
    Icon: item.stockQty <= 0 ? AlertTriangleIcon : StockIcon,
  }));
  const allAttentionActions = [...expiryActions, ...reorderActions];

  // Highlights — real facts only, the positive counterpart to Needs
  // attention. Skipped entirely (not an empty card) when nothing genuine
  // to report.
  const highlights: { key: string; title: string }[] = [];
  if (salesChangePct != null && salesChangePct > 0) {
    highlights.push({
      key: "sales-up",
      title: tt(locale, `අලෙවිය පසුගිය මාසයට වඩා ${salesChangePct}%කින් ඉහළ`, `Sales up ${salesChangePct}% vs last month`, `கடந்த மாதத்தை விட விற்பனை ${salesChangePct}% அதிகரிப்பு`),
    });
  }
  if (intel.activeSkuCount > 0 && intel.nearExpiryCount === 0 && intel.expiredLotCount === 0) {
    highlights.push({ key: "no-expiry-risk", title: tt(locale, "කල් ඉකුත් වීමේ අවදානමක් නැත", "No expiry risk right now", "காலாவதி ஆபத்து இல்லை") });
  }
  if (intel.activeSkuCount > 0 && intel.outOfStockCount === 0) {
    highlights.push({ key: "no-out-of-stock", title: tt(locale, "කිසිදු භාණ්ඩයක් තොගයේ නැති නැත", "Nothing is out of stock", "எதுவும் சரக்கு தீர்ந்துவிடவில்லை") });
  }
  if (intel.activeSkuCount > 0 && intel.lowStockCount === 0) {
    highlights.push({ key: "well-stocked", title: tt(locale, "සියලුම භාණ්ඩ ප්‍රමාණවත් ලෙස තොගයේ ඇත", "All products well stocked", "அனைத்து பொருட்களும் போதுமான சரக்கில் உள்ளன") });
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

      {/* Sample-preview banner — everything inside the hero, the stat row
          and Today-at-a-glance below is illustrative until a first sale
          exists. Needs attention, Medicine stock, Stock & spending and
          Highlights are NOT covered because they're already real. */}
      {noTransactionsYet && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-white">i</span>
          <p className="text-xs leading-5 text-amber-200">
            <span className="font-bold">{tt(locale, "නියැදි දත්ත", "Sample preview", "மாதிரி முன்னோட்டம்")}</span>{" "}
            {tt(
              locale,
              "පහත ව්‍යාපාර ස්පන්දනය, ලාභය සහ අද දිනය කොටස් නියැදි ගණන් පෙන්වයි — ඔබේ පළමු අලෙවියෙන් පසු සැබෑ ගණන් වලින් ප්‍රතිස්ථාපනය වේ. භාණ්ඩ තොගය, තොගය සහ වියදම්, විශේෂාංග, සහ අවධානය අවශ්‍ය කොටස් සැබෑය.",
              "The pulse, profit and Today sections below show sample numbers — they're replaced by your real figures after your first sale. Medicine stock, Stock & spending, Highlights, and Needs attention are already real.",
              "கீழே உள்ள துடிப்பு, லாபம் மற்றும் இன்று பிரிவுகள் மாதிரி எண்களைக் காட்டுகின்றன — உங்கள் முதல் விற்பனைக்குப் பிறகு உண்மையான எண்களால் மாற்றப்படும். மருந்து சரக்கு, சரக்கு & செலவு, சிறப்பம்சங்கள், மற்றும் கவனம் தேவை பிரிவுகள் ஏற்கனவே உண்மையானவை.",
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

      {/* Stat carousel. */}
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
          hint={tt(locale, "ණය ගනුදෙනුකරුවන්", "Credit customers", "கடன் வாடிக்கையாளர்கள்")}
        />
        {noTransactionsYet && (
          <StatCard
            label={tt(locale, "තොග වටිනාකම", "Stock value", "சரக்கு மதிப்பு")}
            value={formatCompactLkr(SAMPLE_PULSE.stockValue)}
            hint={tt(locale, "වර්තමාන තොගය", "Current inventory", "தற்போதைய சரக்கு")}
          />
        )}
        <StatCard
          label={tt(locale, "අඩු තොග", "Low stock", "குறைந்த சரக்கு")}
          value={String(intel.lowStockCount)}
          hint={intel.lowStockCount > 0 ? tt(locale, "නැවත ඇණවුම් කරන්න", "Needs reordering", "மறு ஆர்டர் தேவை") : tt(locale, "සියල්ල පැහැදිලිය", "All clear", "அனைத்தும் தெளிவு")}
          tone={intel.lowStockCount > 0 ? "warning" : "positive"}
        />
        <StatCard
          label={tt(locale, "කල් ඉකුත් වීමට ආසන්න", "Near expiry", "காலாவதிக்கு அருகில்")}
          value={String(intel.nearExpiryCount)}
          hint={intel.nearExpiryCount > 0 ? tt(locale, "දින 90ක් තුළ", "Within 90 days", "90 நாட்களுக்குள்") : tt(locale, "සියල්ල පැහැදිලිය", "All clear", "அனைத்தும் தெளிவு")}
          tone={intel.nearExpiryCount > 0 ? "warning" : "positive"}
        />
      </div>
      <div className="-mt-1.5 flex items-center justify-center gap-1.5" aria-hidden="true">
        {Array.from({ length: statCardCount }, (_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === activeCard ? "w-4 bg-teal-500" : "w-1.5 bg-slate-700"}`} />
        ))}
      </div>

      {/* Needs attention — real medicines going out of date (expiryQueue)
          and real low-stock products (reorderQueue), same single source
          buildRetailDashboardIntelligence already computes. */}
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

      {/* Medicine stock — real counts from buildRetailDashboardIntelligence,
          the pharmacy analog of textile's Roll inventory tile. */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-slate-100">{tt(locale, "භාණ්ඩ තොගය", "Medicine stock", "மருந்து சரக்கு")}</h2>
          <Link href="/stock" className="text-xs font-semibold text-teal-300 hover:underline">
            {tt(locale, "සියලු තොග බලන්න →", "View all stock →", "அனைத்து சரக்கையும் பார்க்க →")}
          </Link>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-800">
          <div className="p-3.5">
            <p className="text-xl font-bold text-slate-50">{intel.activeSkuCount}</p>
            <p className="text-xs text-slate-400">{tt(locale, "සක්‍රීය භාණ්ඩ", "Active products", "செயலில் உள்ள பொருட்கள்")}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xl font-bold text-slate-50">{intel.outOfStockCount}</p>
            <p className="text-xs text-slate-400">{tt(locale, "තොගයේ නැති", "Out of stock", "சரக்கு இல்லை")}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xl font-bold text-slate-50">{intel.expiredLotCount}</p>
            <p className="text-xs text-slate-400">{tt(locale, "කල් ඉකුත් වූ", "Expired lots", "காலாவதியான தொகுதிகள்")}</p>
          </div>
          <div className="p-3.5">
            <p className="text-xl font-bold text-slate-50">{intel.quarantineLotCount}</p>
            <p className="text-xs text-slate-400">{tt(locale, "රඳවා ඇති", "Quarantined lots", "தனிமைப்படுத்தப்பட்டவை")}</p>
          </div>
        </div>
      </div>

      {/* Stock & spending. */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] sm:p-6">
        <h2 className="mb-3 text-base font-bold tracking-tight text-slate-100">{tt(locale, "තොගය සහ වියදම්", "Stock & spending", "சரக்கு & செலவு")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-lg font-bold text-slate-50">{formatCompactLkr(stockValueLkr)}</p>
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
              {expensesByCategory.map(({ category, amount }) => (
                <div key={category} className="flex min-w-[7.5rem] flex-1 items-center gap-2 rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-300">{t(`expenses.cat_${category}`)}</p>
                    <p className="text-sm font-bold text-slate-50">{formatCompactLkr(amount)}</p>
                  </div>
                </div>
              ))}
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
          + {tt(locale, "නව අලෙවියක්", "New sale", "புதிய விற்பனை")}
        </Link>
        <Link
          href="/stock/advanced/receive"
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800/60"
        >
          {tt(locale, "තොගය ලබාගන්න", "Receive stock", "சரக்கு பெறவும்")}
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
        <Link href="/stock" className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-400">
          <StockIcon className="h-5 w-5" />
          {tt(locale, "තොගය", "Stock", "சரக்கு")}
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
