import type { ReactNode } from "react";
import { TrialBanner } from "@/components/trial-banner";
import { CloudSyncBanner } from "@/components/cloud-sync-banner";
import { OfflineBanner } from "@/components/offline-banner";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";

/**
 * Application shell for every authenticated shop/settings page — Phase 1.
 *
 * Replaces the old per-page `<SiteHeader />` (a horizontal top nav mounted
 * independently in 16 separate page files) with one shared left sidebar
 * (desktop) + compact top bar/drawer (mobile), matching the target
 * structure in the product spec. Drop-in: swap
 *   <ProPageShell><SiteHeader />{content}</ProPageShell>
 * for
 *   <AppShell>{content}</AppShell>
 * — everything a page previously rendered inside <ProMain> keeps working
 * unchanged; only the chrome around it moved.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full bg-slate-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <TrialBanner />
        <PwaInstallPrompt />
        <OfflineBanner />
        <CloudSyncBanner />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
