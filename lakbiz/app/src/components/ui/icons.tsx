/**
 * Inline SVG icon set — Phase 1 design system.
 *
 * Hand-rolled rather than a new dependency (icon libraries like lucide-react
 * or heroicons pull in a package + build-time tree-shaking assumptions for a
 * handful of glyphs this app actually uses). Stroke-based, 1.75 weight,
 * 24x24 viewBox, sized via className — matches the "professional icons, no
 * emoji as primary production icons" direction.
 */
import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

function base(children: React.ReactNode, props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const DashboardIcon = (p: IconProps) =>
  base(
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>,
    p,
  );

export const SalesIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2.5 3h2.4l2.2 11.4a2 2 0 0 0 2 1.6h8.3a2 2 0 0 0 2-1.6L21 7.5H6" />
    </>,
    p,
  );

export const BillsIcon = (p: IconProps) =>
  base(
    <>
      <path d="M6 2.5h9l3 3V21a.5.5 0 0 1-.7.46L15 20l-2.3 1.46a1 1 0 0 1-1.06 0L9.3 20 7 21.46A.5.5 0 0 1 6.3 21V2.5Z" />
      <path d="M9 8h6M9 12h6M9 16h3.5" />
    </>,
    p,
  );

export const CustomersIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M2.75 20a6.25 6.25 0 0 1 12.5 0" />
      <path d="M16 4.2a3.25 3.25 0 0 1 0 6.3" />
      <path d="M17.8 14.3a6.25 6.25 0 0 1 3.45 5.6" />
    </>,
    p,
  );

export const StockIcon = (p: IconProps) =>
  base(
    <>
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" />
      <path d="M3.8 7.3 12 12l8.2-4.7M12 12v9" />
    </>,
    p,
  );

export const SuppliersIcon = (p: IconProps) =>
  base(
    <>
      <path d="M2.5 6.5h11v9h-11z" />
      <path d="M13.5 10h3.3l3.2 2.7v2.8h-6.5" />
      <circle cx="6.5" cy="18.2" r="1.6" />
      <circle cx="16.5" cy="18.2" r="1.6" />
    </>,
    p,
  );

export const VehiclesIcon = (p: IconProps) =>
  base(
    <>
      <path d="M4 16V11.2a1.6 1.6 0 0 1 .3-.9L6.5 6.8a2 2 0 0 1 1.6-.8h7.8a2 2 0 0 1 1.6.8l2.2 3.5a1.6 1.6 0 0 1 .3.9V16" />
      <path d="M2.5 16h19v2.2a1 1 0 0 1-1 1h-1.4a1 1 0 0 1-1-1V17H6v1.2a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V16Z" />
      <circle cx="7.2" cy="16" r="1.6" />
      <circle cx="16.8" cy="16" r="1.6" />
    </>,
    p,
  );

export const JobsIcon = (p: IconProps) =>
  base(
    <>
      <path d="M14.7 6.3a3.5 3.5 0 0 1-4.6 4.6l-6.4 6.4a1.6 1.6 0 0 0 2.3 2.3l6.4-6.4a3.5 3.5 0 0 1 4.6-4.6l-2.6 2.6-1.6-1.6 2.6-2.6-.7-.7Z" />
    </>,
    p,
  );

export const WorkforceIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="8" cy="7.5" r="2.75" />
      <circle cx="16.2" cy="8.3" r="2.25" />
      <path d="M2.75 19.5a5.25 5.25 0 0 1 10.5 0" />
      <path d="M14 19.5a4.3 4.3 0 0 1 7.25-3.15" />
    </>,
    p,
  );

export const BankingIcon = (p: IconProps) =>
  base(
    <>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M4.5 9.5v9M9 9.5v9M15 9.5v9M19.5 9.5v9" />
      <path d="M2.5 20.5h19M2.5 9.5h19" />
    </>,
    p,
  );

export const VatIcon = (p: IconProps) =>
  base(
    <>
      <path d="M6 2.5h8l4 4V21a.5.5 0 0 1-.5.5H6.5A.5.5 0 0 1 6 21V2.5Z" />
      <path d="M14 2.5V6a1 1 0 0 0 1 1h3.5" />
      <path d="m8.5 17.5 5-6.5M9.3 12.2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm4.4 4.4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </>,
    p,
  );

