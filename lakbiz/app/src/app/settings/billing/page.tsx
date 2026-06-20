"use client";

import { useState } from "react";
import { PlanCard } from "@/components/plan-card";
import { SiteHeader } from "@/components/site-header";
import { TrialBanner } from "@/components/trial-banner";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  PLANS,
  formatLkrPrice,
  getPlan,
  relevantAddons,
} from "@/lib/subscription/plans";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import type { BillingCycle, PlanId } from "@/lib/subscription/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function BillingPage() {
  const { t, locale } = useLocale();
  const {
    subscription,
    org,
    setDemoPlan,
    setDemoBillingCycle,
    daysLeftInTrial,
  } = useSubscription();
  const [message, setMessage] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>(subscription.billingCycle);
  const cloudConnected = isSupabaseConfigured();

  const currentPlan = getPlan(subscription.planId);

  const handleSelectPlan = async (planId: PlanId) => {
    setDemoPlan(planId);
    setDemoBillingCycle(cycle);

    if (!cloudConnected || !org.isAuthenticated || subscription.isDemo) {
      setMessage(t("sub.demo_mode"));
      setTimeout(() => setMessage(""), 4000);
      return;
    }

    setMessage(t("common.loading"));
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle: cycle }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        checkoutUrl?: string;
        error?: string;
        code?: string;
      };

      if (json.ok && json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }

      setMessage(json.error ?? t("sub.checkout_error"));
    } catch {
      setMessage(t("sub.checkout_error"));
    }
    setTimeout(() => setMessage(""), 6000);
  };

  const statusLabel =
    subscription.status === "trialing"
      ? t("sub.trial")
      : subscription.status === "active"
        ? t("sub.active")
        : subscription.status;

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">{t("sub.title")}</h1>
          <p className="text-slate-600">{t("sub.subtitle")}</p>
        </div>

        {message && (
          <div className="mb-6 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {message}
          </div>
        )}

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <p className="text-sm text-slate-500">{t("sub.status")}</p>
            <p className="text-lg font-semibold capitalize">{statusLabel}</p>
            {org.isAuthenticated && (
              <p className="text-sm text-slate-600">{org.name}</p>
            )}
            {cloudConnected && !subscription.isDemo && (
              <p className="text-xs text-green-700">{t("sub.db_connected")}</p>
            )}
            {subscription.status === "trialing" && daysLeftInTrial != null && (
              <p className="text-sm text-teal-700">
                {t("sub.trial_banner")} {daysLeftInTrial}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-slate-500">{t("sub.current_plan")}</p>
            <p className="text-lg font-semibold">
              {locale === "si" ? currentPlan.nameSi : currentPlan.nameEn}
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-200 p-1">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`rounded-md px-4 py-1.5 text-sm ${
                cycle === "monthly"
                  ? "bg-teal-700 text-white"
                  : "text-slate-600"
              }`}
            >
              {t("sub.monthly")}
            </button>
            <button
              type="button"
              onClick={() => setCycle("annual")}
              className={`rounded-md px-4 py-1.5 text-sm ${
                cycle === "annual"
                  ? "bg-teal-700 text-white"
                  : "text-slate-600"
              }`}
            >
              {t("sub.annual")}
            </button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              cycle={cycle}
              currentPlanId={subscription.planId}
              sectorId={org.sector}
              onSelect={handleSelectPlan}
            />
          ))}
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-900">
            {t("sub.addons")}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {relevantAddons(org.sector, subscription.planId).map((addon) => (
              <div
                key={addon.id}
                className="rounded-lg border border-slate-200 bg-white p-4 text-sm"
              >
                <p className="font-medium">
                  {locale === "si" ? addon.nameSi : addon.nameEn}
                </p>
                <p className="text-teal-700">
                  {formatLkrPrice(addon.priceMonthlyLkr)}/{t("sub.month")}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-800">{t("sub.pay_manual")}</p>
          <p className="mt-2">{t("sub.payhere_soon")}</p>
          {!isSupabaseConfigured() && (
            <p className="mt-2 text-amber-700">{t("sub.demo_mode")}</p>
          )}
        </section>
      </main>
    </div>
  );
}
