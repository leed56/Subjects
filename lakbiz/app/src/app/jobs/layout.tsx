import { FeatureGate } from "@/components/feature-gate";

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FeatureGate feature="ac_jobs">{children}</FeatureGate>;
}
