"use client";

import { usePathname } from "next/navigation";
import { SectorWorkspaceBanner } from "@/components/sector/sector-workspace-banner";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export function SectorWorkspaceAutoBanner() {
  const pathname = usePathname();
  const { data, ready } = useAppStore();
  const { org } = useSubscription();

  // Dashboard already has its own richer retail command centre. Injecting the
  // generic sector banner there creates two competing hero surfaces. Keep this
  // contextual banner only on Sales/POS, where it provides useful fast actions
  // and catalogue context without duplicating the page's primary hierarchy.
  if (pathname !== "/sales" || !ready || !data) return null;
  if (org.sector !== "pharmacy" && org.sector !== "grocery") return null;

  const activeProducts = data.products.filter((product) => product.active);
  const catalogueCount = activeProducts.filter((product) => product.stockQty > 0).length;
  const lowStockCount = activeProducts.filter(
    (product) => product.reorderLevel != null && product.stockQty <= product.reorderLevel,
  ).length;
  const outOfStockCount = activeProducts.filter((product) => product.stockQty <= 0).length;
  const categories = [...new Set(activeProducts.map((product) => product.category || "Other"))]
    .map((name) => ({
      name,
      count: activeProducts.filter((product) => (product.category || "Other") === name).length,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 14);

  return (
    <div className="mx-auto -mb-5 w-full max-w-[1440px] px-4 pt-6 sm:-mb-6 sm:px-6 sm:pt-7 lg:-mb-7 lg:px-10 lg:pt-8">
      <SectorWorkspaceBanner
        sector={org.sector}
        role={org.role}
        surface="sales"
        shopName={data.business.name || org.name || "LakBiz"}
        catalogueCount={catalogueCount}
        lowStockCount={lowStockCount}
        outOfStockCount={outOfStockCount}
        categories={categories}
      />
    </div>
  );
}
