"use client";

import type { ReactNode } from "react";
import { AlertTriangleIcon, CheckIcon, StockIcon } from "@/components/ui/icons";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { groceryCategoryLabel, groceryUi } from "@/lib/grocery-localization";
import type { SectorId } from "@/lib/types";

export function StockCommandHeader({
  sector,
  shopName,
  itemCount,
  lowStockCount,
  outOfStockCount,
  costValue,
  sellValue,
  canSeeFinancials,
  filteredCount,
  categories,
  selectedCategory,
  onCategoryChange,
  actions,
}: {
  sector: SectorId;
  shopName: string;
  itemCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  costValue: number;
  sellValue: number;
  canSeeFinancials: boolean;
  filteredCount: number;
  categories: Array<{ name: string; count: number }>;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  actions: ReactNode;
}) {
  const { locale } = useLocale();
  const grocery = sector === "grocery";
  const text = (key: Parameters<typeof groceryUi>[1], fallback: string) => grocery ? groceryUi(locale, key) : fallback;
  const health = itemCount > 0 ? Math.max(0, Math.round(((itemCount - lowStockCount) / itemCount) * 100)) : 100;
  const sectorCopy = grocery
    ? (locale === "si" ? "වේගයෙන් අලෙවි වන සිල්ලර තොගය, කාණ්ඩ අනුව නැවත පිරවීම සහ පැහැදිලි තොග දෘශ්‍යතාව සමඟ." : locale === "ta" ? "விரைவாக விற்பனையாகும் மளிகை சரக்கை வகைப்படி நிரப்பவும் அதன் நிலையைத் தெளிவாகப் பார்க்கவும்." : "Fast-moving grocery inventory with category-led replenishment and stock visibility.")
    : sector === "pharmacy"
    ? "Medicine, wellness and convenience inventory with batch, expiry and FEFO control."
    : "Operational inventory catalogue and stock control.";

  return (
    <div className={`mb-5 overflow-hidden rounded-[22px] shadow-[0_18px_44px_rgba(15,23,42,0.08)] ${grocery ? "border border-emerald-100 bg-[radial-gradient(circle_at_93%_7%,rgba(52,211,153,0.22),transparent_31%),linear-gradient(120deg,#f2fbf8,#f3f8ff_57%,#f8f5ff)] text-slate-950" : "border border-slate-800 bg-[#0b1728] text-white"}`}>
      <div className="relative px-5 py-6 sm:px-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-teal-400/[0.07] blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${grocery ? "border border-emerald-100 bg-white text-teal-600" : "border border-white/10 bg-white/[0.055] text-teal-300"}`}><StockIcon className="h-4.5 w-4.5" /></span>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${grocery ? "text-teal-700" : "text-teal-300"}`}>{grocery ? (locale === "si" ? "තොග මෙහෙයුම්" : locale === "ta" ? "சரக்கு செயல்பாடுகள்" : "Inventory operations") : "Inventory operations"}</p>
                <p className={`mt-0.5 text-xs ${grocery ? "text-slate-600" : "text-slate-500"}`}>{shopName}</p>
              </div>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em]">{text("stock", "Stock control")}</h1>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${grocery ? "text-slate-600" : "text-slate-400"}`}>{sectorCopy}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className={`rounded-2xl border p-4 ${grocery ? "border-white bg-white/80 shadow-sm" : "border-white/[0.08] bg-white/[0.045]"}`}>
            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{grocery ? (locale === "si" ? "සක්‍රිය නාමාවලිය" : locale === "ta" ? "செயலில் உள்ள பட்டியல்" : "Active catalogue") : "Active catalogue"}</p><StockIcon className="h-4 w-4 text-slate-500" /></div>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] tabular-nums">{itemCount.toLocaleString()}</p>
            <p className="mt-1 text-xs text-slate-500">{filteredCount === itemCount ? (grocery ? (locale === "si" ? "සම්පූර්ණ තොගය" : locale === "ta" ? "முழு சரக்கு" : "Complete inventory") : "Complete inventory") : `${filteredCount.toLocaleString()} ${grocery ? (locale === "si" ? "වත්මන් දර්ශනයේ" : locale === "ta" ? "தற்போதைய காட்சியில்" : "in current view") : "in current view"}`}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${grocery ? lowStockCount > 0 ? "border-amber-200 bg-amber-50" : "border-white bg-white/80 shadow-sm" : lowStockCount > 0 ? "border-amber-300/15 bg-amber-400/[0.07]" : "border-white/[0.08] bg-white/[0.045]"}`}>
            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{text("lowStock", "Low stock")}</p><AlertTriangleIcon className={`h-4 w-4 ${lowStockCount > 0 ? "text-amber-300" : "text-slate-500"}`} /></div>
            <p className={`mt-3 text-2xl font-semibold tracking-[-0.04em] tabular-nums ${lowStockCount > 0 ? grocery ? "text-amber-700" : "text-amber-200" : ""}`}>{lowStockCount}</p>
            <p className="mt-1 text-xs text-slate-500">{outOfStockCount} {text("outOfStock", "out of stock")}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${grocery ? "border-white bg-white/80 shadow-sm" : "border-white/[0.08] bg-white/[0.045]"}`}>
            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{grocery ? (locale === "si" ? "තොග සූදානම" : locale === "ta" ? "சரக்கு தயார்நிலை" : "Inventory readiness") : "Inventory readiness"}</p><CheckIcon className="h-4 w-4 text-emerald-300" /></div>
            <p className={`mt-3 text-2xl font-semibold tracking-[-0.04em] tabular-nums ${grocery ? "text-emerald-700" : "text-emerald-300"}`}>{health}%</p>
            <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${grocery ? "bg-slate-100" : "bg-white/[0.08]"}`}><div className="h-full rounded-full bg-emerald-400" style={{ width: `${health}%` }} /></div>
          </div>
          {canSeeFinancials && (
            <div className={`rounded-2xl border p-4 ${grocery ? "border-emerald-100 bg-emerald-50/80" : "border-teal-300/10 bg-teal-400/[0.055]"}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{grocery ? (locale === "si" ? "පිරිවැය · හිමිකරු" : locale === "ta" ? "செலவு மதிப்பு · உரிமையாளர்" : "Cost value · owner") : "Cost value · owner"}</p>
              <p className={`mt-3 truncate text-xl font-semibold tracking-[-0.035em] tabular-nums ${grocery ? "text-teal-800" : "text-teal-200"}`}>{formatLkr(costValue)}</p>
              <p className="mt-1 text-xs text-slate-500">{grocery ? (locale === "si" ? "අභ්‍යන්තර මිලදී ගැනීමේ පදනම" : locale === "ta" ? "உள் கொள்முதல் செலவு அடிப்படை" : "Internal buy-cost basis") : "Internal buy-cost basis"}</p>
            </div>
          )}
          <div className={`rounded-2xl border p-4 ${grocery ? "border-white bg-white/80 shadow-sm" : "border-white/[0.08] bg-white/[0.045]"}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{grocery ? (locale === "si" ? "සිල්ලර තොග වටිනාකම" : locale === "ta" ? "சில்லறை சரக்கு மதிப்பு" : "Retail stock value") : "Retail stock value"}</p>
            <p className="mt-3 truncate text-xl font-semibold tracking-[-0.035em] tabular-nums">{formatLkr(sellValue)}</p>
            <p className="mt-1 text-xs text-slate-500">{grocery ? (locale === "si" ? "වත්මන් විකුණුම් මිලට" : locale === "ta" ? "தற்போதைய விற்பனை விலையில்" : "At current sell prices") : "At current sell prices"}</p>
          </div>
        </div>
      </div>

      {categories.length > 0 && (
        <div className={`border-t px-4 py-3 sm:px-6 ${grocery ? "border-emerald-100 bg-white/55" : "border-white/[0.07] bg-black/[0.08]"}`}>
          <div aria-label={grocery ? groceryCategoryLabel("Product categories", locale) : "Product categories"} className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={selectedCategory === "all"}
              onClick={() => onCategoryChange("all")}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-xl px-3 py-2 text-left text-xs font-semibold leading-snug transition ${selectedCategory === "all" ? grocery ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm" : "bg-teal-500 text-white" : grocery ? "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700" : "border border-white/[0.08] bg-white/[0.035] text-slate-400 hover:bg-white/[0.07] hover:text-white"}`}
            >
              <span>{grocery ? groceryCategoryLabel("All Products", locale) : "All"}</span>
              <span className="shrink-0 opacity-70">{itemCount}</span>
            </button>
            {categories.map((category) => (
              <button
                key={category.name}
                type="button"
                aria-pressed={selectedCategory === category.name}
                onClick={() => onCategoryChange(category.name)}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-xl px-3 py-2 text-left text-xs font-semibold leading-snug transition ${selectedCategory === category.name ? grocery ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-sm" : "bg-teal-500 text-white" : grocery ? "border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-700" : "border border-white/[0.08] bg-white/[0.035] text-slate-400 hover:bg-white/[0.07] hover:text-white"}`}
              >
                <span className="min-w-0">{grocery ? groceryCategoryLabel(category.name, locale) : category.name}</span>
                <span className="shrink-0 opacity-70">{category.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
