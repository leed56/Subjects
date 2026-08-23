"use client";

import { AtomicRetailSalesPage } from "@/components/sales/atomic-retail-sales-page";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { isAtomicRetailSector } from "@/lib/atomic-retail-pos";
import LegacySalesPage from "./legacy-sales-page";

/**
 * Controlled POS cutover boundary.
 *
 * Pharmacy/Grocery and the advanced retail sectors use the database v3
 * finalizer so sale header, tender, aggregate stock and exact batch/IMEI/
 * variant allocation commit atomically. HVAC remains on the mature legacy
 * route because that application workflow can create an installation job.
 */
export default function SalesPage() {
  const { org } = useSubscription();
  return isAtomicRetailSector(org.sector) ? <AtomicRetailSalesPage /> : <LegacySalesPage />;
}
