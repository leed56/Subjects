"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";

const featureIcons = ["POS", "VAT", "BANK", "PRO"] as const;
const featureKeys = [
  { title: "home.mkt.feat1_title", desc: "home.mkt.feat1_desc" },
  { title: "home.mkt.feat2_title", desc: "home.mkt.feat2_desc" },
  { title: "home.mkt.feat3_title", desc: "home.mkt.feat3_desc" },
  { title: "home.mkt.feat4_title", desc: "home.mkt.feat4_desc" },
] as const;

const sectorKeys = [
  "home.mkt.sector_1",
  "home.mkt.sector_2",
  "home.mkt.sector_3",
  "home.mkt.sector_4",
  "home.mkt.sector_5",
  "home.mkt.sector_6",
  "home.mkt.sector_7",
  "home.mkt.sector_8",
] as const;

const stepKeys = [
  "home.mkt.step_1",
  "home.mkt.step_2",
  "home.mkt.step_3",
  "home.mkt.step_4",
] as const;

const planKeys = [
  {
    name: "home.mkt.plan_starter_name",
    price: "home.mkt.plan_starter_price",
    detail: "home.mkt.plan_starter_detail",
  },
  {
    name: "home.mkt.plan_business_name",
    price: "home.mkt.plan_business_price",
    detail: "home.mkt.plan_business_detail",
  },
  {
    name: "home.mkt.plan_pro_name",
    price: "home.mkt.plan_pro_price",
    detail: "home.mkt.plan_pro_detail",
  },
] as const;

const previewNavKeys = [
  "nav.dashboard",
  "nav.sales",
  "nav.stock",
  "nav.customers",
  "nav.bills",
  "nav.vat",
] as const;

