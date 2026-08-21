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
  ShieldIcon,
  LayersIcon,
} from "@/components/ui/icons";

const PAGE_COPY = {
  en: {
    nav: {
      features: "Features",
      solutions: "Solutions",
      pricing: "Pricing",
      industries: "Industries",
      contact: "Contact",
      signIn: "Sign in",
      demo: "Book demo",
    },
    badge: "Admin-managed SaaS for Sri Lankan SMEs",
    heroTitle: "Business software that runs your shop,",
    heroAccent: "the Sri Lankan way.",
    heroDesc:
      "LakBiz is an admin-managed business platform. We set up your shop, plan and login after manual payment. Your team signs in and uses only the modules assigned to your business.",
    primaryCta: "Get started",
    secondaryCta: "Book a demo",
    heroTrust: ["Quick setup", "Secure & reliable", "Sri Lanka VAT ready"],
    capabilities: [
      ["Built for Sri Lankan businesses", "Local workflows, LKR and VAT-ready operations"],
      ["Sri Lanka VAT-ready", "Track input and output VAT with clear summaries"],
      ["Multi-user role-based access", "Give each staff member only the access they need"],
      ["Inventory, billing & customers", "Run daily operations from one connected workspace"],
      ["Banking & cheque management", "Track deposits, cheques and reconciliations"],
    ],
    featuresEyebrow: "Core features",
    featuresTitle: "Everything you need to run your business",
    featuresDesc: "Powerful modules for the work your team handles every day — without unnecessary complexity.",
    features: [
      ["Sales & POS", "Process sales, POS, quotations and returns from one clean counter."],
      ["Stock Management", "Track inventory in real time and get low-stock alerts before products run out."],
      ["Billing", "Create invoices and bills, manage credit customers and keep balances organised."],
      ["VAT Ready", "Manage input and output VAT and prepare clear return-ready summaries."],
      ["Banking & Cheques", "Manage bank accounts, received and issued cheques, deposits and reconciliation."],
      ["Customers & Suppliers", "Keep contacts, balances and transaction history together in one place."],
      ["Sector Modules", "Add AC service, vehicle, wholesale and other sector-specific workflows when needed."],
    ],
    industriesEyebrow: "Built for your industry",
    industriesTitle: "Configured for every type of business",
    industriesDesc: "LakBiz adapts to the way your business operates — not the other way around.",
    pricingEyebrow: "Simple, transparent pricing",
    pricingTitle: "Choose the plan that fits your business",
    pricingDesc: "Plans are activated by LakBiz after payment and verification. Upgrade when your business needs more.",
    planDescriptions: {
      starter: "Perfect for small shops",
      business: "For growing businesses",
      pro: "For advanced operations",
    },
    mostPopular: "Most popular",
    includes: "Includes",
    planCta: "Get started",
    planFootnote: "Plans are assigned manually by LakBiz admin after payment and verification.",
    proofEyebrow: "Built for real operations",
    proofTitle: "Professional software without unnecessary complexity",
    proofItems: [
      ["Admin-managed setup", "We configure your shop, plan and user access before your team starts."],
      ["Only the modules you need", "Your staff see the tools that apply to your business, without clutter."],
      ["Designed around local workflows", "Billing, VAT, banking and day-to-day operations are built for Sri Lankan SMEs."],
    ],
    ctaEyebrow: "Get your LakBiz account",
    ctaTitle: "We create your shop. You focus on growing your business.",
    ctaDesc: "Our team will set up your shop, assign the right plan and provide your login — fast and hassle-free.",
    ctaPrimary: "Book a demo",
    ctaSecondary: "Sign in",
    footerTagline: "Admin-managed business software built for Sri Lankan SMEs.",
    footerProduct: "Product",
    footerStart: "Get started",
    rights: "All rights reserved.",
    region: "Sri Lanka",
  },
  si: {
    nav: {
      features: "විශේෂාංග",
      solutions: "විසඳුම්",
      pricing: "මිල ගණන්",
      industries: "ව්‍යාපාර වර්ග",
      contact: "සම්බන්ධ වන්න",
      signIn: "පිවිසෙන්න",
      demo: "ඩෙමෝවක් වෙන්කරගන්න",
    },
    badge: "ශ්‍රී ලංකා කුඩා හා මධ්‍යම ව්‍යාපාර සඳහා admin-managed SaaS",
    heroTitle: "ඔබේ ව්‍යාපාරය ක්‍රියාත්මක කරන මෘදුකාංගය,",
    heroAccent: "ශ්‍රී ලංකා ක්‍රමයට.",
    heroDesc:
      "LakBiz යනු admin විසින් සකසන ව්‍යාපාර වේදිකාවකි. ගෙවීමෙන් පසු අපි ඔබේ shop, plan සහ login සකසමු. ඔබේ කණ්ඩායමට අවශ්‍ය modules පමණක් ලැබේ.",
    primaryCta: "ආරම්භ කරන්න",
    secondaryCta: "ඩෙමෝවක් වෙන්කරගන්න",
    heroTrust: ["ඉක්මන් සැකසුම", "ආරක්ෂිත සහ විශ්වාසදායක", "ශ්‍රී ලංකා VAT සඳහා සූදානම්"],
    capabilities: [
      ["ශ්‍රී ලංකා ව්‍යාපාර සඳහා නිර්මාණය කළ", "දේශීය වැඩ පිළිවෙළ, LKR සහ VAT-ready operations"],
      ["ශ්‍රී ලංකා VAT-ready", "Input සහ output VAT පැහැදිලිව පාලනය කරන්න"],
      ["භූමිකා අනුව ප්‍රවේශය", "එක් එක් සේවකයාට අවශ්‍ය access පමණක් දෙන්න"],
      ["තොග, බිල්පත් සහ ගනුදෙනුකරුවන්", "දිනපතා කටයුතු එකම workspace එකකින්"],
      ["බැංකු සහ චෙක් කළමනාකරණය", "Deposits, cheques සහ reconciliation පාලනය කරන්න"],
    ],
    featuresEyebrow: "ප්‍රධාන විශේෂාංග",
    featuresTitle: "ඔබේ ව්‍යාපාරය පවත්වාගෙන යාමට අවශ්‍ය සියල්ල",
    featuresDesc: "අවශ්‍ය දේ පැහැදිලිව — දිනපතා වැඩ සඳහා බලවත් modules, අනවශ්‍ය සංකීර්ණතාවකින් තොරව.",
    features: [
      ["විකුණුම් සහ POS", "විකුණුම්, POS, quotations සහ returns එකම පිරිසිදු screen එකකින් කරන්න."],
      ["තොග කළමනාකරණය", "Real-time stock බලන්න සහ අඩු තොග alerts ලබා ගන්න."],
      ["බිල්පත්", "Invoices සහ bills සාදන්න, credit customers සහ balances පාලනය කරන්න."],
      ["VAT Ready", "Input/output VAT පාලනය කර return-ready summaries සකසන්න."],
      ["බැංකු සහ චෙක්", "Bank accounts, received/issued cheques, deposits සහ reconciliation පාලනය කරන්න."],
      ["ගනුදෙනුකරුවන් සහ සැපයුම්කරුවන්", "Contacts, balances සහ transaction history එකම ස්ථානයක තබා ගන්න."],
      ["Sector Modules", "AC service, vehicle, wholesale සහ අනෙකුත් sector workflows අවශ්‍ය විට සක්‍රිය කරන්න."],
    ],
    industriesEyebrow: "ඔබේ ව්‍යාපාර වර්ගය සඳහා",
    industriesTitle: "සෑම ව්‍යාපාර වර්ගයකටම සකස් කළ හැක",
    industriesDesc: "LakBiz ඔබේ ව්‍යාපාරයට ගැළපේ — ඔබේ ව්‍යාපාරය software එකට ගැළපිය යුතු නැහැ.",
    pricingEyebrow: "සරල සහ පැහැදිලි මිල ගණන්",
    pricingTitle: "ඔබේ ව්‍යාපාරයට ගැළපෙන plan එක තෝරන්න",
    pricingDesc: "ගෙවීම සහ verification පසු LakBiz admin විසින් plan activate කරයි. අවශ්‍ය විට upgrade කරන්න.",
    planDescriptions: {
      starter: "කුඩා වෙළඳසැල් සඳහා",
      business: "වර්ධනය වන ව්‍යාපාර සඳහා",
      pro: "උසස් operations සඳහා",
    },
    mostPopular: "වැඩිම ජනප්‍රිය",
    includes: "ඇතුළත්",
    planCta: "ආරම්භ කරන්න",
    planFootnote: "ගෙවීම සහ verification පසු LakBiz admin විසින් plans assign කරයි.",
    proofEyebrow: "සැබෑ දිනපතා operations සඳහා",
    proofTitle: "අනවශ්‍ය සංකීර්ණතාවකින් තොර professional software",
    proofItems: [
      ["Admin-managed setup", "ඔබේ shop, plan සහ user access අපි කලින්ම සකසමු."],
      ["අවශ්‍ය modules පමණක්", "ඔබේ staffට ඔවුන්ට අවශ්‍ය tools පමණක් පෙන්වයි."],
      ["දේශීය workflows සඳහා", "Billing, VAT, banking සහ දිනපතා operations ශ්‍රී ලංකා SMEs සඳහා සකසා ඇත."],
    ],
    ctaEyebrow: "ඔබේ LakBiz account එක ලබා ගන්න",
    ctaTitle: "අපි ඔබේ shop එක සකසමු. ඔබ ව්‍යාපාරය වර්ධනය කරන්න.",
    ctaDesc: "අපේ කණ්ඩායම ඔබේ shop එක සකසා, නිවැරදි plan එක assign කර login ලබා දෙයි.",
    ctaPrimary: "ඩෙමෝවක් වෙන්කරගන්න",
    ctaSecondary: "පිවිසෙන්න",
    footerTagline: "ශ්‍රී ලංකා SMEs සඳහා admin-managed business software.",
    footerProduct: "Product",
    footerStart: "ආරම්භ කරන්න",
    rights: "සියලු හිමිකම් ඇවිරිණි.",
    region: "ශ්‍රී ලංකාව",
  },
} as const;

