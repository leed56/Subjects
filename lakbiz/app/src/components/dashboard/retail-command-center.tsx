"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { OfflineSyncNotice } from "@/components/offline-sync-notice";
import {
  AlertTriangleIcon,
  BillsIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  PlusIcon,
  SalesIcon,
  StockIcon,
  SuppliersIcon,
} from "@/components/ui/icons";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { AppData } from "@/lib/store/types";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import {
  buildRetailDashboardIntelligence,
  type RetailDashboardIntelligence,
  type RetailLotSnapshot,
  type RetailSector,
} from "@/lib/dashboard/retail-intelligence";
import { fetchRetailDashboardLots } from "@/lib/supabase/retail-dashboard-client";

const copy = {
  en: {
    pharmacyEyebrow: "Operations workspace",
    groceryEyebrow: "Operations workspace",
    pharmacySubtitle: "Batch-aware inventory, FEFO attention and daily retail performance in one operating view.",
    grocerySubtitle: "Sales velocity, replenishment and category performance for a fast-moving supermarket floor.",
    live: "Live workspace",
    newSale: "New sale",
    addStock: "Manage stock",
    batchControl: "Batch control",
    suppliers: "Suppliers",
    todaySales: "Today's sales",
    transactions: "Transactions",
    averageBasket: "Average basket",
    activeSkus: "Active SKUs",
    lowStock: "Low stock",
    outOfStock: "Out of stock",
    nearExpiry: "Near expiry",
    stockValue: "Stock cost value",
    sellValue: "Retail stock value",
    thirtyDaySales: "30-day sales",
    thirtyDayProfit: "30-day gross profit",
    margin: "Gross margin",
    performance: "Sales performance",
    performanceHint: "Actual recorded revenue over the last seven days",
    attention: "Needs attention",
    attentionClear: "No urgent inventory issues are currently detected.",
    pharmacyControl: "Batch & expiry control",
    pharmacyControlHint: "Operational signals from tracked lots. No medicine advice or inferred indication.",
    availableLots: "Available lots",
    fefoProducts: "FEFO multi-lot items",
    expired: "Expired lots",
    quarantine: "Quarantine / recall",
    expiryQueue: "Expiry queue",
    days: "days",
    medicineMix: "Pharmacy assortment",
    medicines: "Medicines",
    nonMedicines: "Health, wellness & convenience",
    topMovers: "Top movers",
    topMoversHint: "Ranked from recorded sold quantity",
    categoryMix: "Category performance",
    categoryMixHint: "Share of recorded sales; inventory mix is used when sales are empty",
    replenish: "Replenishment queue",
    replenishHint: "Items at or below their configured reorder level",
    slowMovers: "Slow-moving stock",
    slowMoversHint: "In-stock items with the lowest recorded sold quantity",
    recent: "Recent activity",
    recentHint: "Latest sales and stock movements",
    financial: "Owner financial snapshot",
    financialHint: "Internal values visible only to the organization owner",
    viewAll: "View all",
    recorded: "recorded",
    unitsSold: "units sold",
    inStock: "in stock",
    noSales: "No recorded sales yet",
    noRows: "Nothing to show yet",
    lotUnavailable: "Batch intelligence is temporarily unavailable; core inventory remains available.",
    operationalHealth: "Inventory readiness",
  },
  si: {
    pharmacyEyebrow: "මෙහෙයුම් වැඩබිම",
    groceryEyebrow: "මෙහෙයුම් වැඩබිම",
    pharmacySubtitle: "බැච්, FEFO, කල් ඉකුත් අවදානම් සහ දෛනික විකුණුම් එකම දසුනකින් පාලනය කරන්න.",
    grocerySubtitle: "වේගවත් විකුණුම්, නැවත ඇණවුම් සහ කාණ්ඩ කාර්යසාධනය එකම දසුනකින් බලන්න.",
    live: "සජීවී වැඩබිම",
    newSale: "නව විකුණුම",
    addStock: "තොග කළමනාකරණය",
    batchControl: "බැච් පාලනය",
    suppliers: "සැපයුම්කරුවන්",
    todaySales: "අද විකුණුම්",
    transactions: "ගනුදෙනු",
    averageBasket: "සාමාන්‍ය බිල්පත",
    activeSkus: "සක්‍රීය SKU",
    lowStock: "අඩු තොග",
    outOfStock: "තොග අවසන්",
    nearExpiry: "කල් ඉකුත් වීමට ළඟ",
    stockValue: "තොග පිරිවැය",
    sellValue: "සිල්ලර තොග වටිනාකම",
    thirtyDaySales: "දින 30 විකුණුම්",
    thirtyDayProfit: "දින 30 දළ ලාභය",
    margin: "දළ ලාභ ප්‍රතිශතය",
    performance: "විකුණුම් කාර්යසාධනය",
    performanceHint: "පසුගිය දින හතේ සටහන් වූ සැබෑ විකුණුම්",
    attention: "අවධානය අවශ්‍යයි",
    attentionClear: "හදිසි තොග ගැටලු නොපෙනේ.",
    pharmacyControl: "බැච් සහ කල් ඉකුත් පාලනය",
    pharmacyControlHint: "සටහන් වූ ලොට් දත්ත පමණි. වෛද්‍ය උපදෙස් හෝ අනුමාන නොමැත.",
    availableLots: "ලබාගත හැකි ලොට්",
    fefoProducts: "FEFO බහු-ලොට් භාණ්ඩ",
    expired: "කල් ඉකුත් ලොට්",
    quarantine: "Quarantine / recall",
    expiryQueue: "කල් ඉකුත් පේළිය",
    days: "දින",
    medicineMix: "ඖෂධ අලෙවිසැල් පරාසය",
    medicines: "ඖෂධ",
    nonMedicines: "සෞඛ්‍ය, wellness සහ convenience",
    topMovers: "වේගවත් භාණ්ඩ",
    topMoversHint: "සටහන් වූ විකුණුම් ප්‍රමාණය අනුව",
    categoryMix: "කාණ්ඩ කාර්යසාධනය",
    categoryMixHint: "සටහන් වූ විකුණුම් කොටස",
    replenish: "නැවත ඇණවුම් පේළිය",
    replenishHint: "නැවත ඇණවුම් සීමාවට ළඟ භාණ්ඩ",
    slowMovers: "මන්දගාමී තොග",
    slowMoversHint: "අඩුම සටහන් වූ විකුණුම් සහිත තොග",
    recent: "මෑත ක්‍රියාකාරකම්",
    recentHint: "අලුත්ම විකුණුම් සහ තොග චලනය",
    financial: "හිමිකරුගේ මූල්‍ය සාරාංශය",
    financialHint: "සංවිධාන හිමිකරුට පමණක් පෙනෙන අභ්‍යන්තර අගයන්",
    viewAll: "සියල්ල බලන්න",
    recorded: "සටහන්",
    unitsSold: "ඒකක විකිණී ඇත",
    inStock: "තොගයේ",
    noSales: "තවම විකුණුම් සටහන් නැත",
    noRows: "තවම දත්ත නැත",
    lotUnavailable: "බැච් තොරතුරු තාවකාලිකව ලබාගත නොහැක. මූලික තොග දත්ත ක්‍රියාත්මකයි.",
    operationalHealth: "තොග සූදානම",
  },
} as const;

