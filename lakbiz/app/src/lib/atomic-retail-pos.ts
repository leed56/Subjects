import type { SectorId } from "@/lib/types";

const ATOMIC_RETAIL_SECTORS = new Set<SectorId>([
  "grocery",
  "pharmacy",
  "mobile_shop",
  "electronics",
  "footwear",
]);

/**
 * Retail sectors that must use the single-transaction v3 POS finalizer.
 * HVAC intentionally remains on the legacy application workflow because an
 * AC-unit sale can also create an installation job, which v3 does not own yet.
 */
export function isAtomicRetailSector(sector: SectorId): boolean {
  return ATOMIC_RETAIL_SECTORS.has(sector);
}
