"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  BillsIcon,
  CalendarIcon,
  CartIcon,
  CheckIcon,
  ChevronRightIcon,
  CustomersIcon,
  PlusIcon,
  SalesIcon,
  StockIcon,
  SuppliersIcon,
} from "@/components/ui/icons";
import { formatLkr, formatLkrCompact } from "@/lib/format";
import {
  buildRetailDashboardIntelligence,
  type DashboardPeriod,
  type RetailDashboardIntelligence,
} from "@/lib/dashboard/retail-intelligence";
import type { AppData } from "@/lib/store/types";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  groceryCategoryLabel,
  groceryProductLabel,
  groceryUi,
  groceryUnitLabel,
} from "@/lib/grocery-localization";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { GroceryStarterCatalogueButton } from "@/components/grocery/starter-catalogue-button";
import { GroceryProductArt } from "@/components/sales/grocery-product-art";

const RETAIL_GRADIENTS = [
  "from-emerald-500 to-teal-400",
  "from-blue-600 to-sky-400",
  "from-violet-600 to-fuchsia-400",
  "from-amber-500 to-orange-400",
  "from-rose-500 to-pink-400",
] as const;

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_16px_42px_rgba(15,23,42,0.07)] ${className}`}>
      {children}
    </section>
  );
}

function PanelHeading({ title, action, hint }: { title: string; action?: ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold tracking-[-0.02em] text-slate-950">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  gradient,
  href,
}: {
  label: string;
  value: string;
  hint: ReactNode;
  icon: ReactNode;
  gradient: string;
  href?: string;
}) {
  const card = (
    <>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-[0_10px_20px_rgba(37,99,235,0.2)] ${gradient}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-1 truncate text-[1.45rem] font-bold tracking-[-0.05em] text-slate-950" title={value}>{value}</p>
        <div className="mt-1 min-h-4 text-[11px] font-medium text-slate-500">{hint}</div>
      </div>
    </>
  );
  const className = "group flex min-w-0 items-start gap-3 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.055)] ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.1)]";
  return href ? <Link href={href} className={className}>{card}</Link> : <div className={className}>{card}</div>;
}

function SalesChart({ intel }: { intel: RetailDashboardIntelligence }) {
  const { locale } = useLocale();
  const localizePeriodText = (value: string) => {
    const translations: Record<string, Record<"si" | "ta", string>> = {
      "Last 7 days": { si: "පසුගිය දින 7", ta: "கடந்த 7 நாட்கள்" },
      "This week": { si: "මෙම සතිය", ta: "இந்த வாரம்" },
      "This month": { si: "මෙම මාසය", ta: "இந்த மாதம்" },
      "Last month": { si: "පසුගිය මාසය", ta: "கடந்த மாதம்" },
      "Last 30 days": { si: "පසුගිය දින 30", ta: "கடந்த 30 நாட்கள்" },
      "vs prior period": { si: "පෙර කාලයට සාපේක්ෂව", ta: "முந்தைய காலத்துடன் ஒப்பிடுகையில்" },
      "vs prior 7 days": { si: "පෙර දින 7ට සාපේක්ෂව", ta: "முந்தைய 7 நாட்களுடன் ஒப்பிடுகையில்" },
      "vs last week": { si: "පසුගිය සතියට සාපේක්ෂව", ta: "கடந்த வாரத்துடன் ஒப்பிடுகையில்" },
      "vs same days last month": { si: "පසුගිය මාසයේ එම දිනවලට සාපේක්ෂව", ta: "கடந்த மாத இதே நாட்களுடன் ஒப்பிடுகையில்" },
      "vs month before": { si: "පෙර මාසයට සාපේක්ෂව", ta: "முந்தைய மாதத்துடன் ஒப்பிடுகையில்" },
      "vs prior 30 days": { si: "පෙර දින 30ට සාපේක්ෂව", ta: "முந்தைய 30 நாட்களுடன் ஒப்பிடுகையில்" },
    };
    return locale === "en" ? value : translations[value]?.[locale] ?? value;
  };
  const weekdayLabel = (dayKey: string) => new Intl.DateTimeFormat(
    locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK",
    { weekday: "short" },
  ).format(new Date(`${dayKey}T12:00:00`));
  const max = Math.max(1, ...intel.trend.map((point) => point.revenue));
  return (
    <div className="px-5 pb-5 pt-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{localizePeriodText(intel.periodLabel)}</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-3xl font-bold tracking-[-0.055em] text-slate-950">{formatLkr(intel.periodSales)}</p>
            {intel.periodChangePct != null && (
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${intel.periodChangePct >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {intel.periodChangePct >= 0 ? "▲" : "▼"} {Math.abs(intel.periodChangePct).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
        <p className="max-w-36 text-right text-[11px] leading-4 text-slate-400">{localizePeriodText(intel.periodComparisonLabel)}</p>
      </div>
      {intel.periodSales === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-blue-100 bg-gradient-to-b from-sky-50/65 to-white px-5 text-center text-sm font-medium text-slate-500">
          {locale === "si" ? "විකුණුම් සටහන් වූ පසු දෛනික ප්‍රවණතාව මෙහි පෙන්වයි." : locale === "ta" ? "விற்பனை பதிவானதும் தினசரி நிலை இங்கே தோன்றும்." : "Daily sales will appear here after the first completed bill."}
        </div>
      ) : <div className="flex h-48 items-end gap-2 rounded-2xl border border-slate-100 bg-gradient-to-b from-sky-50/65 to-white px-3 pb-6 pt-4">
        {intel.trend.map((point, index) => {
          const height = point.revenue <= 0 ? 6 : Math.max(9, (point.revenue / max) * 100);
          return (
            <div key={point.key} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
              <div className="absolute -top-7 z-10 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover:block">
                {formatLkr(point.revenue)} · {point.transactions} {locale === "si" ? "බිල්පත්" : locale === "ta" ? "பில்கள்" : "bills"}
              </div>
              <div
                className={`w-full max-w-12 rounded-t-lg bg-gradient-to-t shadow-[0_8px_16px_rgba(37,99,235,0.16)] ${RETAIL_GRADIENTS[index % RETAIL_GRADIENTS.length]}`}
                style={{ height: `${height}%` }}
              />
              <span className="absolute -bottom-5 text-[10px] font-semibold text-slate-400">{weekdayLabel(point.key)}</span>
            </div>
          );
        })}
      </div>}
    </div>
  );
}

function CategoryRing({ intel }: { intel: RetailDashboardIntelligence }) {
  const { locale } = useLocale();
  const text = (key: Parameters<typeof groceryUi>[1]) => groceryUi(locale, key);
  const visible = intel.categoryMix.slice(0, 6);
  const palette = ["#2f80ed", "#10b981", "#fbbf24", "#f97316", "#a855f7", "#ec4899"];
  let current = 0;
  const stops = visible.map((item, index) => {
    const start = current;
    current += item.share;
    return `${palette[index]} ${start}% ${Math.min(current, 100)}%`;
  }).join(", ");
  return (
    <Panel>
      <PanelHeading title={text("categorySales")} hint={locale === "si" ? "වාර්තා කළ විකුණුම්වල කොටස" : locale === "ta" ? "பதிவான விற்பனையின் பங்கு" : "Share of recorded sales"} />
      <div className="grid gap-5 p-5 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
        <div className="relative mx-auto h-36 w-36 rounded-full" style={{ background: visible.length ? `conic-gradient(${stops})` : "#e2e8f0" }}>
          <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
            {visible.length ? (
              <>
                <span className="text-xl font-bold tracking-[-0.05em] text-slate-950">{formatLkrCompact(intel.periodSales)}</span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{text("todaySales")}</span>
              </>
            ) : (
              <>
                <span className="text-xl font-bold text-slate-700">0</span>
                <span className="mt-1 px-2 text-[10px] font-semibold leading-snug text-slate-500">{text("noSalesYet")}</span>
              </>
            )}
          </div>
        </div>
        <div className="space-y-2.5">
          {visible.length === 0 ? <p className="text-sm text-slate-500">{text("salesWillAppear")}</p> : visible.map((item, index) => (
            <div key={item.category} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: palette[index] }} /> <span className="truncate">{groceryCategoryLabel(item.category, locale)}</span></span>
              <span className="shrink-0 font-bold tabular-nums text-slate-500">{item.share.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function LowStock({ intel, data }: { intel: RetailDashboardIntelligence; data: AppData }) {
  const { locale } = useLocale();
  const text = (key: Parameters<typeof groceryUi>[1]) => groceryUi(locale, key);
  const alerts = intel.reorderQueue.slice(0, 5);
  return (
    <Panel>
      <PanelHeading title={text("shelfAlerts")} action={<Link href="/stock" className="text-xs font-bold text-blue-600 hover:text-blue-700">{text("viewStock")}</Link>} />
      <div className="divide-y divide-slate-100 px-4">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 py-5 text-sm text-emerald-700"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100"><CheckIcon className="h-4.5 w-4.5" /></span> {text("shelvesReady")}</div>
        ) : alerts.map((item, index) => {
          const exhausted = item.stockQty <= 0;
          const source = data.products.find((product) => product.id === item.productId);
          const label = groceryProductLabel({ name: item.name, sku: source?.sku }, locale);
          return (
            <Link href={`/stock?q=${encodeURIComponent(item.name)}`} key={item.productId} className="group flex items-center gap-3 py-3.5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${RETAIL_GRADIENTS[index % RETAIL_GRADIENTS.length]}`}><GroceryProductArt name={item.name} category={item.category} className="h-full w-full p-1" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-blue-700">{label}</span><span className="block truncate text-[11px] text-slate-500">{groceryCategoryLabel(item.category, locale)}</span></span>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold tabular-nums ${exhausted ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{item.stockQty} {groceryUnitLabel(item.unit, locale)} {text("itemsLeft")}</span>
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}

