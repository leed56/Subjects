"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/locale-provider";
import { PLANS, formatLkrPrice } from "@/lib/subscription/plans";
import { sectors } from "@/lib/sectors";
import { SectorIcon } from "@/components/sector-icon";
import {
  SalesIcon,
  StockIcon,
  BillsIcon,
  VatIcon,
  BankingIcon,
  CustomersIcon,
  JobsIcon,
  LanguageIcon,
  UsersIcon,
  SyncIcon,
  ShieldIcon,
  LayersIcon,
} from "@/components/ui/icons";

const featureKeys = [
  { title: "home.mkt.feat1_title", desc: "home.mkt.feat1_desc", Icon: SalesIcon },
  { title: "home.mkt.feat2_title", desc: "home.mkt.feat2_desc", Icon: StockIcon },
  { title: "home.mkt.feat3_title", desc: "home.mkt.feat3_desc", Icon: BillsIcon },
  { title: "home.mkt.feat4_title", desc: "home.mkt.feat4_desc", Icon: VatIcon },
  { title: "home.mkt.feat5_title", desc: "home.mkt.feat5_desc", Icon: BankingIcon },
  { title: "home.mkt.feat6_title", desc: "home.mkt.feat6_desc", Icon: CustomersIcon },
  { title: "home.mkt.feat7_title", desc: "home.mkt.feat7_desc", Icon: JobsIcon },
] as const;

const capabilityKeys = [
  { key: "home.mkt.capability_bilingual", Icon: LanguageIcon },
  { key: "home.mkt.capability_roles", Icon: UsersIcon },
  { key: "home.mkt.capability_offline", Icon: SyncIcon },
  { key: "home.mkt.capability_secure", Icon: ShieldIcon },
  { key: "home.mkt.capability_branches", Icon: LayersIcon },
] as const;

const stepKeys = [
  "home.mkt.step_1",
  "home.mkt.step_2",
  "home.mkt.step_3",
  "home.mkt.step_4",
] as const;

const PLAN_DETAIL_KEY: Record<string, string> = {
  starter: "home.mkt.plan_starter_detail",
  business: "home.mkt.plan_business_detail",
  pro: "home.mkt.plan_pro_detail",
};

