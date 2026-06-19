"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const SHOP_ROUTE_PREFIXES = [
  "/dashboard",
  "/sales",
  "/vat",
  "/stock",
  "/suppliers",
  "/jobs",
  "/vehicles",
  "/bills",
  "/customers",
  "/banking",
  "/settings",
];

function isShopRoute(pathname: string): boolean {
  return SHOP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Super admins manage tenants at /admin — keep them off the shop owner UI. */
export function PlatformAdminRedirect() {
  const { user, loading } = useAuth();
  const { isPlatformAdmin } = useSubscription();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user || !isPlatformAdmin) return;
    if (pathname.startsWith("/admin")) return;
    if (!isShopRoute(pathname)) return;
    router.replace("/admin");
  }, [loading, user, isPlatformAdmin, pathname, router]);

  return null;
}
