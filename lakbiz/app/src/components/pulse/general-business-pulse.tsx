"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { IndustryHeaderImages } from "@/components/ui/industry-imagery";
import {
  AlertTriangleIcon,
  BellIcon,
  HomeIcon,
  MoreIcon,
  SalesIcon,
  StockIcon,
  SyncIcon,
} from "@/components/ui/icons";
import { useLocale } from "@/lib/i18n/locale-provider";
import { getRevenueTrend } from "@/lib/revenue-trend";
import { getDashboardStats } from "@/lib/store/actions";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import {
  AttentionList,
  buildSummaryLine,
  formatCompactLkr,
  HighlightsCard,
  monthCashCollected,
  PulseLoadingState,
  PulseShell,
  Sparkline,
  StatCard,
  tt,
  type PulseAction,
} from "@/components/pulse/pulse-shared";

export function GeneralBusinessPulse() {
  const { data, ready } = useAppStore();
  const { locale, t } = useLocale();
  const { org } = useSubscription();
  const attentionRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<"this_month" | "last_month">("this_month");

  if (!ready || !data) {
    return (
      <PulseShell attentionCount={0} onBellClick={() => {}}>
        <PulseLoadingState label={t("common.loading")} />
      </PulseShell>
    );
  }

  const stats = getDashboardStats(data);
  const trend = getRevenueTrend(data.sales, "12m", locale, new Date());
  const selectedIndex = period === "this_month" ? trend.length - 1 : trend.length - 2;
  const selected = trend[selectedIndex];
  const prior = selectedIndex > 0 ? trend[selectedIndex - 1] : null;
  const salesChangePct =
    prior && prior.revenue > 0
      ? Math.round(((selected.revenue - prior.revenue) / prior.revenue) * 100)
      : null;
  const cashCollected = monthCashCollected(data.sales, data.customerPayments, selected.key);
  const marginPct = selected.revenue > 0 ? Math.round((selected.profit / selected.revenue) * 100) : 0;
  const activeProducts = data.products.filter((product) => product.active);
  const lowStock = activeProducts
    .filter((product) => product.stockQty <= (product.reorderLevel ?? 0))
    .sort((a, b) => a.stockQty - b.stockQty);
  const overLimitCustomers = data.customers
    .filter(
      (customer) =>
        customer.creditLimit != null && customer.creditBalance > customer.creditLimit,
    )
    .sort((a, b) => b.creditBalance - a.creditBalance);
  const pendingOrders = data.purchaseOrders.filter(
    (order) => order.status === "pending" || order.status === "partial",
  );
  const pendingCheques = data.cheques.filter((cheque) => cheque.status === "pending");
  const stockValue = activeProducts.reduce(
    (total, product) => total + product.buyPrice * product.stockQty,
    0,
  );

  const stockActions: PulseAction[] = lowStock.slice(0, 5).map((product) => ({
    key: `stock-${product.id}`,
    title: product.name,
    detail:
      product.stockQty <= 0
        ? tt(locale, "තොගයේ නැත", "Out of stock", "கையிருப்பு இல்லை")
        : tt(
            locale,
            `${product.stockQty} ඒකක ඉතිරිය`,
            `${product.stockQty} units remaining`,
            `${product.stockQty} அலகுகள் மீதம்`,
          ),
    href: "/stock",
    tone: product.stockQty <= 0 ? "danger" : "warning",
    actionLabel: tt(locale, "සමාලෝචනය", "Review", "மறுஆய்வு"),
    Icon: product.stockQty <= 0 ? AlertTriangleIcon : StockIcon,
  }));
  const creditActions: PulseAction[] = overLimitCustomers.slice(0, 3).map((customer) => ({
    key: `credit-${customer.id}`,
    title: customer.name,
    detail: tt(
      locale,
      `${formatCompactLkr(customer.creditBalance)} ලැබිය යුතුයි`,
      `${formatCompactLkr(customer.creditBalance)} receivable`,
      `${formatCompactLkr(customer.creditBalance)} பெறத்தக்கது`,
    ),
    href: "/customers",
    tone: "danger",
    actionLabel: tt(locale, "එකතු කරන්න", "Collect", "வசூலிக்க"),
    Icon: AlertTriangleIcon,
  }));
  const actions = [...creditActions, ...stockActions];

  const highlights: { key: string; title: string }[] = [];
  if (salesChangePct != null && salesChangePct > 0) {
    highlights.push({
      key: "sales",
      title: tt(
        locale,
        `අලෙවිය පසුගිය මාසයට වඩා ${salesChangePct}%කින් ඉහළ`,
        `Sales are up ${salesChangePct}% from last month`,
        `கடந்த மாதத்தை விட விற்பனை ${salesChangePct}% உயர்ந்துள்ளது`,
      ),
    });
  }
  if (activeProducts.length > 0 && lowStock.length === 0) {
    highlights.push({
      key: "stock",
      title: tt(locale, "සියලුම තොග මට්ටම් හොඳයි", "All stock levels are healthy", "அனைத்து கையிருப்பு நிலைகளும் நன்றாக உள்ளன"),
    });
  }
  if (data.customers.length > 0 && overLimitCustomers.length === 0) {
    highlights.push({
      key: "credit",
      title: tt(locale, "සියලුම පාරිභෝගිකයන් ණය සීමාව තුළයි", "Every customer is within their credit limit", "அனைத்து வாடிக்கையாளர்களும் கடன் வரம்புக்குள் உள்ளனர்"),
    });
  }

  const scrollToAttention = () =>
    attentionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <PulseShell attentionCount={actions.length} onBellClick={scrollToAttention}>
      <div className="live-industry-header live-pulse-heading">
        <IndustryHeaderImages sector={org.sector} />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">
              {tt(locale, "ව්‍යාපාර ස්පන්දනය", "Business Pulse", "வணிக துடிப்பு")}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              {tt(locale, "හිමිකරු දළ විශ්ලේෂණය", "Owner overview", "உரிமையாளர் கண்ணோட்டம்")}
            </h1>
          </div>
          <select
            aria-label={tt(locale, "කාලය", "Period", "காலம்")}
            value={period}
            onChange={(event) => setPeriod(event.target.value as typeof period)}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm"
          >
            <option value="this_month">{tt(locale, "මෙම මාසය", "This month", "இந்த மாதம்")}</option>
            <option value="last_month">{tt(locale, "පසුගිය මාසය", "Last month", "கடந்த மாதம்")}</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-slate-600">
        {buildSummaryLine(locale, salesChangePct, actions.length)}
      </p>
      {org.isAuthenticated && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <SyncIcon className="h-3.5 w-3.5" />
          {t("dash.cloud_synced")}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl bg-slate-950 p-5 text-white shadow-xl sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-300">
          {period === "this_month"
            ? tt(locale, "මෙම මාසයේ ශුද්ධ අලෙවිය", "Net sales this month", "இந்த மாத நிகர விற்பனை")
            : tt(locale, "පසුගිය මාසයේ ශුද්ධ අලෙවිය", "Net sales last month", "கடந்த மாத நிகர விற்பனை")}
        </p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-black tracking-tight">{formatCompactLkr(selected.revenue)}</p>
            <p className="mt-1 text-sm text-slate-300">
              {salesChangePct == null
                ? tt(locale, "සැසඳීමට පෙර දත්ත නැත", "No prior period to compare", "ஒப்பிட முந்தைய காலம் இல்லை")
                : `${salesChangePct >= 0 ? "+" : ""}${salesChangePct}%`}
            </p>
          </div>
          <Sparkline values={trend.slice(-8).map((point) => point.revenue)} stroke="#2dd4bf" />
        </div>
      </section>

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        <StatCard label={tt(locale, "දළ ලාභය", "Gross profit", "மொத்த லாபம்")} value={formatCompactLkr(selected.profit)} hint={`${marginPct}% ${tt(locale, "ආන්තිකය", "margin", "விளிம்பு")}`} tone="positive" />
        <StatCard label={tt(locale, "එකතු කළ මුදල්", "Cash collected", "வசூலித்த பணம்")} value={formatCompactLkr(cashCollected)} hint={tt(locale, "විකුණුම් සහ ණය එකතු කිරීම්", "Sales and credit collections", "விற்பனை மற்றும் கடன் வசூல்")} />
        <StatCard label={tt(locale, "ලැබිය යුතු", "Receivables", "பெறத்தக்கவை")} value={formatCompactLkr(stats.creditOutstanding)} hint={`${overLimitCustomers.length} ${tt(locale, "සීමාව ඉක්මවා", "over limit", "வரம்பை மீறியது")}`} tone={overLimitCustomers.length ? "danger" : "default"} />
      </div>

      <section ref={attentionRef} className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{tt(locale, "අවධානය අවශ්‍යයි", "Needs attention", "கவனம் தேவை")}</h2>
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">{actions.length}</span>
        </div>
        {actions.length > 0 ? (
          <AttentionList actions={actions} />
        ) : (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {tt(locale, "දැනට හදිසි තීරණ නැත.", "No urgent decisions right now.", "இப்போது அவசர முடிவுகள் இல்லை.")}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-bold text-slate-900">{tt(locale, "ව්‍යාපාර තත්ත්වය", "Business position", "வணிக நிலை")}</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div><p className="font-bold text-slate-950">{formatCompactLkr(stockValue)}</p><p className="text-xs text-slate-500">{tt(locale, "තොග වටිනාකම", "Stock value", "கையிருப்பு மதிப்பு")}</p></div>
          <div><p className="font-bold text-slate-950">{formatCompactLkr(stats.bankBalance)}</p><p className="text-xs text-slate-500">{tt(locale, "බැංකු ශේෂය", "Bank balance", "வங்கி இருப்பு")}</p></div>
          <div><p className="font-bold text-slate-950">{formatCompactLkr(stats.payableOutstanding)}</p><p className="text-xs text-slate-500">{tt(locale, "සැපයුම්කරුවන්ට ගෙවිය යුතු", "Supplier payables", "வழங்குநர் செலுத்த வேண்டியது")}</p></div>
          <div><p className="font-bold text-slate-950">{pendingOrders.length}</p><p className="text-xs text-slate-500">{tt(locale, "විවෘත මිලදී ගැනීම්", "Open purchase orders", "திறந்த கொள்முதல் ஆணைகள்")}</p></div>
          <div><p className="font-bold text-slate-950">{pendingCheques.length}</p><p className="text-xs text-slate-500">{tt(locale, "පොරොත්තු චෙක්පත්", "Pending cheques", "நிலுவை காசோலைகள்")}</p></div>
          <div><p className="font-bold text-slate-950">{stats.saleCount}</p><p className="text-xs text-slate-500">{tt(locale, "අද අලෙවි", "Sales today", "இன்றைய விற்பனை")}</p></div>
        </div>
      </section>

      {highlights.length > 0 && (
        <HighlightsCard title={tt(locale, "හොඳින් සිදුවන දේ", "What is going well", "நன்றாக நடப்பவை")} highlights={highlights} />
      )}

      <div className="grid grid-cols-2 gap-2 pb-2">
        <Link href="/sales" className="flex min-h-12 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-bold text-white hover:bg-teal-700">+ {tt(locale, "නව අලෙවිය", "New sale", "புதிய விற்பனை")}</Link>
        <Link href="/stock/advanced/receive" className="flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-center text-sm font-bold text-slate-700 hover:bg-slate-50">{tt(locale, "තොග ලබාගන්න", "Receive stock", "கையிருப்பு பெறுக")}</Link>
      </div>

      <nav aria-label={tt(locale, "ඉක්මන් සංචලනය", "Quick navigation", "விரைவு வழிசெலுத்தல்")} className="fixed inset-x-0 bottom-0 z-30 mx-auto grid h-[4.25rem] max-w-[650px] grid-cols-5 border-x border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
        <span aria-current="page" className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-teal-700"><HomeIcon className="h-5 w-5" />{tt(locale, "මුල් පිටුව", "Home", "முகப்பு")}</span>
        <Link href="/sales" className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-500"><SalesIcon className="h-5 w-5" />{tt(locale, "අලෙවි", "Sales", "விற்பனை")}</Link>
        <Link href="/stock" className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-500"><StockIcon className="h-5 w-5" />{tt(locale, "තොග", "Stock", "கையிருப்பு")}</Link>
        <button type="button" onClick={scrollToAttention} className="relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-500"><BellIcon className="h-5 w-5" />{tt(locale, "ඇඟවීම්", "Alerts", "எச்சரிக்கைகள்")}{actions.length > 0 && <span className="absolute right-[calc(50%-1.35rem)] top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white">{actions.length > 9 ? "9+" : actions.length}</span>}</button>
        <Link href="/dashboard" className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-slate-500"><MoreIcon className="h-5 w-5" />{tt(locale, "තව", "More", "மேலும்")}</Link>
      </nav>
    </PulseShell>
  );
}
