/**
 * Shared navigation model for the authenticated shop shell (Phase 1).
 *
 * Single source of truth for both the desktop Sidebar and the mobile nav —
 * previously each of the app's 16 shop/settings pages independently rendered
 * <SiteHeader /> with its own inline nav array. Grouping follows the target
 * structure in the product spec, trimmed to routes that actually exist today
 * (no "Invoices"/"Payments"/"Installations"/"AC Assets"/"Schedule" — those
 * are later-phase pages; adding them here would produce dead links).
 */
import type { FeatureKey } from "@/lib/subscription/types";

export type NavItem = {
  href: string;
  labelKey: string;
  /** Feature gate key, if this route is plan/addon-gated (see ROUTE_FEATURES). */
  feature?: FeatureKey;
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
      { href: "/suppliers", labelKey: "nav.suppliers", feature: "suppliers" },
      { href: "/vehicles", labelKey: "nav.vehicles", feature: "vehicles" },
    ],
  },
  {
    labelKey: "nav.section.service",
    items: [
      { href: "/jobs", labelKey: "nav.jobs", feature: "ac_jobs" },
      { href: "/assets", labelKey: "assets.title", feature: "ac_jobs" },
      { href: "/workforce", labelKey: "nav.workforce", feature: "ac_jobs" },
      { href: "/teams", labelKey: "crews.title", feature: "ac_jobs" },
    ],
  },
  {
    labelKey: "nav.section.finance",
    items: [
      { href: "/banking", labelKey: "nav.banking", feature: "banking" },
      { href: "/vat", labelKey: "nav.vat" },
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
