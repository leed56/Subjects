import {
  CartIcon,
  DeviceIcon,
  BoltIcon,
  JobsIcon,
  AssetIcon,
  VehiclesIcon,
  StockIcon,
  ShopIcon,
  type IconProps,
} from "@/components/ui/icons";
import type { SectorId } from "@/lib/types";

/** One professional SVG vocabulary for sector identity — no emoji drift. */
const SECTOR_ICON_BY_ID: Record<SectorId, (props: IconProps) => React.ReactElement> = {
  grocery: CartIcon,
  pharmacy: StockIcon,
  electronics: DeviceIcon,
  mobile_shop: DeviceIcon,
  electricals: BoltIcon,
  spare_parts: JobsIcon,
  footwear: ShopIcon,
  textile: StockIcon,
  ac_hvac: AssetIcon,
  car_sales: VehiclesIcon,
};

export function SectorIcon({ sectorId, className }: { sectorId: SectorId; className?: string }) {
  const Icon = SECTOR_ICON_BY_ID[sectorId] ?? CartIcon;
  return <Icon className={className} />;
}
