"use client";

import { useMemo } from "react";
import { NAV_SECTIONS, MANAGEMENT_ITEMS, type NavItem, type NavSection } from "@/lib/nav-sections";
import { ROUTE_FEATURES } from "@/lib/subscription/can";
import { useSubscription } from "@/lib/subscription/subscription-provider";

/** Filters the shared nav model by route access, plan/addon features, role and
 * the provisioned business sector. Desktop and MobileNav consume this same
 * result so a stricter nested workflow never leaks into one navigation only. */
export function useShopNav(): {
  sections: { labelKey: string | null; items: NavItem[] }[];
  managementItems: NavItem[];
} {
  const { can, canAccessShopRoute, canAccessSettingsPath, org, orgRole } = useSubscription();

  return useMemo(() => {
    const visible = (item: NavItem) => {
      if (item.sectorOnly && !item.sectorOnly.includes(org.sector)) return false;
      if (item.roleOnly && !item.roleOnly.includes(orgRole)) return false;
      if (!canAccessShopRoute(item.href)) return false;
      const feature = ROUTE_FEATURES[item.href];
      if (!feature) return true;
      return can(feature);
    };

    const sections: NavSection[] = NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(visible),
    })).filter((section) => section.items.length > 0);

    const managementItems = MANAGEMENT_ITEMS.filter((item) => canAccessSettingsPath(item.href));

    return { sections, managementItems };
  }, [can, canAccessShopRoute, canAccessSettingsPath, org.sector, orgRole]);
}
