import { MarketingHeader } from "@/components/landing/marketing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingSectors } from "@/components/landing/landing-sectors";
import {
  LandingFeatures,
  LandingCta,
  LandingFooter,
  MobileStickyCta,
} from "@/components/landing/landing-sections";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-0">
      <MarketingHeader />
      <main>
        <LandingHero />
        <LandingSectors />
        <LandingFeatures />
        <LandingCta />
      </main>
      <LandingFooter />
      <MobileStickyCta />
    </div>
  );
}
