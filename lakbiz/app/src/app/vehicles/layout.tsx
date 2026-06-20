import { FeatureGate } from "@/components/feature-gate";

export default function VehiclesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FeatureGate feature="vehicles">{children}</FeatureGate>;
}