type KpiTone = "default" | "teal" | "warning" | "danger" | "navy";

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.055)] ${className}`}>
      {children}
    </section>
  );
}

function KpiCard({ label, value, hint, tone = "default", icon }: { label: string; value: string; hint?: string; tone?: KpiTone; icon: ReactNode }) {
  const tones: Record<KpiTone, string> = {
    default: "border-slate-200 bg-white text-slate-950",
    teal: "border-teal-200/80 bg-teal-50/75 text-slate-950",
    warning: "border-amber-200/90 bg-amber-50/65 text-slate-950",
    danger: "border-rose-200/90 bg-rose-50/60 text-slate-950",
    navy: "border-slate-800 bg-[#101d30] text-white",
  };
  const iconTone = tone === "navy" ? "bg-white/10 text-teal-300" : tone === "warning" ? "bg-amber-100 text-amber-700" : tone === "danger" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600";
  return (
    <div className={`min-w-0 rounded-2xl border p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-[11px] font-bold uppercase tracking-[0.13em] ${tone === "navy" ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>{icon}</span>
      </div>
      <p className="mt-4 truncate text-[1.65rem] font-semibold tracking-[-0.045em] tabular-nums">{value}</p>
      {hint && <p className={`mt-1 text-xs ${tone === "navy" ? "text-slate-400" : "text-slate-500"}`}>{hint}</p>}
    </div>
  );
}

