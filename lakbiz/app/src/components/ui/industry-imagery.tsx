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
  return <div className="live-industry-header-images" aria-hidden="true">
    <IndustryBannerArtwork sector={sector} />
  </div>;
}

/** Crop the local atlas through SVG so wide banners preserve photo proportions. */
function BannerPhoto({ cell, context }: { cell: number; context: string }) {
  return <svg
    className="industry-banner-photo"
    data-image-context={context}
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
    focusable="false"
  >
    <svg
      viewBox={`${(cell % 4) * 100} ${Math.floor(cell / 4) * 100} 100 100`}
      width="100" height="100" overflow="hidden"
    >
      <image href="/images/industry-products-atlas.webp" width="400" height="400" />
    </svg>
  </svg>;
}

/** Normal workspaces show only their industry; imports add neutral logistics. */
export function IndustryBannerArtwork({ sector, imports = false }: {
  sector: SectorId; imports?: boolean;
}) {
  return <>
    {imports && <BannerPhoto cell={14} context="shipping" />}
    <BannerPhoto cell={cells[sector]} context={sector} />
    {imports && <BannerPhoto cell={13} context="cartons" />}
  </>;
}
