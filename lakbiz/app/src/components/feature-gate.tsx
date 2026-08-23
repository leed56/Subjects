"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain } from "@/components/ui/pro-shell";
import { useLocale } from "@/lib/i18n/locale-provider";
import { sectorAllowsFeature } from "@/lib/sector-features";
import { ROUTE_FEATURES } from "@/lib/subscription/can";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import type { FeatureKey, PlanFeatures } from "@/lib/subscription/types";

type FeatureGateProps = {
  children: ReactNode;
  /** Override route-based feature; defaults from ROUTE_FEATURES[pathname] */
  feature?: FeatureKey;
};

export function FeatureGate({ children, feature }: FeatureGateProps) {
  const pathname = usePathname();
  const { t, locale } = useLocale();
  const { can, org } = useSubscription();
  const required = feature ?? ROUTE_FEATURES[pathname] ?? null;

  if (!required || !org.isAuthenticated || can(required)) {
    return children;
  }

  const si = locale === "si";
  const workspaceBlocked =
    required !== "write" &&
    !sectorAllowsFeature(org.sector, required as keyof PlanFeatures);
  const title = workspaceBlocked
    ? si
      ? "මෙම module එක මෙම workspace එකට සක්‍රීය කර නැහැ"
      : "This module isn’t enabled for this workspace"
    : t("sub.upgrade_required");
  const description = workspaceBlocked
    ? si
      ? "ඔබගේ දත්ත සහ දැනට සක්‍රීය අංග වෙනස් නොවේ. මෙම module එක අවශ්‍ය නම් LakBiz පරිපාලකයා අමතන්න."
      : "Your existing data and enabled features are unchanged. Contact your LakBiz administrator if this module should be enabled."
    : t("sub.upgrade_required_hint");

  return (
    <AppShell>
      <ProMain>
        <section className="mx-auto flex min-h-[62vh] max-w-3xl items-center justify-center py-8 sm:py-14">
          <div className="w-full overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_15%_0%,rgba(20,184,166,0.09),transparent_22rem),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-6 py-8 sm:px-9 sm:py-10">
              <span className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300">
                {si ? "ප්‍රවේශ පාලනය" : "Workspace access"}
              </span>
              <h1 className="mt-5 max-w-2xl text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-3xl">
                {title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                {description}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                {!workspaceBlocked && (
                  <Link
                    href="/settings/plans"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-5 text-sm font-bold text-white shadow-lg shadow-teal-700/15 transition hover:bg-teal-700"
                  >
                    {t("nav.plans")}
                  </Link>
                )}
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50"
                >
                  {si ? "Dashboard වෙත යන්න" : "Back to dashboard"}
                </Link>
              </div>
            </div>
            <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
              <div className="bg-white px-6 py-5 sm:px-9">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  {si ? "දත්ත" : "Your data"}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-slate-800">
                  {si ? "දැනට සුරැකි දත්ත වෙනස් නොවේ" : "Existing records remain unchanged"}
                </p>
              </div>
              <div className="bg-white px-6 py-5 sm:px-9">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  {si ? "වැඩබිම" : "Workspace"}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-slate-800">
                  {si ? "සක්‍රීය අංග සාමාන්‍ය ලෙස භාවිතා කළ හැක" : "Enabled tools continue to work normally"}
                </p>
              </div>
            </div>
          </div>
        </section>
      </ProMain>
    </AppShell>
  );
}
