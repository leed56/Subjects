import type { Metadata } from "next";
import { DemoCatalogue } from "@/components/demo/demo-catalogue";
export const metadata: Metadata = {
  title: "LakBiz — Industry Showcase",
  description:
    "Explore complete industry demos with public sample logins and synthetic data.",
};
export default function DemoPage() {
  return <DemoCatalogue />;
}