const FEATURE_ICONS = [SalesIcon, StockIcon, BillsIcon, VatIcon, BankingIcon, CustomersIcon, JobsIcon] as const;
const CAPABILITY_ICONS = [ShieldIcon, VatIcon, UsersIcon, LayersIcon, BankingIcon] as const;

const PLAN_FEATURE_ROWS: { flag: keyof (typeof PLANS)[number]["features"]; label: string }[] = [
  { flag: "sales", label: "Sales" },
  { flag: "stock", label: "Stock" },
  { flag: "bills", label: "Billing" },
  { flag: "customers", label: "Customers" },
  { flag: "suppliers", label: "Suppliers" },
  { flag: "banking", label: "Banking" },
  { flag: "ac_jobs", label: "AC Jobs" },
  { flag: "vehicles", label: "Vehicles" },
  { flag: "export", label: "Data export" },
  { flag: "offline", label: "Offline billing" },
  { flag: "bulk_messaging", label: "Bulk customer messages" },
];

const PREVIEW_NAV = ["Dashboard", "Sales", "Stock", "Customers", "Bills", "VAT return"];

export function MarketingHomePage() {
  const { locale, setLocale } = useLocale();
  const c = PAGE_COPY[locale];
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#fbfdfd] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1420px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-sm font-black text-white shadow-[0_8px_22px_rgba(13,148,136,0.22)]">L</span>
            <span className="text-xl font-bold tracking-[-0.035em] text-slate-950">LakBiz</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#features" className="transition hover:text-teal-700">{c.nav.features}</a>
            <a href="#solutions" className="transition hover:text-teal-700">{c.nav.solutions}</a>
            <a href="#plans" className="transition hover:text-teal-700">{c.nav.pricing}</a>
            <a href="#industries" className="transition hover:text-teal-700">{c.nav.industries}</a>
            <a href="#contact" className="transition hover:text-teal-700">{c.nav.contact}</a>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setLocale(locale === "si" ? "en" : "si")}
              className="hidden min-h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 transition hover:border-teal-200 hover:text-teal-700 sm:inline-flex sm:items-center"
            >
              <LanguageIcon className="mr-2 h-4 w-4" />
              {locale === "en" ? "සිංහල" : "English"}
            </button>
            <Link href="/login" className="hidden min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:text-teal-700 sm:inline-flex">
              {c.nav.signIn}
            </Link>
            <a href="#contact" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-teal-600 px-5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(13,148,136,0.2)] transition hover:bg-teal-700">
              {c.nav.demo}
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-white">
          <div className="pointer-events-none absolute -right-36 top-8 h-[34rem] w-[34rem] rounded-full bg-teal-50 blur-2xl" />
          <div className="pointer-events-none absolute left-[38%] top-28 h-72 w-72 rounded-full bg-cyan-50/70 blur-3xl" />

          <div className="relative mx-auto grid max-w-[1420px] items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:px-10 lg:py-24">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-800">
                <ShieldIcon className="h-4 w-4" />
                {c.badge}
              </div>

              <h1 className="mt-6 text-4xl font-bold leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-[4rem]">
                {c.heroTitle}{" "}
                <span className="text-teal-600">{c.heroAccent}</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">{c.heroDesc}</p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#contact" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-teal-600 px-7 text-sm font-bold text-white shadow-[0_12px_30px_rgba(13,148,136,0.2)] transition hover:bg-teal-700">
                  {c.primaryCta}<span className="ml-2">→</span>
                </a>
                <a href="#contact" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-teal-300 bg-white px-7 text-sm font-bold text-teal-700 transition hover:bg-teal-50">
                  {c.secondaryCta}
                </a>
              </div>

              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
                {c.heroTrust.map((item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-50 text-[9px] text-teal-700">✓</span>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <ProductShowcase />
          </div>
        </section>

        <section id="solutions" className="bg-white pb-14">
          <div className="mx-auto max-w-[1420px] px-4 sm:px-6 lg:px-10">
            <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_45px_rgba(15,23,42,0.06)] sm:grid-cols-2 lg:grid-cols-5">
              {c.capabilities.map(([title, desc], index) => {
                const Icon = CAPABILITY_ICONS[index];
                return (
                  <div key={title} className={`flex gap-3.5 px-5 py-5 ${index > 0 ? "border-t border-slate-100 sm:border-l sm:border-t-0" : ""}`}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon className="h-5 w-5" /></span>
                    <div>
                      <p className="text-sm font-bold leading-5 text-slate-900">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-24 bg-[#f6f9fb] py-16 lg:py-20">
          <div className="mx-auto max-w-[1420px] px-4 sm:px-6 lg:px-10">
            <SectionHeading eyebrow={c.featuresEyebrow} title={c.featuresTitle} description={c.featuresDesc} />

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {c.features.map(([title, desc], index) => {
                const Icon = FEATURE_ICONS[index];
                return (
                  <article key={title} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.045)] transition duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-[0_16px_38px_rgba(15,23,42,0.08)]">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700 transition group-hover:bg-teal-100"><Icon className="h-5 w-5" /></span>
                    <h3 className="mt-5 text-base font-bold tracking-tight text-slate-950">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="industries" className="scroll-mt-24 bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-[1420px] px-4 sm:px-6 lg:px-10">
            <SectionHeading eyebrow={c.industriesEyebrow} title={c.industriesTitle} description={c.industriesDesc} />

            <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              {sectors.slice(0, 7).map((sector, index) => (
                <article key={sector.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.045)] transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-[0_16px_36px_rgba(15,23,42,0.075)]">
                  <div className="relative flex h-28 items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#e7f8f5_0%,#f8fbfc_55%,#d9f3ef_100%)]">
                    <div className="absolute -right-7 -top-7 h-20 w-20 rounded-full border border-teal-200/60" />
                    <div className="absolute -bottom-8 -left-7 h-24 w-24 rounded-full bg-teal-100/70" />
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-[0_10px_28px_rgba(13,148,136,0.14)] ring-1 ring-teal-100">
                      <SectorIcon sectorId={sector.id} className="h-6 w-6" />
                    </span>
                  </div>
                  <div className="p-4 text-center">
                    <h3 className="text-sm font-bold text-slate-950">{locale === "si" ? sector.nameSi : sector.nameEn}</h3>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500">{sector.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="plans" className="scroll-mt-24 bg-[#f6f9fb] py-16 lg:py-20">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-10">
            <SectionHeading eyebrow={c.pricingEyebrow} title={c.pricingTitle} description={c.pricingDesc} />

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {PLANS.map((plan) => {
                const highlight = plan.highlight;
                const enabledRows = PLAN_FEATURE_ROWS.filter((row) => plan.features[row.flag]);
                const planName = locale === "si" ? plan.nameSi : plan.nameEn;
                const planDesc = c.planDescriptions[plan.id as keyof typeof c.planDescriptions] ?? "";
                return (
                  <article key={plan.id} className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white ${highlight ? "border-teal-500 shadow-[0_20px_55px_rgba(13,148,136,0.14)]" : "border-slate-200 shadow-[0_8px_28px_rgba(15,23,42,0.045)]"}`}>
                    {highlight && <div className="bg-teal-600 px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-white">{c.mostPopular}</div>}
                    <div className="flex flex-1 flex-col p-6 sm:p-7">
                      <div>
                        <h3 className="text-xl font-bold text-slate-950">{planName}</h3>
                        <p className="mt-1 text-sm text-slate-500">{planDesc}</p>
                        <p className="mt-5 text-4xl font-bold tracking-[-0.045em] text-teal-700">
                          {formatLkrPrice(plan.priceMonthlyLkr)}
                          <span className="ml-1 text-sm font-semibold tracking-normal text-slate-400">/month</span>
                        </p>
                      </div>

                      <div className="mt-6 border-t border-slate-100 pt-5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{c.includes}</p>
                        <ul className="mt-4 space-y-2.5">
                          {enabledRows.slice(0, 7).map((row) => (
                            <li key={row.flag} className="flex items-center gap-2.5 text-sm text-slate-600">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-50 text-[9px] font-bold text-teal-700">✓</span>
                              {row.label}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <a href="#contact" className={`mt-7 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold transition ${highlight ? "bg-teal-600 text-white shadow-[0_10px_24px_rgba(13,148,136,0.18)] hover:bg-teal-700" : "border border-teal-300 bg-white text-teal-700 hover:bg-teal-50"}`}>
                        {c.planCta}
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-5 text-center text-xs text-slate-400">{c.planFootnote}</p>
          </div>
        </section>

        <section className="bg-white py-14 lg:py-16">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-10">
            <SectionHeading eyebrow={c.proofEyebrow} title={c.proofTitle} />
            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {c.proofItems.map(([title, desc], index) => {
                const Icon = [ShieldIcon, LayersIcon, UsersIcon][index];
                return (
                  <article key={title} className="rounded-2xl border border-slate-200 bg-[#fbfdfd] p-6 shadow-[0_8px_28px_rgba(15,23,42,0.04)]">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon className="h-5 w-5" /></span>
                    <h3 className="mt-5 text-lg font-bold tracking-tight text-slate-950">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-24 bg-white pb-16 lg:pb-20">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
            <div className="relative overflow-hidden rounded-[1.75rem] bg-[linear-gradient(110deg,#075c61_0%,#0d9488_55%,#08796f_100%)] px-6 py-10 text-white shadow-[0_24px_65px_rgba(6,78,84,0.18)] sm:px-9 lg:px-12">
              <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border border-white/10" />
              <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-100">{c.ctaEyebrow}</p>
                  <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">{c.ctaTitle}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-teal-50/80">{c.ctaDesc}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
                  <a href="mailto:hello@lakbiz.app" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-teal-800 transition hover:bg-teal-50">{c.ctaPrimary}<span className="ml-2">→</span></a>
                  <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/25 bg-white/[0.06] px-6 text-sm font-bold text-white transition hover:bg-white/[0.12]">{c.ctaSecondary}</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#07111f] text-slate-400">
        <div className="mx-auto max-w-[1420px] px-4 py-10 sm:px-6 lg:px-10">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-sm font-black text-[#06201e]">L</span>
                <span className="text-lg font-bold text-white">LakBiz</span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">{c.footerTagline}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">{c.footerProduct}</p>
              <div className="mt-4 flex flex-col gap-2.5 text-sm">
                <a href="#features" className="hover:text-white">{c.nav.features}</a>
                <a href="#plans" className="hover:text-white">{c.nav.pricing}</a>
                <a href="#industries" className="hover:text-white">{c.nav.industries}</a>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">{c.footerStart}</p>
              <div className="mt-4 flex flex-col gap-2.5 text-sm">
                <Link href="/login" className="hover:text-white">{c.nav.signIn}</Link>
                <a href="#contact" className="hover:text-white">{c.nav.demo}</a>
                <a href="mailto:hello@lakbiz.app" className="hover:text-white">hello@lakbiz.app</a>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-2 border-t border-white/[0.07] pt-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>© {year} LakBiz. {c.rights}</span>
            <span>{c.region}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-700">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">{title}</h2>
      {description && <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
    </div>
  );
}

function ProductShowcase() {
  const stats = [
    ["Today sales", "Rs. 45,680", "Live"],
    ["Profit", "Rs. 12,340", "Tracked"],
    ["Bills", "32", "Ready"],
    ["Cash", "Rs. 128,750", "Available"],
  ];

  return (
    <div className="relative mx-auto w-full max-w-[760px] pb-10" aria-hidden="true">
      <div className="absolute inset-x-16 bottom-5 h-20 rounded-full bg-teal-200/60 blur-3xl" />
      <div className="relative ml-auto w-[92%] rounded-[1.55rem] border border-slate-200 bg-white p-2.5 shadow-[0_30px_75px_rgba(15,23,42,0.16)]">
        <div className="overflow-hidden rounded-[1.2rem] border border-slate-200 bg-white">
          <div className="flex h-10 items-center gap-2 bg-slate-950 px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-3 rounded-full bg-white/[0.07] px-3 py-1 text-[8px] text-slate-500">lakbiz.app/dashboard</span>
          </div>
          <div className="grid min-h-[25rem] grid-cols-[8rem_1fr] bg-[#f7f9fc]">
            <aside className="bg-[#08111f] p-4">
              <p className="text-sm font-bold text-teal-300">LakBiz</p>
              <div className="mt-5 space-y-1.5">
                {PREVIEW_NAV.map((item, index) => (
                  <div key={item} className={`rounded-lg px-2.5 py-2 text-[9px] font-semibold ${index === 0 ? "bg-teal-400/15 text-white" : "text-slate-600"}`}>{item}</div>
                ))}
              </div>
            </aside>
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 flex-1 items-center rounded-lg border border-slate-200 bg-white px-3 text-[9px] text-slate-400">Search transactions, products, customers…</div>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[9px] font-semibold text-slate-700">Customer Shop</div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {stats.map(([label, value, hint]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                    <p className="text-[7px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1 text-xs font-bold text-slate-950">{value}</p>
                    <p className="mt-1 text-[7px] font-semibold text-teal-600">{hint}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-2.5 md:grid-cols-[1.45fr_0.72fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center justify-between"><p className="text-[10px] font-bold text-slate-800">Sales Analytics</p><span className="text-[8px] text-slate-400">This week</span></div>
                  <svg viewBox="0 0 500 180" className="mt-4 h-36 w-full" preserveAspectRatio="none">
                    <defs><linearGradient id="showcaseFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity="0.22" /><stop offset="100%" stopColor="#14b8a6" stopOpacity="0" /></linearGradient></defs>
                    {[40, 80, 120, 160].map((y) => <line key={y} x1="0" x2="500" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />)}
                    <path d="M0 145 C55 125 90 108 130 120 C178 132 205 86 250 100 C300 116 334 72 380 82 C430 92 448 50 500 58 L500 180 L0 180 Z" fill="url(#showcaseFill)" />
                    <path d="M0 145 C55 125 90 108 130 120 C178 132 205 86 250 100 C300 116 334 72 380 82 C430 92 448 50 500 58" fill="none" stroke="#0d9488" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="hidden space-y-2.5 md:block">
                  {[["LOW STOCK", "Cooking Oil 5L"], ["RECEIVABLES", "Rs. 85,420"], ["VAT PAYABLE", "Rs. 9,500"]].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-[7px] font-bold tracking-wide text-slate-400">{label}</p><p className="mt-1 text-[10px] font-bold text-slate-900">{value}</p></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-[3%] w-[9.5rem] rounded-[1.75rem] border-[5px] border-slate-950 bg-white p-2 shadow-[0_22px_55px_rgba(15,23,42,0.2)]">
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="flex items-center justify-between px-1"><span className="text-[8px] font-bold text-slate-950">LakBiz</span><span className="text-[7px] text-slate-400">☰</span></div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {stats.map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-2"><p className="truncate text-[5px] text-slate-400">{label}</p><p className="mt-0.5 truncate text-[7px] font-bold text-slate-900">{value}</p></div>)}
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">{[SalesIcon, StockIcon, BillsIcon, CustomersIcon].map((Icon, index) => <span key={index} className="flex h-6 items-center justify-center rounded-md bg-teal-50 text-teal-700"><Icon className="h-3 w-3" /></span>)}</div>
        <div className="mt-2 h-7 rounded-lg bg-teal-600" />
      </div>
    </div>
  );
}
