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
 * spacious workspace surface. Page-level components own their hierarchy;
 * the shell deliberately avoids extra chrome that would make operational
 * screens feel crowded.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full bg-[#f5f7fb] text-slate-950">
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
