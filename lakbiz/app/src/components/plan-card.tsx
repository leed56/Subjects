"use client";

import { formatLkrPrice, getPlan, planPrice, type PlanDefinition } from "@/lib/subscription/plans";
import type { BillingCycle, PlanId } from "@/lib/subscription/types";
import { useLocale } from "@/lib/i18n/locale-provider";

interface PlanCardProps {
  plan: PlanDefinition;
  cycle: BillingCycle;
  currentPlanId: PlanId;
  onSelect: (planId: PlanId) => void;
}

const FEATURE_KEYS = [
  "stock",
  "sales",
  "customers",
  "suppliers",
  "banking",
  "ac_jobs",
  "vehicles",
] as const;

export function PlanCard({
  plan,
  cycle,
  currentPlanId,
  onSelect,
}: PlanCardProps) {
  const { t, locale } = useLocale();
  const isCurrent = plan.id === currentPlanId;
  const price = planPrice(plan, cycle);

  return (
    <div
      className={`rounded-xl border p-5 ${
        plan.highlight
          ? "border-teal-600 bg-teal-50 shadow-md"
          : "border-slate-200 bg-white"
      }`}
    >
      {plan.highlight && (
        <span className="mb-2 inline-block rounded-full bg-teal-700 px-2 py-0.5 text-xs text-white">
          {t("sub.popular")}
        </span>
      )}
      <h3 className="text-lg font-bold text-slate-900">
        {locale === "si" ? plan.nameSi : plan.nameEn}
      </h3>
      <p className="mt-1 text-2xl font-bold text-teal-800">
        {formatLkrPrice(price)}
        <span className="text-sm font-normal text-slate-500">
          /{cycle === "annual" ? t("sub.year") : t("sub.month")}
        </span>
      </p>
      {cycle === "annual" && (
        <p className="text-xs text-teal-700">{t("sub.annual_save")}</p>
      )}
      <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
        <li>
          {plan.maxUsers} {t("sub.users")}
          {plan.maxBranches > 1 && ` · ${plan.maxBranches} ${t("sub.branches")}`}
        </li>
        {plan.maxProducts != null ? (
          <li>{t("sub.products_cap")} {plan.maxProducts}</li>
        ) : (
          <li>{t("sub.unlimited_products")}</li>
        )}
        {FEATURE_KEYS.map((key) => {
          const enabled = plan.features[key === "sales" ? "sales" : key];
          if (key === "stock") {
            return (
              <li key={key} className={enabled ? "" : "text-slate-400 line-through"}>
                {t("nav.stock")} + {t("nav.sales")}
              </li>
            );
          }
          if (key === "sales") return null;
          const label =
            key === "customers"
              ? t("nav.customers")
              : key === "suppliers"
                ? t("nav.suppliers")
                : key === "banking"
                  ? t("nav.banking")
                  : key === "ac_jobs"
                    ? t("nav.jobs")
                    : t("nav.vehicles");
          return (
            <li
              key={key}
              className={enabled ? "" : "text-slate-400 line-through"}
            >
              {label}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => onSelect(plan.id)}
        disabled={isCurrent}
        className={`mt-5 w-full rounded-lg py-2.5 text-sm font-medium ${
          isCurrent
            ? "cursor-default bg-slate-100 text-slate-500"
            : plan.highlight
              ? "bg-teal-700 text-white hover:bg-teal-800"
              : "border border-teal-700 text-teal-700 hover:bg-teal-50"
        }`}
      >
        {isCurrent ? t("sub.current_plan") : t("sub.select_plan")}
      </button>
    </div>
  );
}