function TopProducts({ intel, data }: { intel: RetailDashboardIntelligence; data: AppData }) {
  const { locale } = useLocale();
  const text = (key: Parameters<typeof groceryUi>[1]) => groceryUi(locale, key);
  const top = intel.topMovers.slice(0, 5);
  return (
    <Panel>
      <PanelHeading title={text("topProducts")} action={<Link href="/reports" className="text-xs font-bold text-blue-600 hover:text-blue-700">{text("viewReport")}</Link>} />
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
        {top.length === 0 ? <p className="col-span-full py-4 text-sm text-slate-500">{text("topSellersWillAppear")}</p> : top.map((item, index) => {
          const source = data.products.find((product) => product.id === item.productId);
          const label = groceryProductLabel({ name: item.name, sku: source?.sku }, locale);
          return (
          <Link href={`/stock?q=${encodeURIComponent(item.name)}`} key={item.productId} className="group rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-3 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
            <div className="relative flex h-20 items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_30%,#ffffff_0%,#eff6ff_62%,#eef2ff_100%)]">
              <GroceryProductArt name={item.name} category={item.category} className="h-full w-full p-1" />
              <span className={`absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-lg bg-gradient-to-br text-[10px] font-black text-white shadow-sm ${RETAIL_GRADIENTS[index % RETAIL_GRADIENTS.length]}`}>{index + 1}</span>
            </div>
            <p className="mt-2 truncate text-sm font-bold text-slate-800 group-hover:text-blue-700" title={label}>{label}</p>
            <p className="mt-1 text-[11px] text-slate-500">{item.qty.toLocaleString("en-LK")} {locale === "si" ? "විකුණා" : locale === "ta" ? "விற்கப்பட்டது" : "sold"}</p>
            <p className="mt-1 text-xs font-bold tabular-nums text-slate-900">{formatLkr(item.revenue)}</p>
          </Link>
          );
        })}
      </div>
    </Panel>
  );
}

