import type { SectorId } from "@/lib/types";

const cells: Record<SectorId, number> = {
  grocery: 0, pharmacy: 1, cosmetics: 2, electronics: 3,
  mobile_shop: 4, electricals: 5, spare_parts: 6, footwear: 7,
  textile: 8, ac_hvac: 9, car_sales: 10, hardware: 11,
  stationery: 12, wholesale: 13,
};

/** Illustrative sector imagery, never a representation of an actual SKU. */
export function IndustryImage({ sector, className = "", decorative = false, variant = 0, imageLabel }: {
  sector: SectorId; className?: string; decorative?: boolean; variant?: number; imageLabel?: string;
}) {
  const cell = cells[sector];
  const rollCell = Math.abs(Math.trunc(variant)) % 4;
  return <span className={`reference-product-photo ${className}`}
    role={decorative ? undefined : "img"}
    aria-hidden={decorative || undefined}
    aria-label={decorative ? undefined : imageLabel ?? (sector === "textile" ? "Wholesale fabric rolls — illustrative image" : "Illustrative industry image")}
    style={sector === "textile" ? {
      backgroundImage: 'url("/images/textile-fabric-rolls-atlas.webp")',
      backgroundSize: "200% 200%",
      backgroundPosition: `${(rollCell % 2) * 100}% ${Math.floor(rollCell / 2) * 100}%`,
    } : { backgroundPosition: `${((cell % 4) * 100) / 3}% ${(Math.floor(cell / 4) * 100) / 3}%` }} />;
}

export function IndustryHeaderImages({ sector }: { sector: SectorId }) {
  return <div className="live-industry-header-images" aria-hidden="true">
    <IndustryBannerArtwork sector={sector} />
  </div>;
}

/** Crop the local atlas through SVG so wide banners preserve photo proportions. */
function BannerPhoto({ cell, context, fabricRolls = false }: { cell: number; context: string; fabricRolls?: boolean }) {
  const columns = fabricRolls ? 2 : 4;
  return <svg
    className="industry-banner-photo"
    data-image-context={context}
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
    focusable="false"
  >
    <svg
      viewBox={`${(cell % columns) * 100} ${Math.floor(cell / columns) * 100} 100 100`}
      width="100" height="100" overflow="hidden"
    >
      <image href={fabricRolls ? "/images/textile-fabric-rolls-atlas.webp" : "/images/industry-products-atlas.webp"} width={columns * 100} height={columns * 100} />
    </svg>
  </svg>;
}

/** Normal workspaces show only their industry; imports add neutral logistics. */
export function IndustryBannerArtwork({ sector, imports = false }: {
  sector: SectorId; imports?: boolean;
}) {
  return <>
    {imports && <BannerPhoto cell={14} context="shipping" />}
    <BannerPhoto cell={sector === "textile" ? 0 : cells[sector]} context={sector} fabricRolls={sector === "textile"} />
    {imports && <BannerPhoto cell={13} context="cartons" />}
  </>;
}
