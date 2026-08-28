"use client";

/**
 * Business Pulse — a clean, glanceable owner-only view of "what's going on
 * with the business", separate from the operational dashboard. Where
 * /dashboard is built for running today's work (jobs, alerts, tables),
 * Pulse answers one question in under five seconds: is the business
 * healthy right now, and what (if anything) needs a decision.
 *
 * This file is a thin sector dispatcher — the owner/sector gate, plus a
 * loading state and an "available for your sector soon" empty state for
 * anything not yet built. The actual page content lives one per sector in
 * src/components/pulse/ (textile-business-pulse.tsx, pharmacy-business-
 * pulse.tsx), sharing their shell/hero/attention-list/highlights chrome
 * from pulse-shared.tsx. Originally textile-only; pharmacy was added
 * second once it became clear how much of the page (shell, hero,
 * highlights, bottom nav) was already sector-agnostic — see
 * pulse-shared.tsx's own docstring.
 */
import Link from "next/link";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useLocale } from "@/lib/i18n/locale-provider";
import { tt, PulseShell, PulseLoadingState, PulseEmptyState } from "@/components/pulse/pulse-shared";
import { TextileBusinessPulse } from "@/components/pulse/textile-business-pulse";
import { PharmacyBusinessPulse } from "@/components/pulse/pharmacy-business-pulse";

/** Sectors with a real Business Pulse variant built. Keep in sync with
 * nav-sections.ts's /pulse `sectorOnly` list — that list controls whether
 * the nav link even shows; this one decides what actually renders. */
const SUPPORTED_SECTORS = ["textile", "pharmacy"] as const;

export default function BusinessPulsePage() {
  const { ready, data } = useAppStore();
  const { locale, t } = useLocale();
  const { org, orgRole } = useSubscription();

  if (!ready || !data) {
    return (
      <PulseShell attentionCount={0} onBellClick={() => {}}>
        <PulseLoadingState label={t("common.loading")} />
      </PulseShell>
    );
  }

  // Owner-only, and only for sectors with a built variant. Not routed
  // through ShopRouteGuard's SHOP_PREFIXES — same deliberate in-page gate
  // as /textile/owner-intelligence, since canAccessShopRoute already
  // returns true unconditionally for "owner" regardless of href.
  if (orgRole !== "owner" || !SUPPORTED_SECTORS.includes(org.sector as (typeof SUPPORTED_SECTORS)[number])) {
    return (
      <PulseShell attentionCount={0} onBellClick={() => {}}>
        <PulseEmptyState
          title={
            orgRole !== "owner"
              ? tt(locale, "හිමිකරු පමණි", "Owner access only", "உரிமையாளர் அணுகல் மட்டும்")
              : tt(locale, "ඉක්මනින් පැමිණේ", "Coming soon for your sector", "உங்கள் துறைக்கு விரைவில்")
          }
          description={
            orgRole !== "owner"
              ? tt(
                  locale,
                  "Business Pulse දැනට ව්‍යාපාර හිමිකරුවන් සඳහා පමණි.",
                  "Business Pulse is available to business owners for now.",
                  "Business Pulse தற்போது வணிக உரிமையாளர்களுக்கு மட்டுமே கிடைக்கும்.",
                )
              : tt(
                  locale,
                  "Business Pulse දැනට රෙදි සහ ෆාමසි ව්‍යාපාර සඳහා පමණි.",
                  "Business Pulse is available for textile and pharmacy businesses for now.",
                  "Business Pulse தற்போது துணி மற்றும் மருந்தக வணிகங்களுக்கு மட்டுமே கிடைக்கும்.",
                )
          }
          action={
            <Link href="/dashboard" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-800 px-3.5 text-sm font-semibold text-slate-300 hover:bg-slate-800/60">
              {tt(locale, "සම්පූර්ණ dashboard", "Full dashboard", "முழு dashboard")} →
            </Link>
          }
        />
      </PulseShell>
    );
  }

  if (org.sector === "pharmacy") return <PharmacyBusinessPulse />;
  return <TextileBusinessPulse />;
}
