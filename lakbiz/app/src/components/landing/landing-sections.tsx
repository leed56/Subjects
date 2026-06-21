"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";

const FEATURE_KEYS = [
  { icon: "📦", titleKey: "home.feat_stock", descKey: "home.feat_stock_d" },
  { icon: "🧾", titleKey: "home.feat_sales", descKey: "home.feat_sales_d" },
  { icon: "🏦", titleKey: "home.feat_bank", descKey: "home.feat_bank_d" },
  { icon: "📱", titleKey: "home.feat_wa", descKey: "home.feat_wa_d" },
  { icon: "👥", titleKey: "home.feat_roles", descKey: "home.feat_roles_d" },
  { icon: "🇱🇰", titleKey: "home.feat_si", descKey: "home.feat_si_d" },
] as const;

export function LandingFeatures() {
  const { t } = useLocale();

  return (
    <section id="features" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">
            {t("home.features_eyebrow")}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t("home.features_title")}
          </h2>
          <p className="mt-3 text-base text-slate-600 sm:text-lg">
            {t("home.features_desc")}
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {FEATURE_KEYS.map((f) => (
            <div
              key={f.titleKey}
              className="group rounded-2xl border border-slate-100 bg-slate-50/50 p-6 transition hover:border-teal-200 hover:bg-white hover:shadow-lg hover:shadow-teal-900/5"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl shadow-sm ring-1 ring-slate-100 transition group-hover:scale-105">
                {f.icon}
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                {t(f.titleKey)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {t(f.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingCta() {
  const { t } = useLocale();

  return (
    <section className="border-t border-slate-100 bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl lak-mesh px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="relative">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              {t("home.cta_title")}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-teal-100/90 sm:text-base">
              {t("home.cta_sub")}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/login"
                className="rounded-2xl bg-white px-8 py-3.5 text-sm font-bold text-teal-900 shadow-lg transition hover:bg-teal-50"
              >
                {t("home.cta_free")}
              </Link>
              <Link
                href="/settings/plans"
                className="rounded-2xl border border-white/30 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {t("home.cta_plans")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MobileStickyCta() {
  const { t } = useLocale();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-xl safe-area-pb sm:hidden">
      <div className="mx-auto flex max-w-lg gap-2">
        <Link
          href="/login"
          className="flex flex-1 items-center justify-center rounded-xl bg-teal-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/25"
        >
          {t("home.cta_free")}
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3.5 text-sm font-medium text-slate-700"
        >
          {t("nav.demo")}
        </Link>
      </div>
    </div>
  );
}

export function LandingFooter() {
  const { t } = useLocale();

  return (
    <footer className="border-t border-slate-200 bg-white py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center sm:flex-row sm:px-6 sm:text-left">
        <div>
          <p className="font-bold text-slate-900">LakBiz</p>
          <p className="mt-1 text-xs text-slate-500">{t("common.brand_tagline")}</p>
        </div>
        <p className="text-xs text-slate-400">{t("home.footer")}</p>
      </div>
    </footer>
  );
}
