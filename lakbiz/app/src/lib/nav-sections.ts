/**
 * Shared navigation model for the authenticated shop shell.
 * Desktop and mobile consume the same structure so routes, role gates and
 * sector-specific workspaces cannot drift apart.
 */
import type { OrgRole, FeatureKey } from "@/lib/subscription/types";
import type { SectorId } from "@/lib/types";

export type NavItem = {
  href: string;
  /** Normal translated label. Optional when a sector-specific direct label is supplied. */
  labelKey?: string;
  /** Direct labels are useful for new vertical workspaces without forcing a giant translation-file edit. */
  labelEn?: string;
  labelSi?: string;
  /** Feature gate key, if this route is plan/addon-gated (see ROUTE_FEATURES). */
  feature?: FeatureKey;
  /** Show this navigation item only for these provisioned business sectors. */
  sectorOnly?: SectorId[];
  /** Additional presentation gate for operational workspaces with stricter roles than their parent route. */
  roleOnly?: OrgRole[];
};

export type NavSection = {
  /** Null for the standalone Dashboard entry, which renders without a group heading. */
  labelKey: string | null;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: null,
    items: [{ href: "/dashboard", labelKey: "nav.dashboard" }],
  },
  {
    labelKey: "nav.section.sales",
    items: [
      { href: "/sales", labelKey: "nav.sales" },
      { href: "/bills", labelKey: "nav.bills" },
      { href: "/customers", labelKey: "nav.customers", feature: "customers" },
    ],
  },
  {
    labelKey: "nav.section.inventory",
    items: [
      { href: "/stock", labelKey: "nav.stock" },
      {
        href: "/stock/rolls",
        labelEn: "Fabric rolls",
        labelSi: "රෙදි roll තොගය",
        sectorOnly: ["textile"],
      },
      {
        href: "/stock/advanced",
        labelEn: "Inventory control",
        labelSi: "උසස් තොග පාලනය",
        sectorOnly: ["pharmacy", "electronics", "mobile_shop", "footwear", "textile"],
      },
      {
        href: "/stock/advanced/queue",
        labelEn: "Receiving queue",
        labelSi: "ලැබුණු තොග පෝලිම",
        sectorOnly: ["pharmacy", "electronics", "mobile_shop", "footwear", "textile"],
      },
      {
        href: "/stock/advanced/returns",
        labelEn: "Return inspection",
        labelSi: "ආපසු භාණ්ඩ පරීක්ෂාව",
        sectorOnly: ["pharmacy", "electronics", "mobile_shop", "footwear", "textile"],
        roleOnly: ["owner", "manager"],
      },
      { href: "/suppliers", labelKey: "nav.suppliers", feature: "suppliers" },
      { href: "/vehicles", labelKey: "nav.vehicles", feature: "vehicles" },
    ],
  },
  {
    labelKey: "nav.section.service",
    items: [
      { href: "/jobs", labelKey: "nav.jobs", feature: "ac_jobs" },
      { href: "/schedule", labelKey: "schedule.title", feature: "ac_jobs" },
      { href: "/assets", labelKey: "assets.title", feature: "ac_jobs" },
      { href: "/workforce", labelKey: "nav.workforce", feature: "ac_jobs" },
      { href: "/teams", labelKey: "nav.field_teams", feature: "ac_jobs" },
    ],
  },
  {
    labelKey: "nav.section.finance",
    items: [
      { href: "/banking", labelKey: "nav.banking", feature: "banking" },
      {
        href: "/banking/pos-routing",
        labelEn: "POS payment routing",
        labelSi: "POS ගෙවීම් මාර්ගය",
        feature: "banking",
        roleOnly: ["owner"],
      },
      { href: "/vat", labelKey: "nav.vat" },
      { href: "/expenses", labelKey: "expenses.title" },
      {
        href: "/returns",
        labelEn: "Returns control",
        labelSi: "ආපසු භාණ්ඩ පාලනය",
        roleOnly: ["owner"],
      },
      { href: "/job-costing", labelKey: "costing.title", feature: "ac_jobs" },
      { href: "/reports", labelKey: "reports.title" },
    ],
  },
];

/** Management group items live under /settings/*, each individually permission-checked. */
export const MANAGEMENT_ITEMS: NavItem[] = [
  { href: "/settings/team", labelKey: "nav.team" },
  { href: "/settings/plans", labelKey: "nav.plans" },
  { href: "/settings/notifications", labelKey: "nav.notifications" },
  { href: "/settings/shop", labelKey: "nav.settings_shop" },
];
