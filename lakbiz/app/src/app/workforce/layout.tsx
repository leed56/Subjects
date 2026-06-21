import { FeatureGate } from "@/components/feature-gate";

export default function WorkforceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FeatureGate feature="ac_jobs">{children}</FeatureGate>;
}
