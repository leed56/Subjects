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
