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
  ReportsIcon,
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

const PERIODS: { value: Exclude<DashboardPeriod, { custom: unknown }>; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "30d", label: "Last 30 days" },
];

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
  const max = Math.max(1, ...intel.trend.map((point) => point.revenue));
  return (
    <div className="px-5 pb-5 pt-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{intel.periodLabel}</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-3xl font-bold tracking-[-0.055em] text-slate-950">{formatLkr(intel.periodSales)}</p>
            {intel.periodChangePct != null && (
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${intel.periodChangePct >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {intel.periodChangePct >= 0 ? "▲" : "▼"} {Math.abs(intel.periodChangePct).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
        <p className="max-w-36 text-right text-[11px] leading-4 text-slate-400">{intel.periodComparisonLabel}</p>
      </div>
      <div className="flex h-48 items-end gap-2 rounded-2xl border border-slate-100 bg-gradient-to-b from-sky-50/65 to-white px-3 pb-6 pt-4">
        {intel.trend.map((point, index) => {
          const height = point.revenue <= 0 ? 6 : Math.max(9, (point.revenue / max) * 100);
          return (
            <div key={point.key} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
              <div className="absolute -top-7 z-10 hidden whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover:block">
                {formatLkr(point.revenue)} · {point.transactions} bills
              </div>
              <div
                className={`w-full max-w-12 rounded-t-lg bg-gradient-to-t shadow-[0_8px_16px_rgba(37,99,235,0.16)] ${RETAIL_GRADIENTS[index % RETAIL_GRADIENTS.length]}`}
                style={{ height: `${height}%` }}
              />
              <span className="absolute -bottom-5 text-[10px] font-semibold text-slate-400">{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryRing({ intel }: { intel: RetailDashboardIntelligence }) {
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
      <PanelHeading title="Category sales" hint="Share of recorded sales" />
      <div className="grid gap-5 p-5 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
        <div className="relative mx-auto h-36 w-36 rounded-full" style={{ background: visible.length ? `conic-gradient(${stops})` : "#e2e8f0" }}>
          <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
            <span className="text-xl font-bold tracking-[-0.05em] text-slate-950">{formatLkrCompact(intel.periodSales)}</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Sales</span>
          </div>
        </div>
        <div className="space-y-2.5">
          {visible.length === 0 ? <p className="text-sm text-slate-500">Sales will appear here after checkout.</p> : visible.map((item, index) => (
            <div key={item.category} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-700"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: palette[index] }} /> <span className="truncate">{item.category}</span></span>
              <span className="shrink-0 font-bold tabular-nums text-slate-500">{item.share.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function LowStock({ intel }: { intel: RetailDashboardIntelligence }) {
  const alerts = intel.reorderQueue.slice(0, 5);
  return (
    <Panel>
      <PanelHeading title="Shelf alerts" action={<Link href="/stock" className="text-xs font-bold text-blue-600 hover:text-blue-700">View stock</Link>} />
      <div className="divide-y divide-slate-100 px-4">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 py-5 text-sm text-emerald-700"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100"><CheckIcon className="h-4.5 w-4.5" /></span> Shelves are ready to sell.</div>
        ) : alerts.map((item, index) => {
          const exhausted = item.stockQty <= 0;
          return (
            <Link href={`/stock?q=${encodeURIComponent(item.name)}`} key={item.productId} className="group flex items-center gap-3 py-3.5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${RETAIL_GRADIENTS[index % RETAIL_GRADIENTS.length]}`}><GroceryProductArt name={item.name} category={item.category} className="h-full w-full p-1" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-blue-700">{item.name}</span><span className="block truncate text-[11px] text-slate-500">{item.category}</span></span>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold tabular-nums ${exhausted ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{item.stockQty} {item.unit} left</span>
            </Link>
          );
        })}
      </div>
    </Panel>
  );
}

function TopProducts({ intel }: { intel: RetailDashboardIntelligence }) {
  const top = intel.topMovers.slice(0, 5);
  return (
    <Panel>
      <PanelHeading title="Top selling products" action={<Link href="/reports" className="text-xs font-bold text-blue-600 hover:text-blue-700">View report</Link>} />
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
        {top.length === 0 ? <p className="col-span-full py-4 text-sm text-slate-500">Top sellers will appear after recorded sales.</p> : top.map((item, index) => (
          <Link href={`/stock?q=${encodeURIComponent(item.name)}`} key={item.productId} className="group rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-3 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
            <div className="relative flex h-20 items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_30%,#ffffff_0%,#eff6ff_62%,#eef2ff_100%)]">
              <GroceryProductArt name={item.name} category={item.category} className="h-full w-full p-1" />
              <span className={`absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-lg bg-gradient-to-br text-[10px] font-black text-white shadow-sm ${RETAIL_GRADIENTS[index % RETAIL_GRADIENTS.length]}`}>{index + 1}</span>
            </div>
            <p className="mt-2 truncate text-sm font-bold text-slate-800 group-hover:text-blue-700" title={item.name}>{item.name}</p>
            <p className="mt-1 text-[11px] text-slate-500">{item.qty.toLocaleString("en-LK")} sold</p>
            <p className="mt-1 text-xs font-bold tabular-nums text-slate-900">{formatLkr(item.revenue)}</p>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function InventorySnapshot({ intel, canSeeFinancials }: { intel: RetailDashboardIntelligence; canSeeFinancials: boolean }) {
  const total = Math.max(1, intel.activeSkuCount);
  const sellable = Math.max(0, intel.activeSkuCount - intel.outOfStockCount);
  const ready = Math.round((sellable / total) * 100);
  const columns = [
    { label: "Active items", value: intel.activeSkuCount, tone: "text-blue-700" },
    { label: "Ready to sell", value: sellable, tone: "text-emerald-700" },
    { label: "Low stock", value: intel.lowStockCount, tone: "text-amber-700" },
    { label: "Out of stock", value: intel.outOfStockCount, tone: "text-rose-700" },
  ];
  return (
    <Panel>
      <PanelHeading title="Inventory status" action={<Link href="/stock" className="text-xs font-bold text-blue-600 hover:text-blue-700">Manage stock</Link>} />
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {columns.map((item) => <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-400">{item.label}</p><p className={`mt-1.5 text-xl font-bold tracking-[-0.04em] ${item.tone}`}>{item.value.toLocaleString("en-LK")}</p></div>)}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400" style={{ width: `${ready}%` }} /></div>
          <span className="text-xs font-bold tabular-nums text-emerald-700">{ready}% ready</span>
        </div>
        <p className="mt-4 text-xs text-slate-500">{canSeeFinancials ? `Retail value ${formatLkr(intel.inventorySellValue)} · Cost value ${formatLkr(intel.inventoryCostValue ?? 0)}` : `Retail value ${formatLkr(intel.inventorySellValue)}`}</p>
      </div>
    </Panel>
  );
}

function CheckoutStation({ intel, shopName }: { intel: RetailDashboardIntelligence; shopName: string }) {
  return (
    <Panel className="bg-gradient-to-b from-white via-sky-50/45 to-violet-50/35">
      <PanelHeading title="Checkout station" hint="Ready for your next customer" />
      <div className="p-5">
        <div className="rounded-2xl bg-[#0a1730] p-4 text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)]">
          <div className="flex items-start justify-between gap-3"><span><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300">{shopName}</span><span className="mt-1 block text-lg font-bold">Quick POS</span></span><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-teal-300"><CartIcon className="h-5 w-5" /></span></div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm"><div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Today&apos;s bills</p><p className="mt-1 text-xl font-bold">{intel.todayTransactions}</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Average bill</p><p className="mt-1 text-xl font-bold">{formatLkrCompact(intel.averageBasket)}</p></div></div>
        </div>
        <Link href="/sales" className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-sm font-bold text-white shadow-[0_14px_26px_rgba(79,70,229,0.23)] transition hover:brightness-110 active:scale-[0.99]"><CartIcon className="h-4.5 w-4.5" /> Open POS / Billing <ChevronRightIcon className="h-4 w-4" /></Link>
        <div className="mt-3 grid grid-cols-2 gap-2"><Link href="/customers" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-slate-700 hover:border-blue-200 hover:text-blue-700">Customer</Link><Link href="/returns" className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-xs font-bold text-slate-700 hover:border-blue-200 hover:text-blue-700">Return</Link></div>
      </div>
    </Panel>
  );
}

export function GroceryCommandCenter({ data }: { data: AppData }) {
  const { org, canSeeFinancials } = useSubscription();
  const { locale } = useLocale();
  const [period, setPeriod] = useState<DashboardPeriod>("7d");
  const [referenceDate] = useState(() => new Date());
  const intel = useMemo(() => buildRetailDashboardIntelligence(data, "grocery", canSeeFinancials, [], referenceDate, period), [data, canSeeFinancials, referenceDate, period]);
  const shopName = data.business.name || org.name || "LakBiz Grocery";
  const date = referenceDate.toLocaleDateString(locale === "si" ? "si-LK" : "en-LK", { weekday: "long", day: "numeric", month: "long" });
  const shortName = shopName.length > 30 ? `${shopName.slice(0, 30)}…` : shopName;

  return (
    <div className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-[26px] border border-blue-100 bg-[radial-gradient(circle_at_88%_12%,rgba(129,140,248,0.25),transparent_27%),radial-gradient(circle_at_6%_100%,rgba(16,185,129,0.16),transparent_25%),linear-gradient(115deg,#f8fbff_0%,#edf5ff_52%,#f7f1ff_100%)] px-5 py-6 shadow-[0_18px_48px_rgba(59,130,246,0.11)] sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-8 top-3 h-28 w-28 rounded-full bg-gradient-to-br from-violet-300/40 to-fuchsia-200/20 blur-2xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">Grocery command centre</span><span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live store data</span></div>
            <h1 className="mt-4 text-2xl font-bold tracking-[-0.045em] text-slate-950 sm:text-3xl">Good day, {shortName}</h1>
            <p className="mt-1.5 text-sm text-slate-600">A colorful, live view of sales, stock and checkout readiness for your Sri Lankan grocery store.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link href="/sales" className="inline-flex h-14 min-w-28 flex-col items-center justify-center gap-0.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 px-3 text-white shadow-[0_12px_24px_rgba(16,185,129,0.24)] transition hover:-translate-y-0.5"><PlusIcon className="h-4 w-4" /><span className="text-[11px] font-bold">New bill</span></Link>
            <Link href="/stock" className="inline-flex h-14 min-w-28 flex-col items-center justify-center gap-0.5 rounded-2xl border border-amber-100 bg-amber-50 px-3 text-amber-800 shadow-sm transition hover:-translate-y-0.5"><StockIcon className="h-4 w-4" /><span className="text-[11px] font-bold">Stock update</span></Link>
            <Link href="/customers" className="inline-flex h-14 min-w-28 flex-col items-center justify-center gap-0.5 rounded-2xl border border-blue-100 bg-white px-3 text-blue-700 shadow-sm transition hover:-translate-y-0.5"><CustomersIcon className="h-4 w-4" /><span className="text-[11px] font-bold">Customer</span></Link>
            <Link href="/reports" className="inline-flex h-14 min-w-28 flex-col items-center justify-center gap-0.5 rounded-2xl border border-violet-100 bg-violet-50 px-3 text-violet-700 shadow-sm transition hover:-translate-y-0.5"><ReportsIcon className="h-4 w-4" /><span className="text-[11px] font-bold">Reports</span></Link>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-blue-100/80 pt-4 text-xs font-medium text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarIcon className="h-3.5 w-3.5 text-blue-500" /> {date}</span><span><strong className="text-slate-900">{intel.activeSkuCount.toLocaleString("en-LK")}</strong> active items</span><span className="rounded-full bg-rose-100 px-2.5 py-1 font-bold text-rose-700">{intel.outOfStockCount} out of stock</span></div>
      </section>

      <section className={`flex flex-col gap-4 rounded-[22px] border border-emerald-100 bg-[radial-gradient(circle_at_92%_20%,rgba(45,212,191,0.22),transparent_34%),linear-gradient(120deg,#ecfdf5,#f8fbff)] p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:justify-between ${intel.activeSkuCount === 0 ? "" : "hidden"}`}>
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Your grocery is ready to set up</span>
          <h2 className="mt-1 text-xl font-bold tracking-[-0.035em] text-slate-950">Start with an editable Sri Lankan catalogue</h2>
          <p className="mt-1 text-sm text-slate-600">Add the starter products once, then change every price, barcode, stock quantity and image in Stock.</p>
        </div>
        <GroceryStarterCatalogueButton compact />
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Today&apos;s sales" value={formatLkrCompact(intel.todaySales)} hint={intel.todaySalesChangePct == null ? `${intel.todayTransactions} bills today` : <><span className={intel.todaySalesChangePct >= 0 ? "text-emerald-600" : "text-rose-600"}>{intel.todaySalesChangePct >= 0 ? "▲" : "▼"} {Math.abs(intel.todaySalesChangePct).toFixed(0)}%</span> vs yesterday</>} icon={<SalesIcon className="h-5 w-5" />} gradient={RETAIL_GRADIENTS[0]} href="/sales" />
        <StatCard label="Bills generated" value={intel.todayTransactions.toLocaleString("en-LK")} hint={`${intel.periodTransactions} in selected period`} icon={<BillsIcon className="h-5 w-5" />} gradient={RETAIL_GRADIENTS[1]} href="/sales" />
        <StatCard label="Average bill" value={formatLkrCompact(intel.averageBasket)} hint="Based on recorded checkout" icon={<CartIcon className="h-5 w-5" />} gradient={RETAIL_GRADIENTS[2]} href="/sales" />
        <StatCard label="Items ready to sell" value={Math.max(0, intel.activeSkuCount - intel.outOfStockCount).toLocaleString("en-LK")} hint={`${intel.lowStockCount} need shelf attention`} icon={<StockIcon className="h-5 w-5" />} gradient={RETAIL_GRADIENTS[3]} href="/stock" />
        <StatCard label="Retail stock value" value={formatLkrCompact(intel.inventorySellValue)} hint="At current sell prices" icon={<SuppliersIcon className="h-5 w-5" />} gradient={RETAIL_GRADIENTS[4]} href="/stock" />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
        <Panel>
          <PanelHeading title="Sales overview" hint="Actual checkout revenue" action={<select value={typeof period === "string" ? period : "7d"} onChange={(event) => setPeriod(event.target.value as DashboardPeriod)} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-400">{PERIODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>} />
          <SalesChart intel={intel} />
        </Panel>
        <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-1"><CategoryRing intel={intel} /><LowStock intel={intel} /></div>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5"><TopProducts intel={intel} /><InventorySnapshot intel={intel} canSeeFinancials={canSeeFinancials} /></div>
        <CheckoutStation intel={intel} shopName={shopName} />
      </div>
    </div>
  );
}
