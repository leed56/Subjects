import { FeatureGate } from "@/components/feature-gate";
import { PremiumJobExperience } from "@/components/jobs/premium-job-experience";

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FeatureGate feature="ac_jobs">
      {children}
      <PremiumJobExperience />
    </FeatureGate>
  );
}
