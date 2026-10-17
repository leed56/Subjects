import type { SectorLotSnapshot } from "@/lib/supabase/sector-dashboard-client";
import { NEAR_EXPIRY_DAYS } from "./pharmacy-config";

/** Business dates use Sri Lanka time, even when an owner checks stock abroad. */
export function sriLankaDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** Expired inventory is never included in available or near-expiry totals,
 * even when its stored status has not yet been changed from available. */
export function batchHealth(lots: SectorLotSnapshot[], now: Date) {
  const today = sriLankaDateKey(now);
  const stocked = lots.filter((lot) => lot.qtyOnHand > 0);
  const isExpired = (lot: SectorLotSnapshot) =>
    lot.status === "expired" || Boolean(lot.expiryDate && lot.expiryDate < today);
  const expired = stocked.filter(isExpired);
  const blocked = stocked.filter((lot) =>
    !isExpired(lot) && ["quarantine", "recalled", "returned"].includes(lot.status),
  );
  const available = stocked.filter((lot) => lot.status === "available" && !isExpired(lot));
  const nearExpiry = available.filter((lot) => {
    if (!lot.expiryDate) return false;
    const days = (Date.parse(lot.expiryDate) - Date.parse(today)) / 86_400_000;
    return days >= 0 && days <= NEAR_EXPIRY_DAYS;
  });
  return { expired, blocked, available, nearExpiry };
}
