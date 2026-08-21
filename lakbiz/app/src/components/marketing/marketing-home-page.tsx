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

const previewNavKeys = ["nav.dashboard", "nav.sales", "nav.stock", "nav.customers", "nav.bills", "nav.vat"] as const;

export function MarketingHomePage() {
  const { locale, setLocale, t } = useLocale();
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen overflow-hidden bg-[#eef3f7] text-slate-950">
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="mx-auto flex h-16 max-w-[1380px] items-center justify-between rounded-2xl border border-white/10 bg-[#08111f]/92 px-4 shadow-[0_18px_50px_rgba(2,8,23,0.22)] backdrop-blur-xl sm:px-5 lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-black text-white shadow-lg shadow-teal-950/25">L</span>
            <div className="leading-tight">
              <span className="block text-base font-bold tracking-[-0.03em] text-white sm:text-lg">LakBiz</span>
              <span className="hidden text-[8px] font-bold uppercase tracking-[0.22em] text-slate-500 sm:block">{t("home.mkt.region")}</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-400 lg:flex">
            <a href="#features" className="transition hover:text-white">{t("home.mkt.nav.features")}</a>
            <a href="#industries" className="transition hover:text-white">{t("home.mkt.nav.industries")}</a>
            <a href="#plans" className="transition hover:text-white">{t("home.mkt.nav.plans")}</a>
            <a href="#contact" className="transition hover:text-white">{t("home.mkt.nav.contact")}</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocale(locale === "si" ? "en" : "si")}
              className="min-h-9 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.1] hover:text-white"
              aria-label="Toggle language"
            >
              {t("nav.lang")}
            </button>
            <Link href="/login" className="hidden min-h-9 items-center rounded-xl px-3.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white sm:inline-flex">
              {t("home.mkt.nav.sign_in")}
            </Link>
            <a href="#contact" className="inline-flex min-h-9 items-center justify-center rounded-xl bg-teal-500 px-4 text-xs font-bold text-[#041416] shadow-lg shadow-teal-950/25 transition hover:bg-teal-400 sm:text-sm">
              {t("home.mkt.nav.book_demo")}
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#07111f] pb-16 pt-28 text-white sm:pt-32 lg:pb-20 lg:pt-36">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_16%,rgba(45,212,191,0.16),transparent_31%),radial-gradient(circle_at_8%_15%,rgba(14,165,233,0.08),transparent_28%)]" />
          <div className="pointer-events-none absolute -right-20 top-28 h-[30rem] w-[30rem] rounded-full border border-white/[0.05]" />
          <div className="pointer-events-none absolute -right-2 top-48 h-[20rem] w-[20rem] rounded-full border border-teal-300/[0.08]" />

          <div className="relative mx-auto max-w-[1380px] px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-[0.83fr_1.17fr] lg:gap-14">
              <div className="max-w-2xl text-center lg:text-left">
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/[0.07] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-teal-200 lg:mx-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-300 shadow-[0_0_0_4px_rgba(94,234,212,0.08)]" />
                  {t("home.mkt.badge")}
                </div>

                <h1 className="mt-6 text-4xl font-bold leading-[0.98] tracking-[-0.05em] text-white sm:text-5xl lg:text-[4.35rem]">
                  {t("home.mkt.hero_title")}
                </h1>
                <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8 lg:mx-0">
                  {t("home.mkt.hero_desc")}
                </p>

                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                  <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-teal-400 px-7 text-sm font-bold text-[#04201f] shadow-[0_14px_35px_rgba(20,184,166,0.2)] transition hover:bg-teal-300">
                    {t("home.mkt.cta_sign_in")} <span className="ml-2">→</span>
                  </Link>
                  <a href="#contact" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-7 text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/[0.09]">
                    {t("home.mkt.cta_request_access")}
                  </a>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-medium text-slate-500 lg:justify-start">
                  {["home.mkt.trust_pay", "home.mkt.trust_admin", "home.mkt.trust_no_signup"].map((key) => (
                    <span key={key} className="flex items-center gap-2">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-400/10 text-[9px] text-teal-300">✓</span>
                      {t(key)}
                    </span>
                  ))}
                </div>
              </div>

              <ProductPreview t={t} />
            </div>

            <div className="mt-10 grid overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] sm:grid-cols-2 lg:mt-12 lg:grid-cols-5">
              {capabilityKeys.map(({ key, Icon }, index) => (
                <div key={key} className={`flex min-h-20 items-center gap-3 px-5 py-4 ${index > 0 ? "border-t border-white/[0.06] sm:border-l sm:border-t-0" : ""}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-400/10 text-teal-300 ring-1 ring-inset ring-teal-300/10">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-sm font-semibold leading-5 text-slate-300">{t(key)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 -mt-1 bg-[#0b1626] text-white">
          <div className="mx-auto max-w-[1380px] px-4 sm:px-6 lg:px-8">
            <div className="grid border-x border-white/[0.05] sm:grid-cols-2 lg:grid-cols-4">
              {stepKeys.map((key, index) => (
                <div key={key} className={`relative px-5 py-7 lg:px-7 ${index > 0 ? "border-t border-white/[0.06] sm:border-l sm:border-t-0" : ""}`}>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300/70">0{index + 1}</span>
                  <p className="mt-3 max-w-[16rem] text-sm font-semibold leading-6 text-slate-300">{t(key)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-24 bg-[#eef3f7] py-16 sm:py-18 lg:py-20">
          <div className="mx-auto max-w-[1380px] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-7 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-700">{t("home.mkt.features_eyebrow")}</p>
                <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl lg:text-[2.85rem]">{t("home.mkt.features_title")}</h2>
              </div>
              <div className="hidden h-px bg-gradient-to-r from-slate-300 to-transparent lg:block" />
            </div>

            <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {featureKeys.map(({ title, desc, Icon }, index) => {
                const featured = index === 0;
                const wide = index === 1 || index === 4;
                return (
                  <article
                    key={title}
                    className={`group relative overflow-hidden rounded-[1.5rem] border p-6 transition duration-300 ${
                      featured
                        ? "border-slate-900 bg-[#08111f] text-white shadow-[0_24px_65px_rgba(8,17,31,0.18)] md:col-span-2 lg:col-span-2 lg:row-span-2 lg:p-8"
                        : wide
                          ? "border-slate-200/80 bg-white shadow-[0_10px_32px_rgba(15,23,42,0.05)] lg:col-span-2"
                          : "border-slate-200/80 bg-white shadow-[0_10px_32px_rgba(15,23,42,0.05)]"
                    }`}
                  >
                    {featured && <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-teal-300/10 blur-3xl" />}
                    <div className={`relative flex h-11 w-11 items-center justify-center rounded-xl ${featured ? "bg-teal-300/10 text-teal-300 ring-1 ring-inset ring-teal-300/10" : "bg-teal-50 text-teal-700"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className={`relative mt-5 font-bold tracking-tight ${featured ? "text-2xl text-white lg:text-3xl" : "text-lg text-slate-950"}`}>{t(title)}</h3>
                    <p className={`relative mt-2.5 max-w-xl text-sm leading-6 ${featured ? "text-slate-400" : "text-slate-500"}`}>{t(desc)}</p>
                    {featured && (
                      <div className="relative mt-7 grid grid-cols-3 gap-2.5">
                        {["Sales", "Stock", "VAT"].map((label) => (
                          <div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 py-3.5">
                            <div className="h-1 w-8 rounded-full bg-teal-300" />
                            <p className="mt-2.5 text-[11px] font-semibold text-slate-400">{label}</p>
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

        <section id="industries" className="scroll-mt-24 bg-[#08111f] py-16 text-white sm:py-18 lg:py-20">
          <div className="mx-auto max-w-[1380px] px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-300">{t("home.mkt.industries_eyebrow")}</p>
                <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl lg:text-[2.85rem]">{t("home.mkt.industries_title")}</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-400">{t("home.mkt.industries_desc")}</p>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sectors.map((sector) => (
                <article key={sector.id} className="group rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 transition hover:border-teal-300/20 hover:bg-white/[0.055]">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-300/10 text-teal-300 ring-1 ring-inset ring-teal-300/10">
                      <SectorIcon sectorId={sector.id} className="h-5 w-5" />
                    </span>
                    <span className="text-slate-600 transition group-hover:text-teal-300">↗</span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold tracking-tight text-white">{locale === "si" ? sector.nameSi : sector.nameEn}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{sector.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {sector.reports.slice(0, 2).map((report) => (
                      <span key={report} className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold text-slate-500">{report}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="plans" className="scroll-mt-24 bg-[#e9eff4] py-16 sm:py-18 lg:py-20">
          <div className="mx-auto max-w-[1380px] px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
              <div className="max-w-3xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-700">{t("home.mkt.plans_eyebrow")}</p>
                <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl lg:text-[2.85rem]">{t("home.mkt.plans_title")}</h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-slate-500 lg:justify-self-end">{t("home.mkt.plans_desc")}</p>
            </div>

            <div className="mt-9 grid gap-4 lg:grid-cols-3">
              {PLANS.map((plan) => {
                const planName = locale === "si" ? plan.nameSi : plan.nameEn;
                const enabledRows = PLAN_FEATURE_ROWS.filter((row) => plan.features[row.flag]);
                const highlight = plan.highlight;
                return (
                  <article
                    key={plan.id}
                    className={`relative flex flex-col rounded-[1.5rem] border p-6 sm:p-7 ${
                      highlight
                        ? "border-teal-300/20 bg-[#08111f] text-white shadow-[0_26px_65px_rgba(8,17,31,0.22)]"
                        : "border-white/80 bg-white text-slate-950 shadow-[0_10px_32px_rgba(15,23,42,0.05)]"
                    }`}
                  >
                    {highlight && (
                      <span className="absolute -top-3 left-6 rounded-full bg-teal-400 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#06201e] shadow-lg shadow-teal-950/20">{t("home.mkt.plan_recommended")}</span>
                    )}
                    <div>
                      <h3 className={`text-xl font-bold tracking-tight ${highlight ? "text-white" : "text-slate-950"}`}>{planName}</h3>
                      <p className={`mt-3 text-4xl font-bold tracking-[-0.045em] ${highlight ? "text-white" : "text-slate-950"}`}>
                        {formatLkrPrice(plan.priceMonthlyLkr)}
                        <span className={`ml-1 text-sm font-semibold tracking-normal ${highlight ? "text-slate-500" : "text-slate-400"}`}>/{t("sub.month")}</span>
                      </p>
                      <p className={`mt-3 min-h-12 text-sm leading-6 ${highlight ? "text-slate-400" : "text-slate-500"}`}>{t(PLAN_DETAIL_KEY[plan.id] ?? "")}</p>
                      <p className={`mt-2 text-xs font-medium ${highlight ? "text-slate-500" : "text-slate-400"}`}>
                        {t("home.mkt.plan_users").replace("{n}", String(plan.maxUsers))} · {t("home.mkt.plan_branches").replace("{n}", String(plan.maxBranches))}
                      </p>
                    </div>

                    <div className={`mt-6 border-t pt-5 ${highlight ? "border-white/[0.08]" : "border-slate-100"}`}>
                      <p className={`text-[9px] font-bold uppercase tracking-[0.14em] ${highlight ? "text-slate-600" : "text-slate-400"}`}>{t("home.mkt.plan_includes")}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {enabledRows.map((row) => (
                          <span key={row.flag} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${highlight ? "bg-white/[0.05] text-slate-300 ring-1 ring-inset ring-white/[0.06]" : "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-100"}`}>
                            <CheckBadge dark={highlight} />
                            {t(row.labelKey)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <a href="#contact" className={`mt-7 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold transition ${highlight ? "bg-teal-400 text-[#05201e] shadow-lg shadow-teal-950/20 hover:bg-teal-300" : "border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"}`}>
                      {t("home.mkt.plan_cta").replace("{plan}", planName)}
                    </a>
                  </article>
                );
              })}
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-400">{t("home.mkt.plans_footnote")}</p>
          </div>
        </section>

        <section id="contact" className="scroll-mt-24 bg-[#e9eff4] pb-14 sm:pb-16 lg:pb-18">
          <div className="mx-auto max-w-[1380px] px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-teal-300/10 bg-[linear-gradient(115deg,#0d9488_0%,#087f76_42%,#08111f_100%)] px-6 py-10 text-white shadow-[0_28px_70px_rgba(8,17,31,0.16)] sm:px-9 lg:px-12 lg:py-12">
              <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -right-4 top-4 h-48 w-48 rounded-full border border-white/10" />
              <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-100">{t("home.mkt.contact_eyebrow")}</p>
                  <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl lg:text-[2.85rem]">{t("home.mkt.contact_title")}</h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-teal-50/75">{t("home.mkt.contact_desc")}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
                  <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-teal-900 shadow-lg shadow-slate-950/10 transition hover:bg-teal-50">{t("home.mkt.contact_sign_in")}</Link>
                  <Link href="/login?next=/admin" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-6 text-sm font-bold text-white transition hover:bg-white/[0.1]">{t("home.mkt.contact_admin")}</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#06101d] text-slate-300">
        <div className="mx-auto max-w-[1380px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-sm font-bold text-[#04201f]">L</span>
                <span className="text-lg font-bold tracking-tight text-white">LakBiz</span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">{t("home.mkt.footer_tagline")}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">{t("home.mkt.footer_product_heading")}</p>
              <div className="mt-4 flex flex-col gap-2.5 text-sm font-medium text-slate-400">
                <a href="#features" className="transition hover:text-white">{t("home.mkt.nav.features")}</a>
                <a href="#industries" className="transition hover:text-white">{t("home.mkt.nav.industries")}</a>
                <a href="#plans" className="transition hover:text-white">{t("home.mkt.nav.plans")}</a>
              </div>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">{t("home.mkt.footer_start_heading")}</p>
              <div className="mt-4 flex flex-col gap-2.5 text-sm font-medium text-slate-400">
                <Link href="/login" className="transition hover:text-white">{t("home.mkt.nav.sign_in")}</Link>
                <a href="#contact" className="transition hover:text-white">{t("home.mkt.nav.contact")}</a>
                <Link href="/login?next=/admin" className="transition hover:text-white">{t("home.mkt.contact_admin")}</Link>
              </div>
            </div>
          </div>
          <div className="mt-9 flex flex-col gap-2 border-t border-white/[0.07] pt-5 text-xs font-medium text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>© {year} LakBiz. {t("home.mkt.footer_rights")}</span>
            <span>{t("home.mkt.region")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CheckBadge({ dark = false }: { dark?: boolean }) {
  return <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${dark ? "bg-teal-300/15 text-teal-300" : "bg-teal-100 text-teal-700"}`}>✓</span>;
}

function ProductPreview({ t }: { t: (key: string) => string }) {
  const statCards = [
    { label: t("home.mkt.preview_today_sales"), value: "Rs. 45,680", hint: t("home.mkt.preview_live") },
    { label: t("home.mkt.preview_profit"), value: "Rs. 12,340", hint: t("home.mkt.preview_tracked") },
    { label: t("home.mkt.preview_bills"), value: "32", hint: t("home.mkt.preview_ready") },
    { label: t("home.mkt.preview_cash"), value: "Rs. 128,750", hint: t("home.mkt.preview_available") },
  ];

  return (
    <div className="relative mx-auto w-full max-w-3xl pb-9 lg:pb-11">
      <div className="absolute inset-x-12 bottom-4 h-16 rounded-full bg-teal-300/15 blur-3xl" />
      <div className="relative rounded-[1.65rem] border border-white/10 bg-white/[0.04] p-2.5 shadow-[0_34px_95px_rgba(0,0,0,0.38)] backdrop-blur sm:p-3">
        <div className="overflow-hidden rounded-[1.2rem] border border-slate-200 bg-white">
          <div className="flex h-10 items-center gap-2 border-b border-slate-800 bg-slate-950 px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-3 hidden rounded-full bg-white/[0.07] px-3 py-1 text-[9px] font-medium text-slate-500 sm:block">lakbiz.app/dashboard</span>
          </div>

          <div className="grid min-h-[26rem] grid-cols-[5rem_1fr] bg-[#f7f9fc] sm:grid-cols-[9.2rem_1fr]">
            <aside className="bg-[#08111f] px-2.5 py-4 sm:px-3.5 sm:py-5">
              <p className="mb-5 px-2 text-xs font-bold tracking-tight text-teal-300 sm:text-base">LakBiz</p>
              {previewNavKeys.map((key, index) => (
                <div key={key} className={`mb-1.5 rounded-lg px-2 py-2 text-[8px] font-semibold sm:px-2.5 sm:text-[10px] ${index === 0 ? "bg-teal-400/15 text-white" : "text-slate-600"}`}>
                  {t(key)}
                </div>
              ))}
            </aside>

            <div className="min-w-0 p-3 sm:p-5 lg:p-5">
              <div className="mb-3.5 flex items-center justify-between gap-3">
                <div className="hidden h-8 flex-1 items-center rounded-lg border border-slate-200 bg-white px-3 text-[10px] text-slate-400 sm:flex">{t("home.mkt.preview_search")}</div>
                <div className="ml-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                  <span className="h-5 w-5 rounded-full bg-teal-100" />
                  <span className="hidden text-[10px] font-semibold text-slate-700 md:block">{t("home.mkt.preview_shop")}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {statCards.map((card) => (
                  <div key={card.label} className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-sm">
                    <p className="truncate text-[7px] font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
                    <p className="mt-1 truncate text-xs font-bold tracking-tight text-slate-950 sm:text-sm">{card.value}</p>
                    <p className="mt-1 text-[7px] font-semibold text-teal-600">{card.hint}</p>
                  </div>
                ))}
              </div>

              <div className="mt-2.5 grid gap-2.5 md:grid-cols-[1.45fr_0.72fr]">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-slate-800 sm:text-xs">{t("home.mkt.preview_analytics")}</p>
                    <span className="rounded-full bg-slate-50 px-2 py-1 text-[8px] font-semibold text-slate-400 ring-1 ring-inset ring-slate-100">{t("home.mkt.preview_this_week")}</span>
                  </div>
                  <div className="mt-4 h-36 sm:h-44">
                    <svg viewBox="0 0 500 190" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
                      <defs><linearGradient id="lakChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity="0.22" /><stop offset="100%" stopColor="#14b8a6" stopOpacity="0" /></linearGradient></defs>
                      {[42, 84, 126, 168].map((y) => <line key={y} x1="0" x2="500" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />)}
                      <path d="M0 160 C55 142 72 118 122 126 C170 134 190 98 235 108 C288 120 302 70 355 84 C400 96 425 45 500 58 L500 190 L0 190 Z" fill="url(#lakChartFill)" />
                      <path d="M0 160 C55 142 72 118 122 126 C170 134 190 98 235 108 C288 120 302 70 355 84 C400 96 425 45 500 58" fill="none" stroke="#0d9488" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <div className="hidden space-y-2.5 md:block">
                  {[["LOW STOCK", "Cooking Oil 5L", "2 units left"], ["RECEIVABLES", "Rs. 85,420", "Credit customers"], ["VAT PAYABLE", "Rs. 9,500", "This quarter"]].map(([label, value, hint]) => (
                    <div key={label} className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
                      <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
                      <p className="mt-1 text-xs font-bold text-slate-900">{value}</p>
                      <p className="mt-1 text-[7px] text-slate-400">{hint}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-1 left-2 w-[8rem] rounded-[1.55rem] border-[4px] border-slate-950 bg-white p-2 shadow-[0_22px_60px_rgba(0,0,0,0.3)] sm:-left-4 sm:w-[9.8rem]">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" />
        <p className="px-1 text-[8px] font-bold text-slate-950">LakBiz</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {statCards.slice(0, 4).map((card) => (
            <div key={card.label} className="rounded-lg bg-slate-50 p-1.5">
              <p className="truncate text-[5px] font-semibold text-slate-400">{card.label}</p>
              <p className="mt-0.5 truncate text-[7px] font-bold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 h-7 rounded-lg bg-teal-600" />
      </div>
    </div>
  );
}
