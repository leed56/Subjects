"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import {
  ProBadge,
  ProButton,
  ProCard,
  ProMain,
  ProPageHeader,
  ProPageShell,
  ProStatCard,
} from "@/components/ui/pro-shell";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PLANS, formatLkrPrice, getPlan, relevantAddons } from "@/lib/subscription/plans";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export default function BillingPage() {
  const { locale } = useLocale();
  const { subscription, org, daysLeftInTrial, isReadOnly } = useSubscription();
  const currentPlan = getPlan(subscription.planId);
  const addons = relevantAddons(org.sector, subscription.planId);
  const statusTone = subscription.status === "active" ? "emerald" : subscription.status === "trialing" ? "teal" : isReadOnly ? "amber" : "slate";
  const periodEnd = subscription.currentPeriodEnd ?? subscription.trialEndsAt;

  return (
    <ProPageShell>
      <SiteHeader />
      <ProMain>
        <ProPageHeader
          eyebrow="Subscription"
          title="Plan and account status"
          description="Your LakBiz plan, module access and account status are managed by the platform team."
          actions={
            <>
              <ProButton href="/dashboard" variant="secondary">Dashboard</ProButton>
              <ProButton href="/login?next=/admin" variant="secondary">Platform admin</ProButton>
            </>
          }
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProStatCard label="Current plan" value={locale === "si" ? currentPlan.nameSi : currentPlan.nameEn} hint="Assigned by LakBiz" icon="Plan" tone="teal" />
          <ProStatCard label="Status" value={subscription.status.replace("_", " ")} hint={daysLeftInTrial != null ? `${daysLeftInTrial} days left` : "Managed account"} icon="OK" tone={statusTone} />
          <ProStatCard label="Business" value={org.name} hint={org.isAuthenticated ? "Cloud account" : "Demo/local mode"} icon="Shop" tone="blue" />
          <ProStatCard label="Period end" value={periodEnd ? new Date(periodEnd).toLocaleDateString("en-LK") : "Manual"} hint="Updated by LakBiz" icon="Date" tone="amber" />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <ProCard title="Account management" eyebrow="LakBiz managed" action={<ProBadge tone="teal">Managed</ProBadge>}>
            <div className="space-y-4 text-sm font-semibold leading-6 text-slate-600">
              <p>Customer shops and plan changes are handled by the LakBiz platform team.</p>
              <p>This page is a read-only summary for customers. It does not include an online checkout flow.</p>
              <p>Contact LakBiz support for plan changes, renewals, module changes or account questions.</p>
            </div>
            <div className="mt-5 rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm font-bold text-teal-900">
              Your access is controlled from the platform admin panel.
            </div>
          </ProCard>

          <ProCard title="Assigned plan details" eyebrow="Current package">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">{locale === "si" ? currentPlan.nameSi : currentPlan.nameEn}</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{formatLkrPrice(currentPlan.priceMonthlyLkr)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Monthly reference price.</p>
            </div>
            <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600">
              <p>Users: up to {currentPlan.maxUsers}</p>
              <p>Branches: up to {currentPlan.maxBranches}</p>
              <p>Products: {currentPlan.maxProducts == null ? "unlimited" : currentPlan.maxProducts}</p>
            </div>
          </ProCard>
        </section>

        <section className="mt-6">
          <ProCard title="Available packages" eyebrow="Reference only">
            <div className="grid gap-4 md:grid-cols-3">
              {PLANS.map((plan) => (
                <div key={plan.id} className={`rounded-[1.25rem] border p-4 ${plan.id === subscription.planId ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-black text-slate-950">{locale === "si" ? plan.nameSi : plan.nameEn}</p>
                    {plan.id === subscription.planId && <ProBadge tone="teal">Current</ProBadge>}
                  </div>
                  <p className="mt-2 font-mono text-xl font-black text-teal-700">{formatLkrPrice(plan.priceMonthlyLkr)}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">Plan changes are handled by LakBiz.</p>
                </div>
              ))}
            </div>
          </ProCard>
        </section>

        {addons.length > 0 && (
          <section className="mt-6">
            <ProCard title="Optional add-ons" eyebrow="Reference only">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {addons.map((addon) => (
                  <div key={addon.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                    <p className="font-black text-slate-950">{locale === "si" ? addon.nameSi : addon.nameEn}</p>
                    <p className="mt-1 font-mono font-black text-teal-700">{formatLkrPrice(addon.priceMonthlyLkr)}/month</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">Contact LakBiz to activate.</p>
                  </div>
                ))}
              </div>
            </ProCard>
          </section>
        )}

        <p className="mt-6 text-center text-sm font-semibold text-slate-500">
          <Link href="/dashboard" className="text-teal-700 underline">Back to dashboard</Link>
        </p>
      </ProMain>
    </ProPageShell>
  );
}
