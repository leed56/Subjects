"use client";

import type { ReactNode } from "react";
import { AlertTriangleIcon, CheckIcon, StockIcon } from "@/components/ui/icons";
import { formatLkr } from "@/lib/format";
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
  const health = itemCount > 0 ? Math.max(0, Math.round(((itemCount - lowStockCount) / itemCount) * 100)) : 100;
  const sectorCopy = sector === "pharmacy"
    ? "Medicine, wellness and convenience inventory with batch, expiry and FEFO control."
    : sector === "grocery"
      ? "Fast-moving supermarket inventory with category-led replenishment and stock visibility."
      : "Operational inventory catalogue and stock control.";

  return (
    <div className="mb-5 overflow-hidden rounded-[22px] border border-slate-800 bg-[#0b1728] text-white shadow-[0_22px_55px_rgba(15,23,42,0.16)]">
      <div className="relative px-5 py-6 sm:px-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-teal-400/[0.07] blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.055] text-teal-300"><StockIcon className="h-4.5 w-4.5" /></span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300">Inventory operations</p>
                <p className="mt-0.5 text-xs text-slate-500">{shopName}</p>
              </div>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em]">Stock control</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{sectorCopy}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4">
            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Active catalogue</p><StockIcon className="h-4 w-4 text-slate-500" /></div>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] tabular-nums">{itemCount.toLocaleString()}</p>
            <p className="mt-1 text-xs text-slate-500">{filteredCount === itemCount ? "Complete inventory" : `${filteredCount.toLocaleString()} in current view`}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${lowStockCount > 0 ? "border-amber-300/15 bg-amber-400/[0.07]" : "border-white/[0.08] bg-white/[0.045]"}`}>
            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Low stock</p><AlertTriangleIcon className={`h-4 w-4 ${lowStockCount > 0 ? "text-amber-300" : "text-slate-500"}`} /></div>
            <p className={`mt-3 text-2xl font-semibold tracking-[-0.04em] tabular-nums ${lowStockCount > 0 ? "text-amber-200" : ""}`}>{lowStockCount}</p>
            <p className="mt-1 text-xs text-slate-500">{outOfStockCount} out of stock</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4">
            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Inventory readiness</p><CheckIcon className="h-4 w-4 text-emerald-300" /></div>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] tabular-nums text-emerald-300">{health}%</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${health}%` }} /></div>
          </div>
          {canSeeFinancials && (
            <div className="rounded-2xl border border-teal-300/10 bg-teal-400/[0.055] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Cost value · owner</p>
              <p className="mt-3 truncate text-xl font-semibold tracking-[-0.035em] tabular-nums text-teal-200">{formatLkr(costValue)}</p>
              <p className="mt-1 text-xs text-slate-500">Internal buy-cost basis</p>
            </div>
          )}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Retail stock value</p>
            <p className="mt-3 truncate text-xl font-semibold tracking-[-0.035em] tabular-nums">{formatLkr(sellValue)}</p>
            <p className="mt-1 text-xs text-slate-500">At current sell prices</p>
          </div>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="border-t border-white/[0.07] bg-black/[0.08] px-4 py-3 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button type="button" onClick={() => onCategoryChange("all")} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition ${selectedCategory === "all" ? "bg-teal-500 text-white" : "border border-white/[0.08] bg-white/[0.035] text-slate-400 hover:bg-white/[0.07] hover:text-white"}`}>All <span className="ml-1 opacity-70">{itemCount}</span></button>
            {categories.map((category) => (
              <button key={category.name} type="button" onClick={() => onCategoryChange(category.name)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition ${selectedCategory === category.name ? "bg-teal-500 text-white" : "border border-white/[0.08] bg-white/[0.035] text-slate-400 hover:bg-white/[0.07] hover:text-white"}`}>
                {category.name} <span className="ml-1 opacity-70">{category.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
