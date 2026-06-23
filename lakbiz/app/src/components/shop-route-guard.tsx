"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const SHOP_PREFIXES = [
  "/dashboard",
  "/sales",
  "/vat",
  "/stock",
  "/suppliers",
  "/jobs",
  "/workforce",
  "/vehicles",
  "/bills",
  "/customers",
  "/banking",
];

function isShopPath(pathname: string): boolean {
  return SHOP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Redirect data_entry (and future restricted roles) away from blocked shop routes. */
export function ShopRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { canAccessShopRoute, org } = useSubscription();

  useEffect(() => {
    if (!org.isAuthenticated) return;
    if (!isShopPath(pathname)) return;
    if (canAccessShopRoute(pathname)) return;
    router.replace("/dashboard");
  }, [pathname, router, canAccessShopRoute, org.isAuthenticated]);

  return null;
}
