import { FeatureGate } from "@/components/feature-gate";

export default function SuppliersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FeatureGate feature="suppliers">{children}</FeatureGate>;
}
