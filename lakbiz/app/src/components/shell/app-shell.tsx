import type { ReactNode } from "react";
import { TrialBanner } from "@/components/trial-banner";
import { CloudSyncBanner } from "@/components/cloud-sync-banner";
import { OfflineBanner } from "@/components/offline-banner";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
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
