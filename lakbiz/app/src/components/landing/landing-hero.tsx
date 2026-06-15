"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PLANS } from "@/lib/subscription/plans";

export function LandingHero() {
  const { t } = useLocale();
  const business = PLANS.find((p) => p.id === "business")!;

  return (
    <section className="relative overflow-hidden lak-mesh lak-grain pt-28 pb-20 sm:pt-36 sm:pb-28">
      <div className="pointer-events-none absolute -right-20 top-20 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 bottom-10 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full lak-glass px-4 py-1.5 text-xs font-medium text-teal-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              {t("home.badge")}
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
              {t("home.hero")}
            </h1>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-teal-100/90 sm:text-xl">
              {t("home.tagline")}
            </p>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-300/90 sm:text-base">
              {t("home.desc")}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-teal-900 shadow-xl shadow-black/20 transition hover:bg-teal-50 active:scale-[0.98]"
              >
                {t("home.cta_free")}
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
              >
                {t("nav.demo")}
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-4">
              {[
                { val: "14", label: t("home.stat_trial") },
                { val: `Rs.${(business.priceMonthlyLkr / 1000).toFixed(1)}k`, label: t("home.stat_from") },
                { val: "2", label: t("home.stat_langs") },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl lak-glass px-3 py-4 text-center sm:px-4"
                >
                  <p className="text-xl font-bold text-white sm:text-2xl">{s.val}</p>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-200/70 sm:text-xs">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Preview card — desktop + mobile */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="lak-float rounded-3xl border border-white/10 bg-slate-900/40 p-1 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="rounded-[1.35rem] bg-slate-950/80 p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    {t("nav.dashboard")}
                  </span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    Live
                  </span>
                </div>
                <p className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Rs. 48,250
                </p>
                <p className="text-sm text-teal-300/80">{t("dash.today_sales")}</p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  {[
                    { label: t("dash.today_profit"), val: "Rs. 12,400", up: true },
                    { label: t("dash.credit_out"), val: "Rs. 86,000", up: false },
                    { label: t("dash.low_stock"), val: "3", up: false },
                    { label: t("dash.cheques_due"), val: "2", up: false },
                  ].map((k) => (
                    <div
                      key={k.label}
                      className="rounded-xl border border-white/5 bg-white/5 px-3 py-3"
                    >
                      <p className="text-[10px] font-medium text-slate-400 sm:text-xs">
                        {k.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white sm:text-base">
                        {k.val}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-teal-500 to-emerald-400" />
                  </div>
                  <span className="text-[10px] text-slate-500">72%</span>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -left-4 hidden rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-200 backdrop-blur sm:block">
              ✓ {t("home.whatsapp_ready")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
