"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { buildRetailDashboardIntelligence, type RetailLotSnapshot } from "@/lib/dashboard/retail-intelligence";
import { fetchRetailDashboardLots } from "@/lib/supabase/retail-dashboard-client";

/**
 * Persistent, header-level alert count — badge for the Sidebar/MobileNav
 * bell icon so expired lots, blocked batches and critical low-stock items
 * surface from anywhere, not just by scrolling to the dashboard's own
 * "Needs attention" card.
 *
 * Deliberately reuses buildRetailDashboardIntelligence rather than
 * re-deriving expiry/low-stock logic a third time (see the Section 1 near-
 * expiry-threshold bug this whole audit started from) — same numbers the
 * pharmacy/grocery command centre already shows, just also badged here.
 *
 * Scope: pharmacy gets the full count (expired + blocked + low stock),
 * grocery gets low + out of stock (no batch concept), and every other
 * sector gets a low-stock-only count computed from the same product data
 * — a reasonable proxy, not that sector's own audited "needs attention"
 * logic (SectorCommandCenter's per-sector actions), which lives behind
 * its own async snapshot fetch this hook doesn't duplicate. Good enough
 * to badge "something needs a look"; the sector's own dashboard is still
 * the place to see what.
 */
export function useCriticalAlertCount(): number {
  const { data, ready } = useAppStore();
  const { org } = useSubscription();
  const [lots, setLots] = useState<RetailLotSnapshot[]>([]);

  useEffect(() => {
    if (org.sector !== "pharmacy" || !org.isAuthenticated || !org.id) {
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
  }, [org.sector, org.isAuthenticated, org.id]);

  if (!ready || !data) return 0;

  if (org.sector === "pharmacy") {
    const intel = buildRetailDashboardIntelligence(data, "pharmacy", false, lots);
    return intel.expiredLotCount + intel.quarantineLotCount + intel.lowStockCount;
  }

  if (org.sector === "grocery") {
    const intel = buildRetailDashboardIntelligence(data, "grocery", false, []);
    return intel.lowStockCount + intel.outOfStockCount;
  }

  const intel = buildRetailDashboardIntelligence(data, "grocery", false, []);
  return intel.lowStockCount;
}
