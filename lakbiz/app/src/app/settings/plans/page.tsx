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

export default function PlansPage() {
  const { locale, t } = useLocale();
  const { subscription, org, daysLeftInTrial, isReadOnly } = useSubscription();
  const currentPlan = getPlan(subscription.planId);
  const addons = relevantAddons(org.sector, subscription.planId);
  const statusTone =
    subscription.status === "active"
      ? "emerald"
      : subscription.status === "trialing"
        ? "teal"
        : isReadOnly
          ? "amber"
          : "slate";
  const periodEnd = subscription.currentPeriodEnd ?? subscription.trialEndsAt;
  const planName = locale === "si" ? currentPlan.nameSi : currentPlan.nameEn;

  return (
    <ProPageShell>
      <SiteHeader />
      <ProMain>
        <ProPageHeader
          eyebrow={t("sub.plans_eyebrow")}
          title={t("sub.plans_page_title")}
          description={t("sub.plans_page_desc")}
          actions={
            <ProButton href="/dashboard" variant="secondary">
              Dashboard
            </ProButton>
          }
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProStatCard
            label={t("sub.plans_stat_plan")}
            value={planName}
            hint={t("sub.plans_assigned_hint")}
            icon="Plan"
            tone="teal"
          />
          <ProStatCard
            label={t("sub.plans_stat_status")}
            value={subscription.status.replace("_", " ")}
            hint={
              daysLeftInTrial != null
                ? `${daysLeftInTrial} days left`
                : t("sub.plans_managed_account")
            }
            icon="OK"
            tone={statusTone}
          />
          <ProStatCard
            label={t("sub.plans_stat_business")}
            value={org.name}
            hint={org.isAuthenticated ? t("sub.db_connected") : t("sub.login_demo")}
            icon="Shop"
            tone="blue"
          />
          <ProStatCard
            label={t("sub.plans_stat_period")}
            value={
              periodEnd
                ? new Date(periodEnd).toLocaleDateString("en-LK")
                : t("sub.plans_manual_period")
            }
            hint={t("sub.plans_updated_by")}
            icon="Date"
            tone="amber"
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <ProCard
            title={t("sub.plans_managed_title")}
            eyebrow={t("sub.plans_managed_eyebrow")}
            action={<ProBadge tone="teal">{t("sub.plans_managed_badge")}</ProBadge>}
          >
            <div className="space-y-4 text-sm font-semibold leading-6 text-slate-600">
              <p>{t("sub.plans_managed_p1")}</p>
              <p>{t("sub.plans_managed_p2")}</p>
              <p>{t("sub.plans_managed_p3")}</p>
            </div>
            <div className="mt-5 rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm font-bold text-teal-900">
              {t("sub.plans_managed_note")}
            </div>
          </ProCard>

          <ProCard title={t("sub.plans_current_eyebrow")} eyebrow={t("sub.current_plan")}>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                {planName}
              </p>
              <p className="mt-2 text-3xl font-black text-slate-950">
                {formatLkrPrice(currentPlan.priceMonthlyLkr)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {t("sub.plans_reference_price")}
              </p>
            </div>
            <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600">
              <p>
                {t("sub.users")}: {currentPlan.maxUsers}
              </p>
              <p>
                {t("sub.branches")}: {currentPlan.maxBranches}
              </p>
              <p>
                {t("sub.products_cap")}:{" "}
                {currentPlan.maxProducts == null ? t("sub.unlimited_products") : currentPlan.maxProducts}
              </p>
            </div>
          </ProCard>
        </section>

        <section className="mt-6">
          <ProCard title={t("sub.choose_plan")} eyebrow={t("sub.plans_packages_eyebrow")}>
            <div className="grid gap-4 md:grid-cols-3">
              {PLANS.map((plan) => {
                const name = locale === "si" ? plan.nameSi : plan.nameEn;
                return (
                  <div
                    key={plan.id}
                    className={`rounded-[1.25rem] border p-4 ${
                      plan.id === subscription.planId
                        ? "border-teal-200 bg-teal-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg font-black text-slate-950">{name}</p>
                      {plan.id === subscription.planId && (
                        <ProBadge tone="teal">{t("sub.plans_current_badge")}</ProBadge>
                      )}
                    </div>
                    <p className="mt-2 font-mono text-xl font-black text-teal-700">
                      {formatLkrPrice(plan.priceMonthlyLkr)}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      {t("sub.plans_plan_changes")}
                    </p>
                  </div>
                );
              })}
            </div>
          </ProCard>
        </section>

        {addons.length > 0 && (
          <section className="mt-6">
            <ProCard title={t("sub.addons")} eyebrow={t("sub.plans_addons_eyebrow")}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {addons.map((addon) => (
                  <div
                    key={addon.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-sm"
                  >
                    <p className="font-black text-slate-950">
                      {locale === "si" ? addon.nameSi : addon.nameEn}
                    </p>
                    <p className="mt-1 font-mono font-black text-teal-700">
                      {formatLkrPrice(addon.priceMonthlyLkr)}/{t("sub.month")}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      {t("sub.plans_contact_activate")}
                    </p>
                  </div>
                ))}
              </div>
            </ProCard>
          </section>
        )}

        <p className="mt-6 text-center text-sm font-semibold text-slate-500">
          <Link href="/dashboard" className="text-teal-700 underline">
            {t("sub.plans_back")}
          </Link>
        </p>
      </ProMain>
    </ProPageShell>
  );
}