function RecentTransactions({ data }: { data: AppData }) {
  const { locale } = useLocale();
  const text = (key: Parameters<typeof groceryUi>[1]) => groceryUi(locale, key);
  const recent = data.sales.slice(0, 5);
  return (
    <Panel>
      <PanelHeading title={text("recentTransactions")} hint={locale === "si" ? "සම්පූර්ණ කළ LakBiz බිල්පත්" : locale === "ta" ? "முடிக்கப்பட்ட LakBiz பில்கள்" : "Completed LakBiz bills"} action={<Link href="/bills" className="text-xs font-bold text-blue-600 hover:text-blue-700">{text("viewBills")}</Link>} />
      {recent.length === 0 ? (
        <div className="px-5 py-7">
          <p className="text-sm font-semibold text-slate-700">{locale === "si" ? "ඔබේ සම්පූර්ණ කළ බිල්පත් මෙහි පෙන්වයි." : locale === "ta" ? "உங்கள் முடிக்கப்பட்ட பில்கள் இங்கே தோன்றும்." : "Your completed bills will appear here."}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{locale === "si" ? "සැබෑ විකිණීමක් සටහන් කිරීමට සූදානම් වන විට POS / බිල්පත් වෙතින් බිල්පතක් ආරම්භ කරන්න." : locale === "ta" ? "உண்மையான விற்பனையைப் பதிவு செய்யத் தயாரானதும் POS / பில்லிங்கில் இருந்து பில்லைத் தொடங்கவும்." : "Start a bill from POS / Billing when you are ready to record a real sale."}</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 px-5">
          {recent.map((sale) => (
            <Link key={sale.id} href={`/bills/${sale.id}`} className="flex items-center gap-3 py-3 transition hover:bg-slate-50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-black text-blue-700">{sale.lines.length}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-800">{sale.customerName || (locale === "si" ? "සාමාන්‍ය ගනුදෙනුකරු" : locale === "ta" ? "நடைப்பயண வாடிக்கையாளர்" : "Walk-in customer")}</span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-500">{sale.billNo ?? sale.id.slice(0, 8)} · {new Date(sale.date).toLocaleString(locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK")}</span>
              </span>
              <span className="shrink-0 font-mono text-sm font-bold text-slate-950">{formatLkr(sale.total)}</span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

function InventorySnapshot({ intel, canSeeFinancials }: { intel: RetailDashboardIntelligence; canSeeFinancials: boolean }) {
  const { locale } = useLocale();
  const text = (key: Parameters<typeof groceryUi>[1]) => groceryUi(locale, key);
  const total = Math.max(1, intel.activeSkuCount);
  const sellable = Math.max(0, intel.activeSkuCount - intel.outOfStockCount);
  const ready = Math.round((sellable / total) * 100);
  const columns = [
    { label: text("activeItems"), value: intel.activeSkuCount, tone: "text-blue-700" },
    { label: text("readyToSell"), value: sellable, tone: "text-emerald-700" },
    { label: text("lowStock"), value: intel.lowStockCount, tone: "text-amber-700" },
    { label: text("outOfStock"), value: intel.outOfStockCount, tone: "text-rose-700" },
  ];
  return (
    <Panel>
      <PanelHeading title={text("inventoryHealth")} action={<Link href="/stock" className="text-xs font-bold text-blue-600 hover:text-blue-700">{text("viewStock")}</Link>} />
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {columns.map((item) => <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-400">{item.label}</p><p className={`mt-1.5 text-xl font-bold tracking-[-0.04em] ${item.tone}`}>{item.value.toLocaleString("en-LK")}</p></div>)}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400" style={{ width: `${ready}%` }} /></div>
          <span className="text-xs font-bold tabular-nums text-emerald-700">{ready}% {text("readyToSell")}</span>
        </div>
        <p className="mt-4 text-xs text-slate-500">{canSeeFinancials ? `${locale === "si" ? "සිල්ලර වටිනාකම" : locale === "ta" ? "சில்லறை மதிப்பு" : "Retail value"} ${formatLkr(intel.inventorySellValue)} · ${locale === "si" ? "පිරිවැය" : locale === "ta" ? "செலவு மதிப்பு" : "Cost value"} ${formatLkr(intel.inventoryCostValue ?? 0)}` : `${locale === "si" ? "සිල්ලර වටිනාකම" : locale === "ta" ? "சில்லறை மதிப்பு" : "Retail value"} ${formatLkr(intel.inventorySellValue)}`}</p>
      </div>
    </Panel>
  );
}

function CheckoutStation({ intel, shopName }: { intel: RetailDashboardIntelligence; shopName: string }) {
  const { locale } = useLocale();
  const text = (key: Parameters<typeof groceryUi>[1]) => groceryUi(locale, key);
  return (
    <Panel className="bg-gradient-to-b from-white via-sky-50/45 to-violet-50/35">
      <PanelHeading title={text("checkout")} hint={locale === "si" ? "ඔබේ මීළඟ ගනුදෙනුකරු සඳහා සූදානම්" : locale === "ta" ? "உங்கள் அடுத்த வாடிக்கையாளருக்குத் தயார்" : "Ready for your next customer"} />
      <div className="p-5">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-[radial-gradient(circle_at_100%_0%,rgba(52,211,153,0.18),transparent_36%),linear-gradient(120deg,#effcf7,#eef8ff_65%,#f7f4ff)] p-4 shadow-[0_14px_30px_rgba(15,118,110,0.08)]">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0"><span className="block truncate text-[10px] font-extrabold uppercase tracking-[0.16em] text-teal-700">{shopName}</span><span className="mt-1 block text-lg font-extrabold tracking-tight text-slate-950">{locale === "si" ? "සිල්ලර බිල්පත් කවුන්ටරය" : locale === "ta" ? "மளிகை பில் கவுன்டர்" : "Grocery checkout"}</span></span>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-[0_8px_16px_rgba(16,185,129,0.22)]"><CartIcon className="h-5 w-5" /></span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-white bg-white/80 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{locale === "si" ? "අද බිල්පත්" : locale === "ta" ? "இன்றைய பில்கள்" : "Today’s bills"}</p><p className="mt-1 text-xl font-extrabold tabular-nums text-blue-700">{intel.todayTransactions}</p></div>
            <div className="rounded-xl border border-white bg-white/80 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{text("averageBill")}</p><p className="mt-1 text-xl font-extrabold tabular-nums text-teal-700">{formatLkrCompact(intel.averageBasket)}</p></div>
          </div>
        </div>
        <Link href="/sales" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-sm font-bold text-white shadow-[0_14px_26px_rgba(79,70,229,0.23)] transition hover:brightness-110 active:scale-[0.99]"><CartIcon className="h-4.5 w-4.5" /> {locale === "si" ? "POS / බිල්පත් විවෘත කරන්න" : locale === "ta" ? "POS / பில்லிங்கைத் திற" : "Open POS / Billing"} <ChevronRightIcon className="h-4 w-4" /></Link>
        <div className="mt-3 grid grid-cols-2 gap-2"><Link href="/customers" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-slate-700 hover:border-blue-200 hover:text-blue-700">{text("customer")}</Link><Link href="/returns" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-slate-700 hover:border-blue-200 hover:text-blue-700">{text("return")}</Link></div>
      </div>
    </Panel>
  );
}

export function GroceryCommandCenter({ data }: { data: AppData }) {
  const { org, canSeeFinancials } = useSubscription();
  const { locale } = useLocale();
  const text = (key: Parameters<typeof groceryUi>[1]) => groceryUi(locale, key);
  const [period, setPeriod] = useState<DashboardPeriod>("7d");
  const [referenceDate] = useState(() => new Date());
  const intel = useMemo(() => buildRetailDashboardIntelligence(data, "grocery", canSeeFinancials, [], referenceDate, period), [data, canSeeFinancials, referenceDate, period]);
  const monthIntel = useMemo(() => buildRetailDashboardIntelligence(data, "grocery", canSeeFinancials, [], referenceDate, "this_month"), [data, canSeeFinancials, referenceDate]);
  const shopName = data.business.name || org.name || "LakBiz Grocery";
  const date = referenceDate.toLocaleDateString(locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK", { weekday: "long", day: "numeric", month: "long" });
  const shortName = shopName.length > 30 ? `${shopName.slice(0, 30)}…` : shopName;
  const lastSale = data.sales[0];

  return (
    <div className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-[24px] border border-blue-100 bg-[radial-gradient(circle_at_92%_8%,rgba(129,140,248,0.20),transparent_25%),radial-gradient(circle_at_8%_100%,rgba(16,185,129,0.13),transparent_23%),linear-gradient(115deg,#f8fbff_0%,#edf5ff_58%,#faf5ff_100%)] px-5 py-5 shadow-[0_14px_38px_rgba(59,130,246,0.09)] sm:px-6">
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">{shortName}</span><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {text("liveStoreData")}</span></div>
            <h1 className="mt-3 text-2xl font-bold tracking-[-0.045em] text-slate-950 sm:text-3xl">{locale === "si" ? `සුබ දවසක්, ${shortName}` : locale === "ta" ? `வணக்கம், ${shortName}` : `Good day, ${shortName}`}</h1>
            <p className="mt-1.5 text-sm text-slate-600">{locale === "si" ? "අද ඔබේ grocery වෙළඳසැලේ සිදුවෙමින් පවතින දේ මෙන්න." : locale === "ta" ? "இன்று உங்கள் மளிகைக் கடையில் நடப்பது இங்கே." : "Here’s what is happening in your grocery store today."}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link href="/sales" className="inline-flex h-16 min-w-24 flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 px-3 text-white shadow-[0_12px_24px_rgba(16,185,129,0.24)] transition hover:-translate-y-0.5"><PlusIcon className="h-4 w-4" /><span className="text-[11px] font-bold">{text("newBill")}</span></Link>
            <Link href="/returns" className="inline-flex h-16 min-w-24 flex-col items-center justify-center gap-1 rounded-2xl border border-rose-100 bg-rose-50 px-3 text-rose-700 shadow-sm transition hover:-translate-y-0.5"><span className="text-base">↩</span><span className="text-[11px] font-bold">{text("return")}</span></Link>
            <Link href="/stock" className="inline-flex h-16 min-w-24 flex-col items-center justify-center gap-1 rounded-2xl border border-amber-100 bg-amber-50 px-3 text-amber-800 shadow-sm transition hover:-translate-y-0.5"><StockIcon className="h-4 w-4" /><span className="text-[11px] font-bold">{locale === "si" ? "තොගය යාවත්කාලීන" : locale === "ta" ? "சரக்கைப் புதுப்பி" : "Stock update"}</span></Link>
            <Link href="/customers" className="inline-flex h-16 min-w-24 flex-col items-center justify-center gap-1 rounded-2xl border border-blue-100 bg-white px-3 text-blue-700 shadow-sm transition hover:-translate-y-0.5"><CustomersIcon className="h-4 w-4" /><span className="text-[11px] font-bold">{text("customer")}</span></Link>
            {lastSale ? <Link href={`/bills/${lastSale.id}`} className="inline-flex h-16 min-w-24 flex-col items-center justify-center gap-1 rounded-2xl border border-violet-100 bg-violet-50 px-3 text-violet-700 shadow-sm transition hover:-translate-y-0.5"><BillsIcon className="h-4 w-4" /><span className="text-[11px] font-bold">{locale === "si" ? "අවසන් බිල්පත" : locale === "ta" ? "கடைசி பில்" : "Last bill"}</span></Link> : <span title={locale === "si" ? "පළමුව සම්පූර්ණ කළ බිල්පතක් අවශ්‍යයි" : locale === "ta" ? "முதலில் முடிக்கப்பட்ட பில் தேவை" : "A completed bill is needed first"} className="inline-flex h-16 min-w-24 cursor-not-allowed flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-slate-400"><BillsIcon className="h-4 w-4" /><span className="text-[11px] font-bold">{locale === "si" ? "අවසන් බිල්පත" : locale === "ta" ? "கடைசி பில்" : "Last bill"}</span></span>}
          </div>
        </div>
        <div className="relative mt-4 grid gap-2 border-t border-blue-100/80 pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><Link href="/sales" className="flex h-11 min-w-0 items-center gap-3 rounded-xl border border-white bg-white/80 px-3 text-sm font-semibold text-slate-500 shadow-sm transition hover:border-blue-200 hover:bg-white hover:text-blue-700"><span className="shrink-0 text-lg text-blue-500">⌕</span><span className="min-w-0 flex-1 truncate">{text("searchPlaceholder")}</span><span className="shrink-0 whitespace-nowrap rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600">POS</span></Link><div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5 text-blue-500" /> {date}</span><span><strong className="text-slate-900">{intel.activeSkuCount.toLocaleString("en-LK")}</strong> {text("activeItems")}</span><span className="rounded-full bg-rose-100 px-2.5 py-1 font-bold text-rose-700">{intel.outOfStockCount} {text("outOfStock")}</span></div></div>
      </section>

      <section className={`flex flex-col gap-4 rounded-[22px] border border-emerald-100 bg-[radial-gradient(circle_at_92%_20%,rgba(45,212,191,0.22),transparent_34%),linear-gradient(120deg,#ecfdf5,#f8fbff)] p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:justify-between ${intel.activeSkuCount === 0 ? "" : "hidden"}`}>
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">{locale === "si" ? "ඔබේ grocery වෙළඳසැල සකස් කිරීමට සූදානම්" : locale === "ta" ? "உங்கள் மளிகைக் கடை அமைக்கத் தயாராக உள்ளது" : "Your grocery is ready to set up"}</span>
          <h2 className="mt-1 text-xl font-bold tracking-[-0.035em] text-slate-950">{locale === "si" ? "සංස්කරණය කළ හැකි ශ්‍රී ලංකා නාමාවලියකින් ආරම්භ කරන්න" : locale === "ta" ? "திருத்தக்கூடிய இலங்கை பட்டியலுடன் தொடங்கவும்" : "Start with an editable Sri Lankan catalogue"}</h2>
          <p className="mt-1 text-sm text-slate-600">{locale === "si" ? "Starter භාණ්ඩ එක් වරක් එක් කර, පසුව Stock හි මිල, barcode, තොග ප්‍රමාණය සහ පින්තූර වෙනස් කරන්න." : locale === "ta" ? "Starter பொருட்களை ஒருமுறை சேர்த்து, பின்னர் சரக்கில் விலை, barcode, அளவு, படத்தை மாற்றவும்." : "Add the starter products once, then change every price, barcode, stock quantity and image in Stock."}</p>
        </div>
        <GroceryStarterCatalogueButton compact />
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label={text("todaySales")} value={formatLkrCompact(intel.todaySales)} hint={intel.todaySalesChangePct == null ? `${intel.todayTransactions} ${locale === "si" ? "අද බිල්පත්" : locale === "ta" ? "இன்றைய பில்கள்" : "bills today"}` : <><span className={intel.todaySalesChangePct >= 0 ? "text-emerald-600" : "text-rose-600"}>{intel.todaySalesChangePct >= 0 ? "▲" : "▼"} {Math.abs(intel.todaySalesChangePct).toFixed(0)}%</span> {locale === "si" ? "ඊයේට වඩා" : locale === "ta" ? "நேற்றை விட" : "vs yesterday"}</>} icon={<SalesIcon className="h-5 w-5" />} gradient={RETAIL_GRADIENTS[0]} href="/sales" />
        <StatCard label={locale === "si" ? "මුළු ඇණවුම්" : locale === "ta" ? "மொத்த ஆர்டர்கள்" : "Total orders"} value={monthIntel.periodTransactions.toLocaleString("en-LK")} hint={locale === "si" ? "මෙම මාසයේ සම්පූර්ණ කළ" : locale === "ta" ? "இந்த மாதம் முடிக்கப்பட்டது" : "Completed this month"} icon={<BillsIcon className="h-5 w-5" />} gradient={RETAIL_GRADIENTS[1]} href="/sales" />
        <StatCard label={locale === "si" ? "මෙම මාසයේ ආදායම" : locale === "ta" ? "இந்த மாத வருவாய்" : "Revenue this month"} value={formatLkrCompact(monthIntel.periodSales)} hint={locale === "si" ? "සම්පූර්ණ කළ ගෙවීම් ආදායම" : locale === "ta" ? "முடிக்கப்பட்ட checkout வருவாய்" : "Completed checkout revenue"} icon={<CartIcon className="h-5 w-5" />} gradient={RETAIL_GRADIENTS[2]} href="/reports" />
        <StatCard label={locale === "si" ? "මෙම මාසයේ ලාභය" : locale === "ta" ? "இந்த மாத லாபம்" : "Profit this month"} value={canSeeFinancials ? formatLkrCompact(monthIntel.periodProfit ?? 0) : "—"} hint={canSeeFinancials ? (locale === "si" ? "සම්පූර්ණ කළ බිල්පත් වලින්" : locale === "ta" ? "முடிக்கப்பட்ட பில்களிலிருந்து" : "From completed bills") : (locale === "si" ? "හිමිකරුට පමණි" : locale === "ta" ? "உரிமையாளருக்கு மட்டும்" : "Owner-only metric")} icon={<SuppliersIcon className="h-5 w-5" />} gradient={RETAIL_GRADIENTS[3]} href="/reports" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        <Panel>
          <PanelHeading title={text("salesOverview")} hint={locale === "si" ? "සැබෑ checkout ආදායම" : locale === "ta" ? "உண்மையான checkout வருவாய்" : "Actual checkout revenue"} action={<select value={typeof period === "string" ? period : "7d"} onChange={(event) => setPeriod(event.target.value as DashboardPeriod)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-400"><option value="7d">{locale === "si" ? "පසුගිය දින 7" : locale === "ta" ? "கடந்த 7 நாட்கள்" : "Last 7 days"}</option><option value="this_week">{locale === "si" ? "මෙම සතිය" : locale === "ta" ? "இந்த வாரம்" : "This week"}</option><option value="this_month">{locale === "si" ? "මෙම මාසය" : locale === "ta" ? "இந்த மாதம்" : "This month"}</option><option value="30d">{locale === "si" ? "පසුගිය දින 30" : locale === "ta" ? "கடந்த 30 நாட்கள்" : "Last 30 days"}</option></select>} />
          <SalesChart intel={intel} />
        </Panel>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1"><CategoryRing intel={intel} /><LowStock intel={intel} data={data} /></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5"><TopProducts intel={intel} data={data} /><InventorySnapshot intel={intel} canSeeFinancials={canSeeFinancials} /></div>
        <div className="space-y-5"><RecentTransactions data={data} /><CheckoutStation intel={intel} shopName={shopName} /></div>
      </div>
    </div>
  );
}
