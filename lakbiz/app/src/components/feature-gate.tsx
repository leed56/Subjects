"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/lib/i18n/locale-provider";
import { ROUTE_FEATURES } from "@/lib/subscription/can";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import type { FeatureKey } from "@/lib/subscription/types";

type FeatureGateProps = {
  children: ReactNode;
  /** Override route-based feature; defaults from ROUTE_FEATURES[pathname] */
  feature?: FeatureKey;
};

export function FeatureGate({ children, feature }: FeatureGateProps) {
  const pathname = usePathname();
  const { t } = useLocale();
  const { can, org } = useSubscription();
  const required =
    feature ?? ROUTE_FEATURES[pathname] ?? null;

  if (!required || !org.isAuthenticated || can(required)) {
    return children;
  }

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">{t("sub.upgrade_required")}</h1>
        <p className="mt-3 text-sm text-slate-600">{t("sub.upgrade_required_hint")}</p>
        <Link
          href="/settings/plans"
          className="mt-6 inline-block rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white"
        >
          {t("nav.plans")}
        </Link>
      </main>
    </div>
  );
}