export function MarketingHomePage() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="min-h-screen overflow-hidden bg-slate-50 text-slate-950">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/70 bg-white/85 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-700 text-sm font-black text-white shadow-lg shadow-teal-700/20">
              L
            </span>
            <div className="leading-tight">
              <span className="block text-xl font-black tracking-tight text-teal-700">LakBiz</span>
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:block">
                {t("home.mkt.region")}
              </span>
            </div>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#features" className="transition hover:text-teal-700">
              {t("home.mkt.nav.features")}
            </a>
            <a href="#solutions" className="transition hover:text-teal-700">
              {t("home.mkt.nav.solutions")}
            </a>
            <a href="#plans" className="transition hover:text-teal-700">
              {t("home.mkt.nav.plans")}
            </a>
            <a href="#contact" className="transition hover:text-teal-700">
              {t("home.mkt.nav.contact")}
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setLocale(locale === "si" ? "en" : "si")}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              aria-label="Toggle language"
            >
              {t("nav.lang")}
            </button>
            <Link
              href="/login"
              className="hidden text-sm font-semibold text-slate-600 transition hover:text-teal-700 sm:inline-flex"
            >
              {t("home.mkt.nav.sign_in")}
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center justify-center rounded-full bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700 sm:px-5 sm:text-sm"
            >
              {t("home.mkt.nav.request_access")}
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative pt-28 sm:pt-32 lg:pt-36">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[58rem] -translate-x-1/2 rounded-full bg-teal-200/40 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
              <div className="text-center lg:text-left">
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-4 py-2 text-xs font-black text-teal-800 shadow-sm lg:mx-0">
                  {t("home.mkt.badge")}
                </div>
                <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl lg:leading-[1.02]">
                  {t("home.mkt.hero_title")}
                </h1>
                <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg lg:mx-0">
                  {t("home.mkt.hero_desc")}
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-2xl bg-teal-600 px-7 py-4 text-sm font-black text-white shadow-xl shadow-teal-700/20 transition hover:-translate-y-0.5 hover:bg-teal-700"
                  >
                    {t("home.mkt.cta_sign_in")} <span className="ml-2">→</span>
                  </Link>
                  <a
                    href="#contact"
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-7 py-4 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-800"
                  >
                    {t("home.mkt.cta_request_access")}
                  </a>
                </div>
                <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500 lg:justify-start">
                  <span>{t("home.mkt.trust_pay")}</span>
                  <span>{t("home.mkt.trust_admin")}</span>
                  <span>{t("home.mkt.trust_no_signup")}</span>
                </div>
              </div>
              <ProductPreview t={t} />
            </div>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stepKeys.map((key, index) => (
              <div
                key={key}
                className="rounded-[1.5rem] border border-white bg-white p-5 shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/60"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-sm font-black text-teal-700">
                  {index + 1}
                </div>
                <p className="mt-4 text-sm font-black text-slate-900">{t(key)}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">
              {t("home.mkt.features_eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {t("home.mkt.features_title")}
            </h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {featureKeys.map((feature, index) => (
              <div
                key={feature.title}
                className="rounded-[1.75rem] border border-white bg-white p-6 shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/60"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-xs font-black text-teal-300">
                  {featureIcons[index]}
                </div>
                <h3 className="mt-5 text-lg font-black text-slate-950">{t(feature.title)}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{t(feature.desc)}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="solutions" className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/20 sm:p-10">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-300">
              {t("home.mkt.sectors_eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              {t("home.mkt.sectors_title")}
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {sectorKeys.map((key) => (
                <div
                  key={key}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200"
                >
                  {t(key)}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="plans" className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">
              {t("home.mkt.plans_eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {t("home.mkt.plans_title")}
            </h2>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">
              {t("home.mkt.plans_desc")}
            </p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {planKeys.map((plan) => (
              <div
                key={plan.name}
                className="rounded-[1.75rem] border border-white bg-white p-6 shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/60"
              >
                <h3 className="text-xl font-black text-slate-950">{t(plan.name)}</h3>
                <p className="mt-3 text-2xl font-black text-teal-700">{t(plan.price)}</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{t(plan.detail)}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="mx-auto my-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] bg-gradient-to-br from-teal-600 to-emerald-700 p-8 text-white shadow-2xl shadow-teal-900/20 sm:p-12">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-100">
                {t("home.mkt.contact_eyebrow")}
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                {t("home.mkt.contact_title")}
              </h2>
              <p className="mt-4 text-base font-semibold leading-7 text-teal-50">
                {t("home.mkt.contact_desc")}
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 text-sm font-black text-teal-800 shadow-xl shadow-teal-950/10"
              >
                {t("home.mkt.contact_sign_in")}
              </Link>
              <Link
                href="/login?next=/admin"
                className="inline-flex items-center justify-center rounded-2xl border border-white/30 px-7 py-4 text-sm font-black text-white hover:bg-white/10"
              >
                {t("home.mkt.contact_admin")}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function ProductPreview({ t }: { t: (key: string) => string }) {
  const statCards = [
    {
      label: t("home.mkt.preview_today_sales"),
      value: "Rs. 45,680",
      hint: t("home.mkt.preview_live"),
    },
    {
      label: t("home.mkt.preview_profit"),
      value: "Rs. 12,340",
      hint: t("home.mkt.preview_tracked"),
    },
    {
      label: t("home.mkt.preview_bills"),
      value: "32",
      hint: t("home.mkt.preview_ready"),
    },
    {
      label: t("home.mkt.preview_cash"),
      value: "Rs. 128,750",
      hint: t("home.mkt.preview_available"),
    },
  ];

  return (
    <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
      <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-teal-400/20 via-white to-amber-300/20 blur-2xl" />
      <div className="relative rounded-[2rem] border border-white bg-white/80 p-3 shadow-2xl shadow-slate-950/10 backdrop-blur-xl">
        <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950">
          <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900 px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="ml-3 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-slate-300">
              lakbiz.app/dashboard
            </span>
          </div>
          <div className="grid min-h-[25rem] grid-cols-[5.5rem_1fr] bg-slate-50 sm:grid-cols-[10rem_1fr]">
            <aside className="bg-slate-950 p-3 text-white sm:p-4">
              <p className="mb-5 text-sm font-black text-teal-300 sm:text-lg">LakBiz</p>
              {previewNavKeys.map((key, index) => (
                <div
                  key={key}
                  className={`mb-2 rounded-xl px-2 py-2 text-[9px] font-bold sm:px-3 sm:text-xs ${
                    index === 0 ? "bg-teal-500 text-white" : "text-slate-400"
                  }`}
                >
                  {t(key)}
                </div>
              ))}
            </aside>
            <div className="p-3 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="hidden h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-400 sm:flex sm:items-center">
                  {t("home.mkt.preview_search")}
                </div>
                <div className="ml-auto flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm">
                  <span className="h-7 w-7 rounded-full bg-gradient-to-br from-teal-100 to-emerald-100" />
                  <span className="hidden text-xs font-bold sm:block">{t("home.mkt.preview_shop")}</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {statCards.map((card) => (
                  <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-500">{card.label}</p>
                    <p className="mt-1 text-sm font-black text-slate-950 sm:text-base">{card.value}</p>
                    <p className="mt-1 text-[9px] font-semibold text-teal-600">{card.hint}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_0.8fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-slate-900">{t("home.mkt.preview_analytics")}</p>
                    <span className="rounded-full border border-slate-200 px-2 py-1 text-[9px] font-bold text-slate-500">
                      {t("home.mkt.preview_this_week")}
                    </span>
                  </div>
                  <div className="mt-6 flex h-32 items-end gap-2 sm:h-40">
                    {[35, 58, 46, 50, 66, 92, 52].map((height, index) => (
                      <div key={index} className="flex flex-1 flex-col items-center gap-2">
                        <div
                          className="w-full rounded-t-xl bg-gradient-to-t from-teal-100 to-teal-500"
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-[8px] font-semibold text-slate-400">
                          {["M", "T", "W", "T", "F", "S", "S"][index]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <MiniPanel
                    title={t("home.mkt.preview_low_stock")}
                    value={t("home.mkt.preview_low_stock_val")}
                    hint={t("home.mkt.preview_low_stock_hint")}
                  />
                  <MiniPanel
                    title={t("home.mkt.preview_receivables")}
                    value={t("home.mkt.preview_receivables_val")}
                    hint={t("home.mkt.preview_receivables_hint")}
                  />
                  <MiniPanel
                    title={t("home.mkt.preview_vat")}
                    value={t("home.mkt.preview_vat_val")}
                    hint={t("home.mkt.preview_vat_hint")}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniPanel({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-sm font-black text-slate-950">{value}</p>
      <p className="mt-1 text-[10px] font-semibold text-slate-500">{hint}</p>
    </div>
  );
}
