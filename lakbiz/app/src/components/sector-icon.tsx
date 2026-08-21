import {
  CartIcon,
  DeviceIcon,
  BoltIcon,
  JobsIcon,
  AssetIcon,
  VehiclesIcon,
  type IconProps,
} from "@/components/ui/icons";
import type { SectorId } from "@/lib/types";

/** Global premium UI phase, Part 28 — replaces the raw emoji every
 * SectorTemplate row used to carry as its `icon` field (🛒/📱/⚡/🔧/❄️/🚗).
 * A lookup by id rather than data-carried JSX, same convention as
 * NAV_ICON_BY_HREF: sector data (sectors.ts) stays plain data, the icon
 * choice lives with the other icon-set decisions in one place. */
const SECTOR_ICON_BY_ID: Record<SectorId, (props: IconProps) => React.ReactElement> = {
  grocery: CartIcon,
  electronics: DeviceIcon,
  electricals: BoltIcon,
  spare_parts: JobsIcon,
  ac_hvac: AssetIcon,
  car_sales: VehiclesIcon,
};

export function SectorIcon({ sectorId, className }: { sectorId: SectorId; className?: string }) {
  const Icon = SECTOR_ICON_BY_ID[sectorId] ?? CartIcon;
  return <Icon className={className} />;
}
