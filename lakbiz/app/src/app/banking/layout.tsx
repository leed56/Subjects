import { FeatureGate } from "@/components/feature-gate";

export default function BankingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FeatureGate feature="banking">{children}</FeatureGate>;
}
