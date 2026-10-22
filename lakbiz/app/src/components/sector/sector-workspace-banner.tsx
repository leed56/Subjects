"use client";

import Link from "next/link";
import { SectorIcon } from "@/components/sector-icon";
import { AlertTriangleIcon, CheckIcon, StockIcon } from "@/components/ui/icons";
import { useLocale } from "@/lib/i18n/locale-provider";
import { canAccessShopRoute } from "@/lib/org-role/permissions";
import type { OrgRole } from "@/lib/subscription/types";
import type { SectorId } from "@/lib/types";

type SectorWorkspaceSurface = "dashboard" | "sales";

type CategoryCount = {
  name: string;
  count: number;
};

type WorkspaceAction = {
  href: string;
  labelEn: string;
  labelSi: string;
  emphasis?: boolean;
};

const PHARMACY_ACTIONS: WorkspaceAction[] = [
  { href: "/sales", labelEn: "New pharmacy sale", labelSi: "නව ෆාමසි විකිණීම", emphasis: true },
  { href: "/stock/advanced", labelEn: "Batch & expiry", labelSi: "Batch හා expiry" },
  { href: "/stock/advanced/receive", labelEn: "Receive stock", labelSi: "තොග භාරගන්න" },
  { href: "/stock/advanced/returns", labelEn: "Return inspection", labelSi: "Return පරීක්ෂාව" },
];

const GROCERY_ACTIONS: WorkspaceAction[] = [
  { href: "/sales", labelEn: "Fast checkout", labelSi: "ඉක්මන් checkout", emphasis: true },
  { href: "/stock", labelEn: "Replenishment", labelSi: "තොග නැවත පුරවන්න" },
  { href: "/suppliers", labelEn: "Suppliers", labelSi: "සැපයුම්කරුවන්" },
  { href: "/customers", labelEn: "Customers", labelSi: "ගනුදෙනුකරුවන්" },
];

function copyFor(sector: SectorId, surface: SectorWorkspaceSurface, si: boolean) {
  if (sector === "pharmacy") {
    return si
      ? {
          eyebrow: "PHARMACY COMMAND",
          title: surface === "sales" ? "ෆාමසි කවුන්ටරය" : "ෆාමසි මෙහෙයුම් මධ්‍යස්ථානය",
          description:
            "ඖෂධ, wellness සහ convenience retail සඳහා batch-aware workflow. FEFO, expiry සහ quarantine controls checkout එකෙන් ඉවත් නොවේ.",
          signals: ["FEFO lot allocation", "Expiry-aware receiving", "Quarantine-safe returns"],
        }
      : {
          eyebrow: "PHARMACY COMMAND",
          title: surface === "sales" ? "Pharmacy counter" : "Dispensary & retail control",
          description:
            "Batch-aware medicine, wellness and convenience operations. FEFO, expiry and quarantine controls stay in the workflow instead of becoming back-office afterthoughts.",
          signals: ["FEFO lot allocation", "Expiry-aware receiving", "Quarantine-safe returns"],
        };
  }

  return si
    ? {
        eyebrow: "GROCERY COMMAND",
        title: surface === "sales" ? "ඉක්මන් supermarket checkout" : "Supermarket මෙහෙයුම් මධ්‍යස්ථානය",
        description:
          "වේගයෙන් ගමන් කරන retail catalogue එක සඳහා checkout, category navigation සහ replenishment එකම operational flow එකක.",
        signals: ["Rapid SKU search", "Reorder visibility", "Category-led checkout"],
      }
    : {
        eyebrow: "GROCERY COMMAND",
        title: surface === "sales" ? "Fast supermarket checkout" : "Supermarket command centre",
        description:
          "Fast-moving retail operations with rapid checkout, category-led navigation and replenishment visibility designed for a busy Sri Lankan counter.",
        signals: ["Rapid SKU search", "Reorder visibility", "Category-led checkout"],
      };
}

