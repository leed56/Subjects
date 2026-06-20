import { FeatureGate } from "@/components/feature-gate";

export default function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FeatureGate feature="customers">{children}</FeatureGate>;
}