function SectionTitle({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-slate-950">{title}</h2>
        {hint && <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

function SalesTrend({ intel, canSeeFinancials, label }: { intel: RetailDashboardIntelligence; canSeeFinancials: boolean; label: string }) {
  const max = Math.max(1, ...intel.trend.map((point) => point.revenue));
  return (
    <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-[-0.045em] text-slate-950">{formatLkr(intel.periodSales)}</p>
        </div>
        <div className="flex gap-5 text-right">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Transactions</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-slate-800">{intel.periodTransactions}</p>
          </div>
          {canSeeFinancials && intel.grossMarginPct != null && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Margin</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-teal-700">{intel.grossMarginPct.toFixed(1)}%</p>
            </div>
          )}
        </div>
      </div>
      <div className="flex h-44 items-end gap-2 sm:gap-3" role="img" aria-label="Seven-day sales chart">
        {intel.trend.map((point) => {
          const height = point.revenue > 0 ? Math.max(8, (point.revenue / max) * 100) : 3;
          return (
            <div key={point.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <div className="group relative flex h-32 w-full items-end justify-center rounded-xl bg-slate-50 px-1 ring-1 ring-inset ring-slate-100">
                <div
                  className="w-full max-w-10 rounded-lg bg-teal-500/90 shadow-[0_6px_18px_rgba(13,148,136,0.18)] transition-[height]"
                  style={{ height: `${height}%` }}
                  title={`${point.label}: ${formatLkr(point.revenue)}`}
                />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttentionPanel({ sector, intel, text }: { sector: RetailSector; intel: RetailDashboardIntelligence; text: (typeof copy)["en"] | (typeof copy)["si"] }) {
  const rows = sector === "pharmacy"
    ? [
        { key: "expired", count: intel.expiredLotCount, title: text.expired, href: "/stock/advanced", tone: "rose" },
        { key: "quarantine", count: intel.quarantineLotCount, title: text.quarantine, href: "/stock/advanced/returns", tone: "rose" },
        { key: "expiry", count: intel.nearExpiryCount, title: text.nearExpiry, href: "/stock/advanced", tone: "amber" },
        { key: "low", count: intel.lowStockCount, title: text.lowStock, href: "/stock", tone: "amber" },
        { key: "out", count: intel.outOfStockCount, title: text.outOfStock, href: "/stock", tone: "slate" },
      ]
    : [
        { key: "low", count: intel.lowStockCount, title: text.lowStock, href: "/stock", tone: "amber" },
        { key: "out", count: intel.outOfStockCount, title: text.outOfStock, href: "/stock", tone: "rose" },
        { key: "reorder", count: intel.reorderQueue.length, title: text.replenish, href: "/stock", tone: "teal" },
      ];
  const visible = rows.filter((row) => row.count > 0);
  return (
    <Surface className="overflow-hidden">
      <SectionTitle title={text.attention} />
      <div className="space-y-2 p-4 sm:p-5">
        {visible.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><CheckIcon className="h-4.5 w-4.5" /></span>
            <p className="pt-1 text-sm leading-6 text-emerald-900">{text.attentionClear}</p>
          </div>
        ) : visible.map((row) => {
          const dot = row.tone === "rose" ? "bg-rose-500" : row.tone === "amber" ? "bg-amber-500" : row.tone === "teal" ? "bg-teal-500" : "bg-slate-400";
          return (
            <Link key={row.key} href={row.href} className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 transition hover:border-slate-300 hover:bg-slate-50/70">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{row.title}</span>
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold tabular-nums text-slate-700">{row.count}</span>
              <ChevronRightIcon className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
            </Link>
          );
        })}
      </div>
    </Surface>
  );
}

function CategoryMix({ intel, text }: { intel: RetailDashboardIntelligence; text: (typeof copy)["en"] | (typeof copy)["si"] }) {
  const max = Math.max(1, ...intel.categoryMix.map((item) => item.share));
  return (
    <Surface className="overflow-hidden">
      <SectionTitle title={text.categoryMix} hint={text.categoryMixHint} />
      <div className="space-y-4 p-5 sm:p-6">
        {intel.categoryMix.length === 0 ? <p className="text-sm text-slate-500">{text.noRows}</p> : intel.categoryMix.map((item) => (
          <div key={item.category}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-semibold text-slate-700">{item.category}</span>
              <span className="tabular-nums text-slate-500">{item.share.toFixed(0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-slate-700" style={{ width: `${Math.max(4, (item.share / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function Movers({ intel, text }: { intel: RetailDashboardIntelligence; text: (typeof copy)["en"] | (typeof copy)["si"] }) {
  const maxQty = Math.max(1, ...intel.topMovers.map((item) => item.qty));
  return (
    <Surface className="overflow-hidden">
      <SectionTitle title={text.topMovers} hint={text.topMoversHint} action={<Link href="/reports" className="text-xs font-semibold text-teal-700 hover:text-teal-800">{text.viewAll}</Link>} />
      <div className="divide-y divide-slate-100 px-5 sm:px-6">
        {intel.topMovers.length === 0 ? <p className="py-6 text-sm text-slate-500">{text.noSales}</p> : intel.topMovers.slice(0, 6).map((item, index) => (
          <div key={item.productId} className="flex items-center gap-3 py-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-500">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                <p className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">{item.qty} {text.unitsSold}</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.max(5, (item.qty / maxQty) * 100)}%` }} />
              </div>
              <p className="mt-1.5 truncate text-[11px] text-slate-400">{item.category} · {item.stockQty} {text.inStock}</p>
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function ReorderQueue({ intel, text }: { intel: RetailDashboardIntelligence; text: (typeof copy)["en"] | (typeof copy)["si"] }) {
  return (
    <Surface className="overflow-hidden">
      <SectionTitle title={text.replenish} hint={text.replenishHint} action={<Link href="/stock" className="text-xs font-semibold text-teal-700 hover:text-teal-800">{text.viewAll}</Link>} />
      <div className="divide-y divide-slate-100 px-5 sm:px-6">
        {intel.reorderQueue.length === 0 ? <p className="py-6 text-sm text-slate-500">{text.noRows}</p> : intel.reorderQueue.slice(0, 6).map((item) => (
          <Link href={`/stock?product=${encodeURIComponent(item.productId)}`} key={item.productId} className="group flex items-center justify-between gap-4 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-teal-700">{item.name}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">{item.category}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-sm font-bold tabular-nums ${item.stockQty <= 0 ? "text-rose-600" : "text-amber-700"}`}>{item.stockQty} {item.unit}</p>
              <p className="text-[10px] text-slate-400">min {item.reorderLevel}</p>
            </div>
          </Link>
        ))}
      </div>
    </Surface>
  );
}

function ExpiryControl({ intel, text, lotError }: { intel: RetailDashboardIntelligence; text: (typeof copy)["en"] | (typeof copy)["si"]; lotError: string | null }) {
  const metrics = [
    { label: text.availableLots, value: intel.availableLotCount, tone: "text-emerald-700 bg-emerald-50" },
    { label: text.fefoProducts, value: intel.fefoProductCount, tone: "text-teal-700 bg-teal-50" },
    { label: text.expired, value: intel.expiredLotCount, tone: "text-rose-700 bg-rose-50" },
    { label: text.quarantine, value: intel.quarantineLotCount, tone: "text-amber-800 bg-amber-50" },
  ];
  return (
    <Surface className="overflow-hidden">
      <SectionTitle title={text.pharmacyControl} hint={text.pharmacyControlHint} action={<Link href="/stock/advanced" className="text-xs font-semibold text-teal-700 hover:text-teal-800">{text.batchControl}</Link>} />
      <div className="p-5 sm:p-6">
        {lotError && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">{text.lotUnavailable}</p>}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className={`rounded-xl px-3 py-3 ${metric.tone}`}>
              <p className="text-2xl font-semibold tracking-[-0.04em] tabular-nums">{metric.value}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.09em] opacity-70">{metric.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{text.expiryQueue}</p>
            <span className="text-xs font-semibold text-slate-500">{intel.nearExpiryCount} {text.nearExpiry.toLowerCase()}</span>
          </div>
          {intel.expiryQueue.length === 0 ? (
            <div className="flex items-center gap-2 py-3 text-sm text-slate-500"><CheckIcon className="h-4 w-4 text-emerald-600" /> {text.noRows}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {intel.expiryQueue.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{item.productName}</p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">Batch {item.batchNo} · {item.expiryDate}</p>
                  </div>
                  <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${item.daysToExpiry <= 30 ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{item.daysToExpiry} {text.days}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}

function Assortment({ intel, text }: { intel: RetailDashboardIntelligence; text: (typeof copy)["en"] | (typeof copy)["si"] }) {
  const total = Math.max(1, intel.medicineCount + intel.nonMedicineCount);
  const medicineShare = (intel.medicineCount / total) * 100;
  return (
    <Surface className="overflow-hidden">
      <SectionTitle title={text.medicineMix} />
      <div className="p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-semibold tracking-[-0.045em] text-slate-950">{intel.medicineCount}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{text.medicines}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold tracking-[-0.045em] text-slate-950">{intel.nonMedicineCount}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{text.nonMedicines}</p>
          </div>
        </div>
        <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-teal-600" style={{ width: `${medicineShare}%` }} />
          <div className="h-full flex-1 bg-sky-300" />
        </div>
        <div className="mt-3 flex justify-between text-[11px] font-medium text-slate-500">
          <span>{medicineShare.toFixed(0)}% {text.medicines}</span>
          <span>{(100 - medicineShare).toFixed(0)}% retail</span>
        </div>
      </div>
    </Surface>
  );
}

function SlowMovers({ intel, text }: { intel: RetailDashboardIntelligence; text: (typeof copy)["en"] | (typeof copy)["si"] }) {
  return (
    <Surface className="overflow-hidden">
      <SectionTitle title={text.slowMovers} hint={text.slowMoversHint} />
      <div className="divide-y divide-slate-100 px-5 sm:px-6">
        {intel.slowMovers.length === 0 ? <p className="py-6 text-sm text-slate-500">{text.noRows}</p> : intel.slowMovers.slice(0, 5).map((item) => (
          <div key={item.productId} className="flex items-center justify-between gap-4 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">{item.category}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums text-slate-700">{item.qty} {text.unitsSold}</p>
              <p className="text-[10px] text-slate-400">{item.stockQty} {text.inStock}</p>
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function RecentActivity({ intel, text }: { intel: RetailDashboardIntelligence; text: (typeof copy)["en"] | (typeof copy)["si"] }) {
  const iconFor = (type: "sale" | "stock" | "purchase") => type === "sale" ? <SalesIcon className="h-4 w-4" /> : type === "purchase" ? <SuppliersIcon className="h-4 w-4" /> : <StockIcon className="h-4 w-4" />;
  return (
    <Surface className="overflow-hidden">
      <SectionTitle title={text.recent} hint={text.recentHint} />
      <div className="divide-y divide-slate-100 px-5 sm:px-6">
        {intel.recentActivity.length === 0 ? <p className="py-6 text-sm text-slate-500">{text.noRows}</p> : intel.recentActivity.map((item) => (
          <div key={item.id} className="flex items-center gap-3 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">{iconFor(item.type)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">{item.subtitle} · {new Date(item.date).toLocaleDateString("en-LK", { day: "numeric", month: "short" })}</p>
            </div>
            {item.amount != null && <p className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">{formatLkr(item.amount)}</p>}
          </div>
        ))}
      </div>
    </Surface>
  );
}

function FinancialStrip({ intel, text }: { intel: RetailDashboardIntelligence; text: (typeof copy)["en"] | (typeof copy)["si"] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#101d30] p-5 text-white shadow-[0_16px_40px_rgba(15,23,42,0.15)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-teal-300">{text.financial}</p>
          <p className="mt-1 text-xs text-slate-400">{text.financialHint}</p>
        </div>
        <Link href="/reports" className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.08]">{text.viewAll}</Link>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{text.stockValue}</p>
          <p className="mt-1.5 text-xl font-semibold tracking-[-0.03em] tabular-nums">{formatLkr(intel.inventoryCostValue ?? 0)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{text.thirtyDayProfit}</p>
          <p className="mt-1.5 text-xl font-semibold tracking-[-0.03em] tabular-nums text-teal-300">{formatLkr(intel.periodProfit ?? 0)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{text.margin}</p>
          <p className="mt-1.5 text-xl font-semibold tracking-[-0.03em] tabular-nums">{intel.grossMarginPct == null ? "—" : `${intel.grossMarginPct.toFixed(1)}%`}</p>
        </div>
      </div>
    </div>
  );
}

export function RetailCommandCenter({ data, sector }: { data: AppData; sector: RetailSector }) {
  const { locale } = useLocale();
  const { org, canSeeFinancials, isReadOnly } = useSubscription();
  const text = copy[locale];
  const [referenceDate] = useState(() => new Date());
  const [lots, setLots] = useState<RetailLotSnapshot[]>([]);
  const [lotError, setLotError] = useState<string | null>(null);

  useEffect(() => {
    if (sector !== "pharmacy" || !org.isAuthenticated || !org.id) {
      setLots([]);
      setLotError(null);
      return;
    }
    let cancelled = false;
    void fetchRetailDashboardLots(org.id).then((result) => {
      if (cancelled) return;
      setLots(result.data);
      setLotError(result.error);
    });
    return () => { cancelled = true; };
  }, [sector, org.isAuthenticated, org.id]);

  const intel = useMemo(
    () => buildRetailDashboardIntelligence(data, sector, canSeeFinancials, lots, referenceDate),
    [data, sector, canSeeFinancials, lots, referenceDate],
  );
  const shopName = data.business.name || org.name || "LakBiz";
  const readiness = intel.activeSkuCount > 0 ? Math.max(0, Math.round(((intel.activeSkuCount - intel.lowStockCount) / intel.activeSkuCount) * 100)) : 100;
  const isPharmacy = sector === "pharmacy";
  const date = referenceDate.toLocaleDateString(locale === "si" ? "si-LK" : "en-LK", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-5 pb-8">
      <div className="relative overflow-hidden rounded-[22px] border border-slate-800 bg-[#0b1728] px-5 py-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-teal-400/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-80 rounded-full bg-sky-400/[0.04] blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1fr_auto] xl:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-full border border-teal-300/15 bg-teal-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300">{isPharmacy ? text.pharmacyEyebrow : text.groceryEyebrow}</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{text.live}</span>
              {isReadOnly && <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300">Read only</span>}
            </div>
            <h1 className="mt-4 truncate text-3xl font-semibold tracking-[-0.045em] sm:text-[2.15rem]">{shopName}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{isPharmacy ? text.pharmacySubtitle : text.grocerySubtitle}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5"><CalendarIcon className="h-4 w-4" />{date}</span>
              <span>{intel.activeSkuCount.toLocaleString()} {text.activeSkus}</span>
              {isPharmacy && <span>{intel.medicineCount.toLocaleString()} {text.medicines}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
            <Link href="/sales" className="inline-flex h-11 items-center gap-2 rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(20,184,166,0.22)] transition hover:bg-teal-400"><PlusIcon className="h-4 w-4" />{text.newSale}</Link>
            <Link href="/stock" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-slate-100 transition hover:bg-white/[0.09]"><StockIcon className="h-4 w-4 text-teal-300" />{text.addStock}</Link>
            <Link href={isPharmacy ? "/stock/advanced" : "/suppliers"} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.055] hover:text-white">{isPharmacy ? <BillsIcon className="h-4 w-4" /> : <SuppliersIcon className="h-4 w-4" />}{isPharmacy ? text.batchControl : text.suppliers}</Link>
          </div>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><CheckIcon className="h-5 w-5" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{text.operationalHealth}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">{readiness}%</p>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${readiness}%` }} /></div>
        </div>
      </div>

      <OfflineSyncNotice />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label={text.todaySales} value={formatLkr(intel.todaySales)} hint={`${intel.todayTransactions} ${text.transactions.toLowerCase()}`} tone="navy" icon={<SalesIcon className="h-4 w-4" />} />
        <KpiCard label={text.activeSkus} value={intel.activeSkuCount.toLocaleString()} hint={isPharmacy ? `${intel.medicineCount} ${text.medicines.toLowerCase()}` : text.recorded} tone="default" icon={<StockIcon className="h-4 w-4" />} />
        <KpiCard label={text.lowStock} value={String(intel.lowStockCount)} hint={`${intel.outOfStockCount} ${text.outOfStock.toLowerCase()}`} tone={intel.lowStockCount > 0 ? "warning" : "default"} icon={<AlertTriangleIcon className="h-4 w-4" />} />
        {isPharmacy ? (
          <KpiCard label={text.nearExpiry} value={String(intel.nearExpiryCount)} hint={`${intel.expiredLotCount} ${text.expired.toLowerCase()}`} tone={intel.expiredLotCount > 0 ? "danger" : intel.nearExpiryCount > 0 ? "warning" : "default"} icon={<CalendarIcon className="h-4 w-4" />} />
        ) : (
          <KpiCard label={text.averageBasket} value={formatLkr(intel.averageBasket)} hint={`${intel.periodTransactions} ${text.transactions.toLowerCase()} / 30d`} tone="teal" icon={<BillsIcon className="h-4 w-4" />} />
        )}
        {canSeeFinancials ? (
          <KpiCard label={text.stockValue} value={formatLkr(intel.inventoryCostValue ?? 0)} hint={text.financialHint} tone="teal" icon={<StockIcon className="h-4 w-4" />} />
        ) : (
          <KpiCard label={text.sellValue} value={formatLkr(intel.inventorySellValue)} hint={`${intel.outOfStockCount} ${text.outOfStock.toLowerCase()}`} tone="teal" icon={<SalesIcon className="h-4 w-4" />} />
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
        <Surface className="overflow-hidden">
          <SectionTitle title={text.performance} hint={text.performanceHint} action={<Link href="/reports" className="text-xs font-semibold text-teal-700 hover:text-teal-800">{text.viewAll}</Link>} />
          <SalesTrend intel={intel} canSeeFinancials={canSeeFinancials} label={text.thirtyDaySales} />
        </Surface>
        <AttentionPanel sector={sector} intel={intel} text={text} />
      </div>

      {isPharmacy ? (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.7fr)]">
            <ExpiryControl intel={intel} text={text} lotError={lotError} />
            <Assortment intel={intel} text={text} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Movers intel={intel} text={text} />
            <ReorderQueue intel={intel} text={text} />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <Movers intel={intel} text={text} />
            <CategoryMix intel={intel} text={text} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <ReorderQueue intel={intel} text={text} />
            <SlowMovers intel={intel} text={text} />
          </div>
        </>
      )}

      {canSeeFinancials && <FinancialStrip intel={intel} text={text} />}
      <RecentActivity intel={intel} text={text} />
    </div>
  );
}