export function SectorWorkspaceBanner({
  sector,
  role,
  surface,
  shopName,
  catalogueCount,
  lowStockCount = 0,
  outOfStockCount = 0,
  categories = [],
  selectedCategory = "all",
  onCategoryChange,
}: {
  sector: SectorId;
  role: OrgRole;
  surface: SectorWorkspaceSurface;
  shopName: string;
  catalogueCount: number;
  lowStockCount?: number;
  outOfStockCount?: number;
  categories?: CategoryCount[];
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
}) {
  const { locale } = useLocale();
  if (sector !== "pharmacy" && sector !== "grocery") return null;

  const si = locale === "si";
  const copy = copyFor(sector, surface, si);
  const actions = (sector === "pharmacy" ? PHARMACY_ACTIONS : GROCERY_ACTIONS).filter((action) =>
    canAccessShopRoute(role, action.href),
  );
  const health = catalogueCount > 0
    ? Math.max(0, Math.round(((catalogueCount - Math.min(catalogueCount, lowStockCount)) / catalogueCount) * 100))
    : 100;
  const categoryCount = categories.length;

  return (
    <section className="mb-5 overflow-hidden rounded-[24px] border border-slate-800 bg-[#091625] text-white shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-teal-400/[0.08] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-sky-400/[0.045] blur-3xl" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.055] text-teal-300">
                <SectorIcon sectorId={sector} className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">{copy.eyebrow}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">{shopName}</p>
              </div>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] sm:text-[1.8rem]">{copy.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{copy.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {copy.signals.map((signal) => (
                <span key={signal} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300">
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-300" />
                  {signal}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:max-w-[28rem] xl:justify-end">
            {actions
              .filter((action) => !(surface === "sales" && action.href === "/sales"))
              .map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`inline-flex h-10 items-center rounded-xl px-3.5 text-xs font-bold transition ${
                    action.emphasis
                      ? "bg-teal-500 text-white shadow-[0_10px_24px_rgba(20,184,166,0.22)] hover:bg-teal-400"
                      : "border border-white/[0.1] bg-white/[0.045] text-slate-200 hover:bg-white/[0.09] hover:text-white"
                  }`}
                >
                  {si ? action.labelSi : action.labelEn}
                </Link>
              ))}
          </div>
        </div>

        <div className="relative mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/[0.075] bg-white/[0.04] px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{surface === "sales" ? "Available now" : "Active catalogue"}</p>
              <StockIcon className="h-4 w-4 text-slate-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] tabular-nums">{catalogueCount.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-slate-500">{categoryCount > 0 ? `${categoryCount} active categories` : "Operational items"}</p>
          </div>

          <div className={`rounded-2xl border px-4 py-3.5 ${lowStockCount > 0 ? "border-amber-300/15 bg-amber-400/[0.065]" : "border-white/[0.075] bg-white/[0.04]"}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Low stock</p>
              <AlertTriangleIcon className={`h-4 w-4 ${lowStockCount > 0 ? "text-amber-300" : "text-slate-500"}`} />
            </div>
            <p className={`mt-2 text-2xl font-semibold tracking-[-0.04em] tabular-nums ${lowStockCount > 0 ? "text-amber-200" : ""}`}>{lowStockCount}</p>
            <p className="mt-0.5 text-xs text-slate-500">{outOfStockCount} out of stock</p>
          </div>

          <div className="rounded-2xl border border-white/[0.075] bg-white/[0.04] px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Stock readiness</p>
              <CheckIcon className="h-4 w-4 text-emerald-300" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] tabular-nums text-emerald-300">{health}%</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${health}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-teal-300/10 bg-teal-400/[0.055] px-4 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Operating mode</p>
            <p className="mt-2 text-sm font-bold text-teal-200">{sector === "pharmacy" ? "Batch-aware retail" : "High-velocity retail"}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{sector === "pharmacy" ? "Identity controls stay attached to stock." : "Search, sell and replenish with fewer clicks."}</p>
          </div>
        </div>
      </div>

      {surface === "sales" && categories.length > 0 && onCategoryChange && (
        <div className="border-t border-white/[0.07] bg-black/[0.08] px-4 py-3 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => onCategoryChange("all")}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition ${selectedCategory === "all" ? "bg-teal-500 text-white" : "border border-white/[0.08] bg-white/[0.035] text-slate-400 hover:bg-white/[0.07] hover:text-white"}`}
            >
              All <span className="ml-1 opacity-70">{catalogueCount}</span>
            </button>
            {categories.map((category) => (
              <button
                key={category.name}
                type="button"
                onClick={() => onCategoryChange(category.name)}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition ${selectedCategory === category.name ? "bg-teal-500 text-white" : "border border-white/[0.08] bg-white/[0.035] text-slate-400 hover:bg-white/[0.07] hover:text-white"}`}
              >
                {category.name} <span className="ml-1 opacity-70">{category.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
