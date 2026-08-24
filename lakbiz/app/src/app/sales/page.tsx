"use client";

import { AtomicRetailSalesPageV2 } from "@/components/sales/atomic-retail-sales-page-v2";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { isAtomicRetailSector } from "@/lib/atomic-retail-pos";
import LegacySalesPage from "./legacy-sales-page";

/**
 * Controlled POS cutover boundary.
 *
 * Pharmacy/Grocery and the advanced retail sectors use the database v3
 * finalizer so sale header, mixed tenders, aggregate stock and exact batch/
 * IMEI/variant allocation commit atomically. HVAC remains on the mature
 * legacy route because that application workflow can create an installation
 * job after an AC-unit sale.
 */
export default function SalesPage() {
  const { org } = useSubscription();
  return isAtomicRetailSector(org.sector) ? <AtomicRetailSalesPageV2 /> : <LegacySalesPage />;
}