export const SettingsIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V19.5a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2.5a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8.5a1.65 1.65 0 0 0 1-1.51V2.5a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8.5a1.65 1.65 0 0 0 1.51 1H21.5a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>,
    p,
  );

export const TeamIcon = CustomersIcon;

export const PlansIcon = (p: IconProps) =>
  base(
    <>
      <rect x="2.75" y="5.5" width="18.5" height="13" rx="2" />
      <path d="M2.75 9.75h18.5" />
      <path d="M6 14.5h4" />
    </>,
    p,
  );

export const ShopIcon = (p: IconProps) =>
  base(
    <>
      <path d="M3 9.5 4.2 3.5h15.6L21 9.5" />
      <path d="M3.5 9.5a2.25 2.25 0 0 0 4.4.75 2.25 2.25 0 0 0 4.4 0 2.25 2.25 0 0 0 4.4 0 2.25 2.25 0 0 0 4.4-.75" />
      <path d="M4.5 11v9.5h15V11" />
      <path d="M9.5 20.5v-5.75a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5.75" />
    </>,
    p,
  );

export const ChevronDownIcon = (p: IconProps) => base(<path d="m6 9 6 6 6-6" />, p);
export const ChevronRightIcon = (p: IconProps) => base(<path d="m9 6 6 6-6 6" />, p);
export const MenuIcon = (p: IconProps) => base(<path d="M4 7h16M4 12h16M4 17h16" />, p);
export const CloseIcon = (p: IconProps) => base(<path d="m6 6 12 12M18 6 6 18" />, p);
export const BellIcon = (p: IconProps) =>
  base(
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>,
    p,
  );
export const SearchIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </>,
    p,
  );
export const CheckIcon = (p: IconProps) => base(<path d="M4 12.5 9.5 18 20 6" />, p);
export const AlertTriangleIcon = (p: IconProps) =>
  base(
    <>
      <path d="M12 3.5 2.7 19.5a1 1 0 0 0 .87 1.5h17.06a1 1 0 0 0 .87-1.5L12 3.5Z" />
      <path d="M12 10v4.5M12 17.75v.01" />
    </>,
    p,
  );
export const MoreIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </>,
    p,
  );
export const SignOutIcon = (p: IconProps) =>
  base(
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>,
    p,
  );
export const CalendarIcon = (p: IconProps) =>
  base(
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
    </>,
    p,
  );
export const FilterIcon = (p: IconProps) =>
  base(<path d="M4 5h16M7 12h10M10.5 19h3" />, p);
export const PlusIcon = (p: IconProps) => base(<path d="M12 5v14M5 12h14" />, p);
export const AssetIcon = (p: IconProps) =>
  base(
    <>
      <rect x="3" y="5" width="18" height="9" rx="2" />
      <path d="M7 14v3M17 14v3M5 20h14" />
      <path d="M7.5 9.5h2M12 9.5h2" />
    </>,
    p,
  );

/** Distinct from WorkforceIcon (two individuals side by side): three
 * heads clustered together, reads as "a grouped unit" for the Crews page. */
export const CrewIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="7" r="2.5" />
      <circle cx="5.5" cy="9.5" r="2" />
      <circle cx="18.5" cy="9.5" r="2" />
      <path d="M7.5 20a4.5 4.5 0 0 1 9 0" />
      <path d="M2.5 18.5a3.5 3.5 0 0 1 4.3-3.4" />
      <path d="M21.5 18.5a3.5 3.5 0 0 0-4.3-3.4" />
    </>,
    p,
  );

/** Bar chart with a rising trend line — quoted-vs-cost-vs-margin reads as
 * "a financial comparison report", distinct from VatIcon's document shape. */
export const CostingIcon = (p: IconProps) =>
  base(
    <>
      <path d="M4 20.5V10M10 20.5V5M16 20.5v-7M20 20.5V3" />
      <path d="M2.5 20.5h19" />
    </>,
    p,
  );

/** A banknote (rounded rect + value emblem + corner marks) — money going
 * out, distinct from BillsIcon's receipt (money coming in) and
 * BankingIcon's columned bank front. */