const PLAN_FEATURE_ROWS: { flag: keyof (typeof PLANS)[number]["features"]; labelKey: string }[] = [
  { flag: "sales", labelKey: "nav.sales" },
  { flag: "stock", labelKey: "nav.stock" },
  { flag: "bills", labelKey: "nav.bills" },
  { flag: "customers", labelKey: "nav.customers" },
  { flag: "suppliers", labelKey: "nav.suppliers" },
  { flag: "banking", labelKey: "nav.banking" },
  { flag: "ac_jobs", labelKey: "nav.jobs" },
  { flag: "vehicles", labelKey: "nav.vehicles" },
  { flag: "export", labelKey: "home.mkt.plan_feature_export" },
  { flag: "offline", labelKey: "home.mkt.plan_feature_offline" },
  { flag: "bulk_messaging", labelKey: "home.mkt.plan_feature_bulk_messaging" },
];

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
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen overflow-hidden bg-white text-slate-950">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-sm font-bold text-white shadow-sm shadow-teal-950/20">
              L
            </span>
            <div className="leading-tight">
              <span className="block text-xl font-bold tracking-[-0.03em] text-slate-950">LakBiz</span>
              <span className="hidden text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:block">
                {t("home.mkt.region")}
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-500 lg:flex">
            <a href="#features" className="transition hover:text-slate-950">{t("home.mkt.nav.features")}</a>
            <a href="#industries" className="transition hover:text-slate-950">{t("home.mkt.nav.industries")}</a>
            <a href="#plans" className="transition hover:text-slate-950">{t("home.mkt.nav.plans")}</a>
            <a href="#contact" className="transition hover:text-slate-950">{t("home.mkt.nav.contact")}</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setLocale(locale === "si" ? "en" : "si")}
              className="min-h-10 rounded-full border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
              aria-label="Toggle language"
            >
              {t("nav.lang")}
            </button>
            <Link
              href="/login"
              className="hidden min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 sm:inline-flex"
            >
              {t("home.mkt.nav.sign_in")}
            </Link>
            <a
              href="#contact"
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700 sm:px-5 sm:text-sm"
            >
              {t("home.mkt.nav.book_demo")}
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden pt-32 sm:pt-36 lg:pt-40">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[44rem] bg-[radial-gradient(circle_at_72%_18%,rgba(45,212,191,0.16),transparent_30%),radial-gradient(circle_at_22%_10%,rgba(20,184,166,0.08),transparent_28%)]" />
          <div className="pointer-events-none absolute right-[-10rem] top-24 h-[30rem] w-[30rem] rounded-full border border-teal-100/70" />
          <div className="pointer-events-none absolute right-[-4rem] top-40 h-[22rem] w-[22rem] rounded-full border border-teal-100/70" />

          <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="grid items-center gap-14 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16">
              <div className="max-w-2xl text-center lg:text-left">
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/80 px-4 py-2 text-xs font-bold text-teal-800 lg:mx-0">
                  <span className="h-2 w-2 rounded-full bg-teal-500" />
                  {t("home.mkt.badge")}
                </div>

                <h1 className="mt-7 text-4xl font-bold leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[4.6rem]">
                  {t("home.mkt.hero_title")}
                </h1>
                <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-slate-500 sm:text-lg lg:mx-0">
                  {t("home.mkt.hero_desc")}
                </p>

                <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                  <Link
                    href="/login"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl bg-teal-600 px-7 text-sm font-bold text-white shadow-lg shadow-teal-950/15 transition hover:bg-teal-700"
                  >
                    {t("home.mkt.cta_sign_in")} <span className="ml-2">→</span>
                  </Link>
                  <a
                    href="#contact"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-7 text-sm font-bold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    {t("home.mkt.cta_request_access")}
                  </a>
                </div>

                <div className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2.5 text-xs font-semibold text-slate-500 lg:justify-start">
                  {["home.mkt.trust_pay", "home.mkt.trust_admin", "home.mkt.trust_no_signup"].map((key) => (
                    <span key={key} className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-50 text-[9px] text-teal-700">✓</span>
                      {t(key)}
                    </span>
                  ))}
                </div>
              </div>

              <ProductPreview t={t} />
            </div>

            <div className="relative z-10 mt-16 rounded-2xl border border-slate-200/80 bg-white/95 px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7 lg:mt-20">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0">
                {capabilityKeys.map(({ key, Icon }, index) => (
                  <div
                    key={key}
                    className={`flex items-center gap-3 lg:px-5 ${index > 0 ? "lg:border-l lg:border-slate-100" : ""}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold leading-5 text-slate-700">{t(key)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 lg:px-10 lg:py-24">
          <div className="grid gap-8 border-y border-slate-100 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {stepKeys.map((key, index) => (
              <div key={key} className={`relative lg:px-8 ${index === 0 ? "lg:pl-0" : "lg:border-l lg:border-slate-100"}`}>
                <span className="text-4xl font-bold tracking-[-0.05em] text-teal-100">0{index + 1}</span>
                <p className="mt-3 max-w-[15rem] text-sm font-semibold leading-6 text-slate-800">{t(key)}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="scroll-mt-24 bg-[#f6f8fb] py-24 lg:py-28">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">{t("home.mkt.features_eyebrow")}</p>
              <h2 className="mt-4 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl lg:text-5xl">
                {t("home.mkt.features_title")}
              </h2>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {featureKeys.map(({ title, desc, Icon }, index) => {
                const featured = index === 0;
                const wide = index === 1 || index === 4;
                return (
                  <article
                    key={title}
                    className={`group relative overflow-hidden rounded-[1.4rem] border p-6 transition duration-300 sm:p-7 ${
                      featured
                        ? "border-slate-900 bg-slate-950 text-white md:col-span-2 lg:col-span-2 lg:row-span-2 lg:p-9"
                        : wide
                          ? "border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)] lg:col-span-2"
                          : "border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
                    }`}
                  >
                    {featured && (
                      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-teal-400/15 blur-3xl" />
                    )}
                    <div className={`relative flex h-12 w-12 items-center justify-center rounded-xl ${featured ? "bg-teal-400/15 text-teal-300" : "bg-teal-50 text-teal-700"}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className={`relative mt-6 font-bold tracking-tight ${featured ? "text-2xl text-white lg:text-3xl" : "text-lg text-slate-950"}`}>
                      {t(title)}
                    </h3>
                    <p className={`relative mt-3 max-w-xl text-sm font-medium leading-7 ${featured ? "text-slate-300" : "text-slate-500"}`}>
                      {t(desc)}
                    </p>
                    {featured && (
                      <div className="relative mt-10 grid grid-cols-3 gap-3">
                        {["Sales", "Stock", "VAT"].map((label) => (
                          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4">
                            <div className="h-1.5 w-10 rounded-full bg-teal-400" />
                            <p className="mt-3 text-xs font-semibold text-slate-300">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="industries" className="scroll-mt-24 py-24 lg:py-28">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="overflow-hidden rounded-[2rem] bg-[#08111f] px-5 py-10 text-white shadow-[0_30px_80px_rgba(8,17,31,0.18)] sm:px-8 sm:py-12 lg:px-12 lg:py-14">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-300">{t("home.mkt.industries_eyebrow")}</p>
                  <h2 className="mt-4 text-3xl font-bold tracking-[-0.035em] sm:text-4xl lg:text-5xl">{t("home.mkt.industries_title")}</h2>
                </div>
                <p className="max-w-xl text-sm font-medium leading-7 text-slate-400">{t("home.mkt.industries_desc")}</p>
              </div>

              <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sectors.map((sector) => (
                  <article
                    key={sector.id}
                    className="group rounded-2xl border border-white/[0.08] bg-white/[0.035] p-6 transition hover:border-teal-300/20 hover:bg-white/[0.055]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-400/10 text-teal-300 ring-1 ring-inset ring-teal-300/10">
                        <SectorIcon sectorId={sector.id} className="h-5 w-5" />
                      </span>
                      <span className="text-slate-600 transition group-hover:text-teal-300">↗</span>
                    </div>
                    <h3 className="mt-6 text-lg font-bold tracking-tight text-white">
                      {locale === "si" ? sector.nameSi : sector.nameEn}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{sector.description}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {sector.reports.slice(0, 2).map((report) => (
                        <span key={report} className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                          {report}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="plans" className="scroll-mt-24 bg-[#f6f8fb] py-24 lg:py-28">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">{t("home.mkt.plans_eyebrow")}</p>
              <h2 className="mt-4 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl lg:text-5xl">{t("home.mkt.plans_title")}</h2>
              <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-slate-500">{t("home.mkt.plans_desc")}</p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {PLANS.map((plan) => {
                const planName = locale === "si" ? plan.nameSi : plan.nameEn;
                const enabledRows = PLAN_FEATURE_ROWS.filter((row) => plan.features[row.flag]);
                return (
                  <article
                    key={plan.id}
                    className={`relative flex flex-col rounded-[1.6rem] border bg-white p-7 sm:p-8 ${
                      plan.highlight
                        ? "border-teal-300 shadow-[0_24px_60px_rgba(13,148,136,0.12)] ring-1 ring-teal-100"
                        : "border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.035)]"
                    }`}
                  >
                    {plan.highlight && (
                      <span className="absolute -top-3.5 left-7 rounded-full bg-teal-600 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-sm">
                        {t("home.mkt.plan_recommended")}
                      </span>
                    )}
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-slate-950">{planName}</h3>
                      <p className="mt-4 text-4xl font-bold tracking-[-0.04em] text-slate-950">
                        {formatLkrPrice(plan.priceMonthlyLkr)}
                        <span className="ml-1 text-sm font-semibold tracking-normal text-slate-400">/{t("sub.month")}</span>
                      </p>
                      <p className="mt-4 min-h-12 text-sm font-medium leading-6 text-slate-500">{t(PLAN_DETAIL_KEY[plan.id] ?? "")}</p>
                      <p className="mt-3 text-xs font-medium text-slate-400">
                        {t("home.mkt.plan_users").replace("{n}", String(plan.maxUsers))} · {t("home.mkt.plan_branches").replace("{n}", String(plan.maxBranches))}
                      </p>
                    </div>

                    <div className="mt-7 border-t border-slate-100 pt-6">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t("home.mkt.plan_includes")}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {enabledRows.map((row) => (
                          <span key={row.flag} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-100">
                            <CheckBadge />
                            {t(row.labelKey)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <a
                      href="#contact"
                      className={`mt-8 inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold transition ${
                        plan.highlight
                          ? "bg-teal-600 text-white shadow-sm shadow-teal-950/15 hover:bg-teal-700"
                          : "border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {t("home.mkt.plan_cta").replace("{plan}", planName)}
                    </a>
                  </article>
                );
              })}
            </div>
            <p className="mt-6 text-xs leading-5 text-slate-400">{t("home.mkt.plans_footnote")}</p>
          </div>
        </section>

        <section id="contact" className="scroll-mt-24 py-24 lg:py-28">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-600 via-teal-700 to-slate-950 px-6 py-12 text-white shadow-[0_30px_80px_rgba(13,148,136,0.16)] sm:px-10 lg:px-14 lg:py-16">
              <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -right-8 -top-6 h-56 w-56 rounded-full border border-white/10" />
              <div className="relative flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-100">{t("home.mkt.contact_eyebrow")}</p>
                  <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em] sm:text-4xl lg:text-5xl">{t("home.mkt.contact_title")}</h2>
                  <p className="mt-5 max-w-2xl text-sm font-medium leading-7 text-teal-50/80">{t("home.mkt.contact_desc")}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                  <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-7 text-sm font-bold text-teal-900 shadow-lg shadow-slate-950/10 transition hover:bg-teal-50">
                    {t("home.mkt.contact_sign_in")}
                  </Link>
                  <Link href="/login?next=/admin" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-7 text-sm font-bold text-white transition hover:bg-white/[0.1]">
                    {t("home.mkt.contact_admin")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#08111f] text-slate-300">
        <div className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-10 lg:py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-sm font-bold text-white">L</span>
                <span className="text-lg font-bold tracking-tight text-white">LakBiz</span>
              </div>
              <p className="mt-5 max-w-xs text-sm leading-6 text-slate-500">{t("home.mkt.footer_tagline")}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">{t("home.mkt.footer_product_heading")}</p>
              <div className="mt-5 flex flex-col gap-3 text-sm font-medium text-slate-400">
                <a href="#features" className="transition hover:text-white">{t("home.mkt.nav.features")}</a>
                <a href="#industries" className="transition hover:text-white">{t("home.mkt.nav.industries")}</a>
                <a href="#plans" className="transition hover:text-white">{t("home.mkt.nav.plans")}</a>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">{t("home.mkt.footer_start_heading")}</p>
              <div className="mt-5 flex flex-col gap-3 text-sm font-medium text-slate-400">
                <Link href="/login" className="transition hover:text-white">{t("home.mkt.nav.sign_in")}</Link>
                <a href="#contact" className="transition hover:text-white">{t("home.mkt.nav.contact")}</a>
                <Link href="/login?next=/admin" className="transition hover:text-white">{t("home.mkt.contact_admin")}</Link>
              </div>
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-2 border-t border-white/[0.07] pt-6 text-xs font-medium text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>© {year} LakBiz. {t("home.mkt.footer_rights")}</span>
            <span>{t("home.mkt.region")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CheckBadge() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[9px] font-bold text-teal-700">✓</span>
  );
}

function ProductPreview({ t }: { t: (key: string) => string }) {
  const statCards = [
    { label: t("home.mkt.preview_today_sales"), value: "Rs. 45,680", hint: t("home.mkt.preview_live") },
    { label: t("home.mkt.preview_profit"), value: "Rs. 12,340", hint: t("home.mkt.preview_tracked") },
    { label: t("home.mkt.preview_bills"), value: "32", hint: t("home.mkt.preview_ready") },
    { label: t("home.mkt.preview_cash"), value: "Rs. 128,750", hint: t("home.mkt.preview_available") },
  ];

  return (
    <div className="relative mx-auto w-full max-w-3xl pb-12 lg:pb-16">
      <div className="absolute inset-x-10 bottom-5 h-20 rounded-full bg-teal-300/20 blur-3xl" />
      <div className="relative rounded-[1.7rem] border border-slate-200/90 bg-white p-2.5 shadow-[0_32px_90px_rgba(15,23,42,0.16)] sm:p-3">
        <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white">
          <div className="flex h-11 items-center gap-2 border-b border-slate-200 bg-slate-950 px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-3 hidden rounded-full bg-white/[0.07] px-3 py-1 text-[9px] font-medium text-slate-500 sm:block">lakbiz.app/dashboard</span>
          </div>

          <div className="grid min-h-[29rem] grid-cols-[5rem_1fr] bg-[#f7f9fc] sm:grid-cols-[9.5rem_1fr]">
            <aside className="bg-[#08111f] px-2.5 py-4 sm:px-3.5 sm:py-5">
              <p className="mb-5 px-2 text-xs font-bold tracking-tight text-teal-300 sm:text-base">LakBiz</p>
              {previewNavKeys.map((key, index) => (
                <div
                  key={key}
                  className={`mb-1.5 rounded-lg px-2 py-2 text-[8px] font-semibold sm:px-2.5 sm:text-[10px] ${
                    index === 0 ? "bg-teal-400/15 text-white" : "text-slate-600"
                  }`}
                >
                  {t(key)}
                </div>
              ))}
            </aside>

            <div className="min-w-0 p-3 sm:p-5 lg:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="hidden h-9 flex-1 items-center rounded-xl border border-slate-200 bg-white px-3 text-[10px] text-slate-400 shadow-sm sm:flex">
                  {t("home.mkt.preview_search")}
                </div>
                <div className="ml-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                  <span className="h-6 w-6 rounded-full bg-teal-100" />
                  <span className="hidden text-[10px] font-semibold text-slate-700 md:block">{t("home.mkt.preview_shop")}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {statCards.map((card) => (
                  <div key={card.label} className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
                    <p className="truncate text-[8px] font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
                    <p className="mt-1.5 truncate text-xs font-bold tracking-tight text-slate-950 sm:text-sm">{card.value}</p>
                    <p className="mt-1 text-[8px] font-semibold text-teal-600">{card.hint}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[1.45fr_0.72fr]">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-slate-800 sm:text-xs">{t("home.mkt.preview_analytics")}</p>
                    <span className="rounded-full bg-slate-50 px-2 py-1 text-[8px] font-semibold text-slate-400 ring-1 ring-inset ring-slate-100">{t("home.mkt.preview_this_week")}</span>
                  </div>
                  <div className="mt-5 h-40 sm:h-48">
                    <svg viewBox="0 0 500 190" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
                      <defs>
                        <linearGradient id="lakChartFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {[42, 84, 126, 168].map((y) => (
                        <line key={y} x1="0" x2="500" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                      ))}
                      <path d="M0 160 C55 142 72 118 122 126 C170 134 190 98 235 108 C288 120 302 70 355 84 C400 96 425 45 500 58 L500 190 L0 190 Z" fill="url(#lakChartFill)" />
                      <path d="M0 160 C55 142 72 118 122 126 C170 134 190 98 235 108 C288 120 302 70 355 84 C400 96 425 45 500 58" fill="none" stroke="#0d9488" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <div className="hidden space-y-3 md:block">
                  {[
                    ["LOW STOCK", "Cooking Oil 5L", "2 units left"],
                    ["RECEIVABLES", "Rs. 85,420", "Credit customers"],
                    ["VAT PAYABLE", "Rs. 9,500", "This quarter"],
                  ].map(([label, value, hint]) => (
                    <div key={label} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                      <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
                      <p className="mt-1.5 text-xs font-bold text-slate-900">{value}</p>
                      <p className="mt-1 text-[8px] text-slate-400">{hint}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-1 left-2 w-[8.5rem] rounded-[1.65rem] border-[5px] border-slate-950 bg-white p-2 shadow-[0_22px_60px_rgba(15,23,42,0.22)] sm:-left-5 sm:w-[10.5rem]">
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-200" />
        <p className="px-1 text-[9px] font-bold text-slate-950">LakBiz</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {statCards.slice(0, 4).map((card) => (
            <div key={card.label} className="rounded-lg bg-slate-50 p-2">
              <p className="truncate text-[6px] font-semibold text-slate-400">{card.label}</p>
              <p className="mt-0.5 truncate text-[8px] font-bold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 h-8 rounded-lg bg-teal-600" />
      </div>
    </div>
  );
}
