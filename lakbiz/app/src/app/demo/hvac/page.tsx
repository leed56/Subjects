"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { createHvacDemoData, createHvacDemoAssets, HVAC_DEMO_ID, HVAC_DEMO_ASSETS_KEY } from "@/lib/hvac-demo";

export default function HvacDemoPage() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading || user) return;
    const key = `lakbiz-app-data-v2-${HVAC_DEMO_ID}`;
    const reset = new URLSearchParams(window.location.search).get("reset") === "1";
    if (reset || !localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(createHvacDemoData()));
      localStorage.setItem(HVAC_DEMO_ASSETS_KEY, JSON.stringify(createHvacDemoAssets()));
    }
    localStorage.setItem("lakbiz-org-demo", JSON.stringify({ id: HVAC_DEMO_ID, name: "LakBiz Cooling Studio · Demo", sector: "ac_hvac", isAuthenticated: false, role: "owner" }));
    localStorage.setItem("lakbiz-subscription-demo", JSON.stringify({ planId: "pro", status: "active", billingCycle: "monthly", trialEndsAt: null, currentPeriodEnd: null, addons: [], isDemo: true }));
    window.location.replace("/dashboard");
  }, [loading, user]);
  return (
    <main className="mx-auto max-w-xl px-6 py-20 text-center">
      <h1 className="text-3xl font-bold text-blue-950">LakBiz HVAC demo</h1>
      <p className="mt-4 text-slate-600">{user ? "You are signed in to a shop. Open this demo in a private browser window to explore the sample workspace." : "Preparing your sample service workspace…"}</p>
      {user && <Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">Back to your workspace</Link>}
    </main>
  );
}
