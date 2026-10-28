"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { sectorAllowsRoute } from "@/lib/sector-features";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain } from "@/components/ui/pro-shell";
import { useLocale } from "@/lib/i18n/locale-provider";

const SHOP_PREFIXES = [
  "/dashboard",
  "/sales",
  "/vat",
  "/stock",
  "/suppliers",
  "/jobs",
  "/schedule",
  "/workforce",
  "/vehicles",
  "/bills",
  "/customers",
  "/banking",
  "/assets",
  "/teams",
  "/job-costing",
  "/expenses",
  "/reports",
  "/textile",
  "/pulse",
];

function isShopPath(pathname: string): boolean {
  return SHOP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Redirect data_entry (and future restricted roles) away from blocked shop routes. */
export function ShopRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { canAccessShopRoute, org, ready, isPlatformAdmin } = useSubscription();
  const { locale, t } = useLocale();
  const sectorBlocked = ready && !isPlatformAdmin && !sectorAllowsRoute(org.sector, pathname);
  const roleBlocked = ready && org.isAuthenticated && !isPlatformAdmin && isShopPath(pathname) && !canAccessShopRoute(pathname);

  useEffect(() => {
    if (!roleBlocked || sectorBlocked) return;
    router.replace("/dashboard");
  }, [roleBlocked, sectorBlocked, router]);

  if (!ready && (isShopPath(pathname) || pathname.startsWith("/settings/"))) return <main className="p-6 text-sm text-slate-600">{t("common.loading")}</main>;
  if (sectorBlocked || roleBlocked) {
    return <AppShell><ProMain><section data-ui="workspace-route-blocked" className="rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">{locale === "si" ? "මෙම පිටුව ඔබගේ ව්‍යාපාර ආකෘතියට අයත් නොවේ" : locale === "ta" ? "இந்தப் பக்கம் உங்கள் வணிக வகைக்குக் கிடைக்காது" : "This page is unavailable for your workspace"}</h1>
      <Link href="/dashboard" className="mt-5 inline-flex rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white">{t("nav.dashboard")}</Link>
    </section></ProMain></AppShell>;
  }
  return children;
}
