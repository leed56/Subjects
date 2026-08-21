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

// Landing v2 — capability-row strip. Every item names a capability that is
// already implemented elsewhere in the app (bilingual UI: locale-provider;
// role gates: auth-gate/feature-gate; offline sync: sync-queue; RLS: every
// Supabase migration; multi-branch: shop/branch settings) — nothing here is
// aspirational copy.
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

// Global premium UI phase, Part 24 — "reuse actual plan data... do not
// hardcode conflicting marketing prices." Name/price now come straight
// from PLANS (lib/subscription/plans.ts, the same source /settings/plans
// uses) instead of a second, independently-hardcoded copy that could
// silently drift from the real configuration. Only the short marketing
// blurb per plan — genuine copy, not data — stays as translated text.
const PLAN_DETAIL_KEY: Record<string, string> = {
  starter: "home.mkt.plan_starter_detail",
  business: "home.mkt.plan_business_detail",
  pro: "home.mkt.plan_pro_detail",
};

// Landing v2 pricing checklist — built from the real PlanFeatures flags
// (lib/subscription/types.ts) rather than a separate hand-written list per
// plan, so a checklist can never silently drift from what a plan actually
// unlocks. Order is fixed regardless of which flags are true so cards stay
// visually aligned; falsy flags are simply skipped per card.
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
    <div className="min-h-screen overflow-hidden bg-slate-50 text-slate-950">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white">
              L
            </span>
            <div className="leading-tight">
              <span className="block text-xl font-bold tracking-tight text-teal-700">LakBiz</span>
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:block">
                {t("home.mkt.region")}
              </span>
            </div>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#features" className="transition hover:text-teal-700">
              {t("home.mkt.nav.features")}
            </a>
            <a href="#industries" className="transition hover:text-teal-700">
              {t("home.mkt.nav.industries")}
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
              className="inline-flex items-center justify-center rounded-full bg-teal-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-teal-700 sm:px-5 sm:text-sm"
            >
              {t("home.mkt.nav.book_demo")}
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Global premium UI phase, Part 26/48 — one restrained ambient
         * glow, not the five separate gradient/blur/glassmorphism moments
         * this section used to layer (header logo, this blob, both CTA
         * buttons' heavy shadows, the preview card's own glow+blur). This
         * is the one place this page spends its "boldness" (see the
         * hero-is-a-thesis guidance) — everywhere else stays flat. */}
        <section className="relative pt-28 sm:pt-32 lg:pt-36">
          <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-teal-200/25 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
              <div className="text-center lg:text-left">
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-4 py-2 text-xs font-bold text-teal-800 shadow-sm lg:mx-0">
                  {t("home.mkt.badge")}
                </div>
                <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl lg:leading-[1.02]">
                  {t("home.mkt.hero_title")}
                </h1>
                <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg lg:mx-0">
                  {t("home.mkt.hero_desc")}
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-7 py-4 text-sm font-bold text-white transition hover:bg-teal-700"
                  >
                    {t("home.mkt.cta_sign_in")} <span className="ml-2">→</span>
                  </Link>
                  <a
                    href="#contact"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-7 py-4 text-sm font-bold text-slate-800 transition hover:border-teal-300 hover:text-teal-800"
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

        {/* Landing v2 — capability-row strip. Sits between the hero and the
         * "how it works" steps: a quick, scannable line of things the
         * product already does, not a repeat of the feature cards below. */}
        <section className="mx-auto mt-14 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 rounded-xl border border-slate-200 bg-white px-6 py-5 sm:justify-between">
            {capabilityKeys.map(({ key, Icon }) => (
              <div key={key} className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
                <Icon className="h-5 w-5 shrink-0 text-teal-600" />
                {t(key)}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stepKeys.map((key, index) => (
              <div
                key={key}
                className="rounded-xl border border-white bg-white p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-sm font-bold text-teal-700">
                  {index + 1}
                </div>
                <p className="mt-4 text-sm font-bold text-slate-900">{t(key)}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
              {t("home.mkt.features_eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {t("home.mkt.features_title")}
            </h2>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featureKeys.map(({ title, desc, Icon }) => (
              <div key={title} className="rounded-xl border border-white bg-white p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-950">{t(title)}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{t(desc)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Landing v2 — "Industries" replaces the old dark chip strip. Every
         * card is driven by the real sector catalogue (lib/sectors.ts) that
         * the product form and sector picker also read from, so this list
         * can never claim a sector the app doesn't actually support. No
         * photography exists for these sectors in this sandbox, and this
         * phase's own no-fake-imagery rule rules out sourcing stock photos
         * to stand in for real customer sites — so the cards stay
         * icon-and-data led (name, real description, real sample reports)
         * rather than photo-led. */}
        <section id="industries" className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
              {t("home.mkt.industries_eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {t("home.mkt.industries_title")}
            </h2>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">
              {t("home.mkt.industries_desc")}
            </p>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sectors.map((sector) => (
              <div key={sector.id} className="rounded-xl border border-white bg-white p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-teal-300">
                  <SectorIcon sectorId={sector.id} className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-base font-bold text-slate-950">
                  {locale === "si" ? sector.nameSi : sector.nameEn}
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{sector.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {sector.reports.slice(0, 2).map((report) => (
                    <span
                      key={report}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-500"
                    >
                      {report}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="plans" className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">
              {t("home.mkt.plans_eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {t("home.mkt.plans_title")}
            </h2>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">
              {t("home.mkt.plans_desc")}
            </p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {PLANS.map((plan) => {
              const planName = locale === "si" ? plan.nameSi : plan.nameEn;
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-xl border bg-white p-6 ${
                    plan.highlight ? "border-teal-300 ring-2 ring-teal-100" : "border-slate-200"
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-6 rounded-full bg-teal-600 px-3 py-1 text-xs font-bold text-white">
                      {t("home.mkt.plan_recommended")}
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-slate-950">{planName}</h3>
                  <p className="mt-3 text-2xl font-bold text-teal-700">
                    {formatLkrPrice(plan.priceMonthlyLkr)}
                    <span className="text-sm font-semibold text-slate-400">/{t("sub.month")}</span>
                  </p>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                    {t(PLAN_DETAIL_KEY[plan.id] ?? "")}
                  </p>
                  <p className="mt-3 text-xs font-medium text-slate-400">
                    {t("home.mkt.plan_users").replace("{n}", String(plan.maxUsers))}
                    {" · "}
                    {t("home.mkt.plan_branches").replace("{n}", String(plan.maxBranches))}
                  </p>

                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {t("home.mkt.plan_includes")}
                    </p>
                    <ul className="mt-3 space-y-2">
                      {PLAN_FEATURE_ROWS.filter((row) => plan.features[row.flag]).map((row) => (
                        <li key={row.flag} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <CheckBadge />
                          {t(row.labelKey)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <a
                    href="#contact"
                    className={`mt-6 inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-bold transition ${
                      plan.highlight
                        ? "bg-teal-600 text-white hover:bg-teal-700"
                        : "border border-slate-300 text-slate-800 hover:border-teal-300 hover:text-teal-800"
                    }`}
                  >
                    {t("home.mkt.plan_cta").replace("{plan}", planName)}
                  </a>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-xs text-slate-400">{t("home.mkt.plans_footnote")}</p>
        </section>

        <section id="contact" className="mx-auto my-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-700 p-8 text-white shadow-sm shadow-teal-900/20 sm:p-12">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-100">
                {t("home.mkt.contact_eyebrow")}
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
                {t("home.mkt.contact_title")}
              </h2>
              <p className="mt-4 text-base font-semibold leading-7 text-teal-50">
                {t("home.mkt.contact_desc")}
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 text-sm font-bold text-teal-800 shadow-sm shadow-teal-950/10"
              >
                {t("home.mkt.contact_sign_in")}
              </Link>
              <Link
                href="/login?next=/admin"
                className="inline-flex items-center justify-center rounded-2xl border border-white/30 px-7 py-4 text-sm font-bold text-white hover:bg-white/10"
              >
                {t("home.mkt.contact_admin")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white">
                  L
                </span>
                <span className="text-lg font-bold text-white">LakBiz</span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">
                {t("home.mkt.footer_tagline")}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {t("home.mkt.footer_product_heading")}
              </p>
              <div className="mt-4 flex flex-col gap-3 text-sm font-semibold text-slate-300">
                <a href="#features" className="transition hover:text-teal-300">
                  {t("home.mkt.nav.features")}
                </a>
                <a href="#industries" className="transition hover:text-teal-300">
                  {t("home.mkt.nav.industries")}
                </a>
                <a href="#plans" className="transition hover:text-teal-300">
                  {t("home.mkt.nav.plans")}
                </a>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {t("home.mkt.footer_start_heading")}
              </p>
              <div className="mt-4 flex flex-col gap-3 text-sm font-semibold text-slate-300">
                <Link href="/login" className="transition hover:text-teal-300">
                  {t("home.mkt.nav.sign_in")}
                </Link>
                <a href="#contact" className="transition hover:text-teal-300">
                  {t("home.mkt.nav.contact")}
                </a>
                <Link href="/login?next=/admin" className="transition hover:text-teal-300">
                  {t("home.mkt.contact_admin")}
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              © {year} LakBiz. {t("home.mkt.footer_rights")}
            </span>
            <span>{t("home.mkt.region")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CheckBadge() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5" aria-hidden="true">
        <path d="M4 12.5 9.5 18 20 6" />
      </svg>
    </span>
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
    <div className="relative mx-auto w-full max-w-2xl pb-8 lg:max-w-none lg:pb-10">
      {/* Global premium UI phase, Part 21/48 — was a glassmorphism stack
       * (glow blob + backdrop-blur-xl translucent frame). Disclosed
       * limitation, unchanged by this phase: no browser exists in this
       * sandbox, so this stays a hand-built approximation of the real
       * dashboard rather than an actual screenshot — but it should read
       * as a clean product frame, not a decorative glass panel. */}
      <div className="relative rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
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
              <p className="mb-5 text-sm font-bold text-teal-300 sm:text-lg">LakBiz</p>
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
                  <span className="h-7 w-7 rounded-full bg-teal-100" />
                  <span className="hidden text-xs font-bold sm:block">{t("home.mkt.preview_shop")}</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {statCards.map((card) => (
                  <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-500">{card.label}</p>
                    <p className="mt-1 text-sm font-bold text-slate-950 sm:text-base">{card.value}</p>
                    <p className="mt-1 text-[9px] font-semibold text-teal-600">{card.hint}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_0.8fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">{t("home.mkt.preview_analytics")}</p>
                    <span className="rounded-full border border-slate-200 px-2 py-1 text-[9px] font-bold text-slate-500">
                      {t("home.mkt.preview_this_week")}
                    </span>
                  </div>
                  <div className="mt-6 flex h-32 items-end gap-2 sm:h-40">
                    {[35, 58, 46, 50, 66, 92, 52].map((height, index) => (
                      <div key={index} className="flex flex-1 flex-col items-center gap-2">
                        <div
                          className="w-full rounded-t-lg bg-teal-500"
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

      {/* Landing v2 — a second, smaller frame standing in for the phone/PWA
       * view (README: "Responsive PWA from the same codebase" — this is a
       * real product mode, not an invented one). Same disclosed-mockup
       * status as the frame above: a hand-built approximation, not a
       * screenshot. */}
      <div className="absolute -bottom-6 -left-3 hidden w-40 rounded-[1.4rem] border border-slate-200 bg-white p-1.5 shadow-lg sm:block lg:-left-8 lg:w-44">
        <div className="overflow-hidden rounded-[1.1rem] border border-slate-200 bg-slate-950">
          <div className="flex items-center justify-between px-3 pt-2.5 text-[8px] font-bold text-slate-400">
            <span>9:41</span>
            <span className="h-1 w-6 rounded-full bg-white/20" />
          </div>
          <div className="px-3 pb-3 pt-2">
            <p className="text-[9px] font-bold text-teal-300">{t("home.mkt.preview_shop")}</p>
            <div className="mt-2 rounded-xl bg-white/5 p-2.5">
              <p className="text-[8px] font-bold text-slate-400">{t("home.mkt.preview_today_sales")}</p>
              <p className="mt-1 text-sm font-bold text-white">Rs. 45,680</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <div className="rounded-lg bg-teal-500 py-2 text-center text-[8px] font-bold text-white">
                {t("nav.sales")}
              </div>
              <div className="rounded-lg bg-white/5 py-2 text-center text-[8px] font-bold text-slate-300">
                {t("nav.stock")}
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
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-sm font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-[10px] font-semibold text-slate-500">{hint}</p>
    </div>
  );
}
