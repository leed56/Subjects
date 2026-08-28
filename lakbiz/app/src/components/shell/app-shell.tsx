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
      {/* A prior version hid this with a CSS transform (-translate-y-full,
          revealed via focus:translate-y-0). That box was still laid out
          at top-3 before the transform, and a translateY(-100%) only
          shifts an element up by its OWN rendered height -- its bottom
          edge ends up sitting right back at that top-3 offset regardless
          of height, so a slice of the (rounded, near-black, z-120) box
          stayed inside the viewport on every page, focused or not --
          exactly the "permanent visible black banner" symptom reported.
          Tailwind's built-in sr-only/focus:not-sr-only pair replaces it:
          sr-only's clip-based hide doesn't depend on any size/transform
          arithmetic, so "invisible unless focused" is guaranteed. The
          focus: positioning classes (fixed/left-1/2/top-3/etc.) are the
          same visible presentation as before, applied only on focus.
          Centred at the top of the viewport (not left-anchored) so it
          never sits on top of the sidebar's brand mark once focused --
          the sidebar spans x:0..16rem on desktop, which a left-anchored
          skip link would overlap. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-1/2 focus:top-3 focus:z-[120] focus:-translate-x-1/2 focus:rounded-xl focus:bg-slate-950 focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:shadow-xl"
      >
        Skip to content / අන්තර්ගතයට යන්න / உள்ளடக்கத்திற்குச் செல்ல
      </a>
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