export const ExpenseIcon = (p: IconProps) =>
  base(
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.25" />
      <path d="M6 9v.01M18 15v.01" />
    </>,
    p,
  );

/** A zig-zag trend line with plotted points inside an axis frame — reads as
 * "an analytical report over time", distinct from CostingIcon's static
 * rising bars. */
export const ReportsIcon = (p: IconProps) =>
  base(
    <>
      <path d="M3 3v18h18" />
      <path d="M6.5 15.5l4-4.5 3.5 3 5.5-7" />
      <circle cx="6.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="19.5" cy="7" r="1" fill="currentColor" stroke="none" />
    </>,
    p,
  );

/** Classic handset silhouette — Phase 15, tap-to-call links on Jobs/Schedule. */
export const PhoneIcon = (p: IconProps) =>
  base(
    <path d="M4.5 4.5c0-.55.45-1 1-1h2.15c.47 0 .87.32.98.78l.8 3.35a1 1 0 0 1-.29 1L7.9 9.9a13 13 0 0 0 6.2 6.2l1.27-1.24a1 1 0 0 1 1-.29l3.35.8c.46.11.78.51.78.98v2.15c0 .55-.45 1-1 1h-1.5C9.15 19.5 4.5 14.85 4.5 9V4.5Z" />,
    p,
  );

/** A globe with a meridian — the "bilingual / language" glyph, replacing
 * the 🇱🇰 flag emoji previously used for the "Sinhala first" landing
 * feature (a flag reads as "country", not "language switch"). */
export const LanguageIcon = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.6 3.8 5.8 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.8-3.8-9S9.5 5.6 12 3Z" />
    </>,
    p,
  );

/** A rounded chat-bubble outline — replaces the "💬" emoji previously used
 * as MessageSendButton's icon-variant glyph. */
export const ChatIcon = (p: IconProps) =>
  base(
    <path d="M4 5.5h16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H9l-4.4 3.3a.5.5 0 0 1-.8-.4V16H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />,
    p,
  );

/** An open tray/inbox shape — the generic "nothing here yet" empty-state
 * icon, replacing the emoji previously used as ProEmptyState's default. */
export const InboxIcon = (p: IconProps) =>
  base(
    <>
      <path d="M3.5 12.5h4.6l1.4 2.2h5l1.4-2.2h4.6" />
      <path d="M5.3 5.5h13.4l2.3 7v6a1.2 1.2 0 0 1-1.2 1.2H4.2A1.2 1.2 0 0 1 3 18.5v-6z" />
    </>,
    p,
  );

/** A location pin with a directional arrow through it — reads as
 * "navigate here", distinct from a plain map-pin marker. */
export const NavigateIcon = (p: IconProps) =>
  base(
    <>
      <path d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z" />
      <path d="m9.5 11.5 5-3-1.8 5.3-1.2-1.5-2-.8Z" />
    </>,
    p,
  );

/** Global premium UI phase, Part 28 — three new icons for the business-
 * sector picker/cards (SectorTemplate.icon was still a raw emoji; see
 * sector-icon.tsx). The other three sectors already had a real-shape
 * match: AssetIcon (wall-mount AC unit) for ac_hvac, JobsIcon (wrench)
 * for spare_parts, VehiclesIcon for car_sales — no new icon needed there. */

/** A shopping cart in profile — grocery/retail. */
export const CartIcon = (p: IconProps) =>
  base(
    <>
      <path d="M3 4h2l2.4 11.5a1.5 1.5 0 0 0 1.47 1.2h8.36a1.5 1.5 0 0 0 1.46-1.16L20.5 8.5H6.1" />
      <circle cx="9.5" cy="20" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.25" fill="currentColor" stroke="none" />
    </>,
    p,
  );

/** A phone/device silhouette with a home indicator — electronics. */
export const DeviceIcon = (p: IconProps) =>
  base(
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2" />
      <path d="M10.5 18.5h3" />
    </>,
    p,
  );

/** A lightning bolt — electricals. */
export const BoltIcon = (p: IconProps) =>
  base(<path d="M12.5 2.5 5 13.5h5.5L11 21.5l7.5-11H13l-.5-8Z" />, p);
