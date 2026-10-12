import type { SectorId } from "@/lib/types";

const cells: Record<SectorId, number> = {
  grocery: 0, pharmacy: 1, cosmetics: 2, electronics: 3,
  mobile_shop: 4, electricals: 5, spare_parts: 6, footwear: 7,
  textile: 8, ac_hvac: 9, car_sales: 10, hardware: 11,
  stationery: 12, wholesale: 13,
};

/** Illustrative sector imagery, never a representation of an actual SKU. */
export function IndustryImage({ sector, className = "", decorative = false }: {
  sector: SectorId; className?: string; decorative?: boolean;
}) {
  const cell = cells[sector];
  return <span className={`reference-product-photo ${className}`}
    role={decorative ? undefined : "img"}
    aria-hidden={decorative || undefined}
    aria-label={decorative ? undefined : "Illustrative industry image"}
    style={{ backgroundPosition: `${((cell % 4) * 100) / 3}% ${(Math.floor(cell / 4) * 100) / 3}%` }} />;
}

export function IndustryHeaderImages({ sector }: { sector: SectorId }) {
  const contexts: SectorId[] = sector === "textile"
    ? ["textile", "wholesale", "textile"]
    : [sector, sector === "cosmetics" ? "pharmacy" : "cosmetics", "textile"];
  return <div className="live-industry-header-images" aria-hidden="true">
    {contexts.map((context, index) => <IndustryImage key={index} sector={context} decorative />)}
  </div>;
}
