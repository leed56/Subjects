import type { ReactNode } from "react";
import { TrialBanner } from "@/components/trial-banner";
import { CloudSyncBanner } from "@/components/cloud-sync-banner";
import { OfflineBanner } from "@/components/offline-banner";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { SectorWorkspaceAutoBanner } from "@/components/sector/sector-workspace-auto-banner";
import { Sidebar } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";

/**
 * Application shell for every authenticated shop/settings page.
 * The desktop experience uses one persistent navigation rail and a quiet,
 * layered workspace surface. The canvas is intentionally cool and slightly
 * dimensional so white operational cards read as surfaces rather than a
 * continuous white sheet; page-level components still own the hierarchy.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full bg-[radial-gradient(circle_at_18%_0%,rgba(20,184,166,0.055),transparent_28rem),radial-gradient(circle_at_95%_12%,rgba(56,189,248,0.035),transparent_26rem),linear-gradient(180deg,#f5f8fc_0%,#edf3f8_100%)] text-slate-950">
      <a href="#main-content" className="fixed left-3 top-3 z-[120] -translate-y-20 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl transition focus:translate-y-0">Skip to content / අන්තර්ගතයට යන්න</a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <TrialBanner />
        <PwaInstallPrompt />
        <OfflineBanner />
        <CloudSyncBanner />
        <SectorWorkspaceAutoBanner />
        <div id="main-content" tabIndex={-1} className="flex-1 pb-20 lg:pb-0">{children}</div>
      </div>
    </div>
  );
}
