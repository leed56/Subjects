"use client";

import type { ReactNode } from "react";
import { RetailCommandCenter } from "@/components/dashboard/retail-command-center";
import { AppShell } from "@/components/shell/app-shell";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

/**
 * Sector-level dashboard composition.
 *
 * Pharmacy and Grocery are retail operating systems, so they get a dedicated
 * command center rather than inheriting the generic/HVAC-oriented dashboard.
 * Other sectors continue to render the existing page unchanged. Subscription
 * readiness is checked before looking at org.sector so an authenticated
 * Pharmacy can never flash the anonymous Grocery fallback during startup.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { data, ready: storeReady } = useAppStore();
  const { org, ready: subscriptionReady } = useSubscription();
  const { t } = useLocale();

  if (!subscriptionReady) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  const retailSector = org.sector === "pharmacy" || org.sector === "grocery" ? org.sector : null;
  if (!retailSector) return children;

  if (!storeReady || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ProMain>
        <RetailCommandCenter data={data} sector={retailSector} />
      </ProMain>
    </AppShell>
  );
}
