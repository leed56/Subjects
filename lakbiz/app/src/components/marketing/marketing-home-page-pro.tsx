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
      demo: "Book a demo",
    },
    badge: "Admin-managed SaaS for Sri Lankan SMEs",
    heroTitle: "Business software that runs your shop,",
    heroAccent: "the Sri Lankan way.",
    heroDesc:
      "Sales, inventory, billing, VAT, banking and customer management — configured for your business by our team.",
    primaryCta: "Book a demo",
    secondaryCta: "Sign in",
    heroTrust: ["Admin-configured setup", "Secure role-based access", "Sri Lanka VAT ready"],
    capabilities: [
      ["Built for Sri Lankan businesses", "Local workflows, LKR pricing and VAT-ready operations"],
      ["Sri Lanka VAT-ready", "Track input and output VAT with clear summaries"],
      ["Multi-user role-based access", "Give each staff member only the access they need"],
      ["Inventory, billing & customers", "Run daily operations from one connected workspace"],
      ["Banking & cheque management", "Track deposits, cheques and reconciliations"],
    ],
    featuresEyebrow: "Core features",
    featuresTitle: "Your daily business, in one connected system",
    featuresDesc:
      "Sales, stock, billing and finance stay connected, so your team works faster with less duplication.",
    features: [
      ["Sales & POS", "Process sales, POS, quotations, credit sales and returns from one fast counter workflow."],
      ["Stock Management", "Track inventory in real time, find products quickly and catch low stock before it becomes a problem."],
      ["Billing & Invoicing", "Create invoices and bills, manage credit customers and keep balances organised without extra bookkeeping."],
      ["VAT Ready", "Track input and output VAT and prepare clean return-ready summaries from the same system."],
      ["Banking & Cheques", "Manage bank accounts, received and issued cheques, deposits and reconciliation."],
      ["Customers & Suppliers", "Keep contacts, balances, purchase history and outstanding amounts together."],
      ["Sector Modules", "Add AC service, vehicle and other sector-specific workflows only when your business needs them."],
    ],
    industriesEyebrow: "Built for your industry",
    industriesTitle: "One platform. Different workflows for different businesses.",
    industriesDesc:
      "Your shop gets the fields, reports and workflows that match how your sector actually operates.",
    industryDescriptions: {
      grocery: "Fast billing, weighted items, expiry tracking and credit customers.",
      electronics: "Serial and IMEI tracking, warranty, brand and model control.",
      electricals: "Meters, project billing and contractor-oriented pricing workflows.",
      spare_parts: "Part numbers, vehicle fitment and slow-moving stock visibility.",
      ac_hvac: "Installation jobs, service schedules, parts and warranty workflows.",
      car_sales: "Per-vehicle stock, landed cost, aging and profitability tracking.",
    },
    pricingEyebrow: "Simple, transparent pricing",
    pricingTitle: "Choose the plan that fits your business",
    pricingDesc:
      "Plans are activated by LakBiz after payment and verification. Move up only when your business needs more capability.",
    planDescriptions: {
      starter: "Perfect for small shops",
      business: "For growing businesses",
      pro: "For advanced operations",
    },
    mostPopular: "Most popular",
    includes: "Includes",
    planCta: "Book a demo",
    planFootnote: "Plans are assigned manually by LakBiz admin after payment and verification.",
    proofEyebrow: "Built for real operations",
    proofTitle: "Built for the way serious businesses operate",
    proofDesc:
      "Clear controls, no public self-signup and no unnecessary complexity. LakBiz is configured around the way your business works.",
    proofItems: [
      ["Admin-managed onboarding", "Your shop, plan and access are configured before your team starts."],
      ["LKR-first workflows", "Pricing and daily operations are designed around Sri Lankan businesses."],
      ["VAT-ready operations", "Input VAT, output VAT and summaries stay connected to real transactions."],
      ["Role-based access", "Staff see the tools and data appropriate to their role."],
      ["Multi-branch ready", "Grow from one location to multiple branches without changing systems."],
      ["Offline billing on Pro", "Keep essential billing workflows available when connectivity is unreliable."],
    ],
    ctaEyebrow: "Get your LakBiz account",
    ctaTitle: "We configure the system. Your team gets to work.",
    ctaDesc:
      "Book a demo, choose the right plan, and our team will set up your shop and user access for you.",
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
      "විකුණුම්, තොග, බිල්පත්, VAT, බැංකු සහ ගනුදෙනුකරු කළමනාකරණය — ඔබේ ව්‍යාපාරයට ගැළපෙන ලෙස අපේ කණ්ඩායම සකසයි.",
    primaryCta: "ඩෙමෝවක් වෙන්කරගන්න",
    secondaryCta: "පිවිසෙන්න",
    heroTrust: ["Admin විසින් සකසන පද්ධතිය", "භූමිකාව අනුව ආරක්ෂිත ප්‍රවේශය", "ශ්‍රී ලංකා VAT සඳහා සූදානම්"],
    capabilities: [
      ["ශ්‍රී ලංකා ව්‍යාපාර සඳහා", "දේශීය ක්‍රියාපටිපාටි, LKR මිලකරණය සහ VAT-ready මෙහෙයුම්"],
      ["ශ්‍රී ලංකා VAT-ready", "Input සහ output VAT පැහැදිලි සාරාංශ සමඟ පාලනය කරන්න"],
      ["භූමිකාව අනුව බහු-පරිශීලක ප්‍රවේශය", "එක් එක් සේවකයාට අවශ්‍ය ප්‍රවේශය පමණක් ලබා දෙන්න"],
      ["තොග, බිල්පත් සහ ගනුදෙනුකරුවන්", "දිනපතා මෙහෙයුම් එකම පද්ධතියකින් කරන්න"],
      ["බැංකු සහ චෙක් කළමනාකරණය", "තැන්පතු, චෙක්පත් සහ ගිණුම් සැසඳීම පාලනය කරන්න"],
    ],
    featuresEyebrow: "ප්‍රධාන විශේෂාංග",
    featuresTitle: "ඔබේ දිනපතා ව්‍යාපාර කටයුතු එකම පද්ධතියකින්",
    featuresDesc:
      "විකුණුම්, තොග, බිල්පත් සහ මූල්‍ය කටයුතු එකිනෙකට සම්බන්ධ නිසා වැඩ වේගවත් වන අතර නැවත නැවත දත්ත ඇතුළත් කිරීම අඩු වේ.",
    features: [
      ["විකුණුම් සහ POS", "විකුණුම්, POS, quotations, credit sales සහ returns එකම වේගවත් ක්‍රියාපටිපාටියකින් කරන්න."],
      ["තොග කළමනාකරණය", "Real-time තොග බලන්න, භාණ්ඩ ඉක්මනින් සොයන්න සහ අඩු තොග දැනුම්දීම් ලබා ගන්න."],
      ["බිල්පත් සහ Invoicing", "Invoices සහ bills සාදන්න, credit customers සහ balances පැහැදිලිව පාලනය කරන්න."],
      ["VAT Ready", "Input සහ output VAT එකම පද්ධතියෙන් track කර return-ready summaries සකසන්න."],
      ["බැංකු සහ චෙක්", "Bank accounts, ලැබුණු සහ නිකුත් කළ චෙක්, deposits සහ reconciliation පාලනය කරන්න."],
      ["ගනුදෙනුකරුවන් සහ සැපයුම්කරුවන්", "Contacts, balances, purchase history සහ outstanding amounts එකම තැනක තබන්න."],
      ["Sector Modules", "AC service, vehicle සහ sector-specific ක්‍රියාපටිපාටි අවශ්‍ය විට පමණක් සක්‍රිය කරන්න."],
    ],
    industriesEyebrow: "ඔබේ ව්‍යාපාර වර්ගය සඳහා",
    industriesTitle: "එකම පද්ධතියක්. ව්‍යාපාර වර්ගයට ගැළපෙන වෙනස් ක්‍රියාපටිපාටි.",
    industriesDesc:
      "ඔබේ sector එකට අවශ්‍ය fields, reports සහ ක්‍රියාපටිපාටි අනුව LakBiz සකස් වේ.",
    industryDescriptions: {
      grocery: "වේගවත් billing, weighted items, expiry tracking සහ credit customers.",
      electronics: "Serial/IMEI tracking, warranty, brand සහ model control.",
      electricals: "Meters, project billing සහ contractor pricing ක්‍රියාපටිපාටි.",
      spare_parts: "Part numbers, vehicle fitment සහ slow-moving stock visibility.",
      ac_hvac: "Installation jobs, service schedules, parts සහ warranty workflows.",
      car_sales: "Vehicle stock, landed cost, aging සහ profitability tracking.",
    },
    pricingEyebrow: "සරල සහ පැහැදිලි මිල ගණන්",
    pricingTitle: "ඔබේ ව්‍යාපාරයට ගැළපෙන සැලැස්ම තෝරන්න",
    pricingDesc:
      "ගෙවීම සහ verification පසු LakBiz plan එක activate කරයි. වැඩි පහසුකම් අවශ්‍ය විට පමණක් upgrade කරන්න.",
    planDescriptions: {
      starter: "කුඩා වෙළඳසැල් සඳහා",
      business: "වර්ධනය වන ව්‍යාපාර සඳහා",
      pro: "උසස් මෙහෙයුම් සඳහා",
    },
    mostPopular: "වැඩිම ජනප්‍රිය",
    includes: "ඇතුළත්",
    planCta: "ඩෙමෝවක් වෙන්කරගන්න",
    planFootnote: "ගෙවීම සහ verification පසු LakBiz admin විසින් සැලැස්ම assign කරයි.",
    proofEyebrow: "සැබෑ ව්‍යාපාර මෙහෙයුම් සඳහා",
    proofTitle: "සාර්ථක ව්‍යාපාරයක් ක්‍රියාත්මක වන ආකාරයට නිර්මාණය කළ පද්ධතිය",
    proofDesc:
      "අනවශ්‍ය සංකීර්ණතාවක් නැහැ. පොදු self-signup නැහැ. LakBiz ඔබේ ව්‍යාපාරය ක්‍රියා කරන ආකාරයට සකස් කරයි.",
    proofItems: [
      ["Admin-managed onboarding", "ඔබේ shop, plan සහ user access කණ්ඩායම වැඩ ආරම්භ කිරීමට පෙර අපි සකසමු."],
      ["LKR-first මෙහෙයුම්", "මිලකරණය සහ දිනපතා කටයුතු ශ්‍රී ලංකා ව්‍යාපාර සඳහා සකසා ඇත."],
      ["VAT-ready මෙහෙයුම්", "Input VAT, output VAT සහ summaries සැබෑ ගනුදෙනු සමඟ සම්බන්ධයි."],
      ["භූමිකාව අනුව ප්‍රවේශය", "සේවකයාට ඔහුගේ කාර්යයට අවශ්‍ය tools සහ data පමණක් පෙන්වයි."],
      ["ශාඛා කිහිපයකට සූදානම්", "පද්ධතිය මාරු නොකර එක ස්ථානයකින් ශාඛා කිහිපයකට වර්ධනය වන්න."],
      ["Pro සඳහා offline billing", "Internet connection දුර්වල වුවත් අත්‍යවශ්‍ය billing කටයුතු දිගටම කරන්න."],
    ],
    ctaEyebrow: "ඔබේ LakBiz account එක ලබා ගන්න",
    ctaTitle: "පද්ධතිය අපි සකස් කරමු. ඔබේ කණ්ඩායම වැඩ ආරම්භ කරයි.",
    ctaDesc:
      "ඩෙමෝවක් වෙන්කරගෙන නිවැරදි සැලැස්ම තෝරන්න. ඔබේ shop සහ user access අපේ කණ්ඩායම සකස් කරයි.",
    ctaPrimary: "ඩෙමෝවක් වෙන්කරගන්න",
    ctaSecondary: "පිවිසෙන්න",
    footerTagline: "ශ්‍රී ලංකා SMEs සඳහා admin-managed ව්‍යාපාර මෘදුකාංගය.",
    footerProduct: "LakBiz",
    footerStart: "ආරම්භ කරන්න",
    rights: "සියලු හිමිකම් ඇවිරිණි.",
    region: "ශ්‍රී ලංකාව",
  },
} as const;

type FeatureFlag = keyof (typeof PLANS)[number]["features"];

const PLAN_FEATURE_ROWS: { flag: FeatureFlag; en: string; si: string }[] = [
  { flag: "sales", en: "Sales & POS", si: "විකුණුම් & POS" },
  { flag: "stock", en: "Stock", si: "තොග" },
  { flag: "bills", en: "Billing", si: "බිල්පත්" },
  { flag: "customers", en: "Customers", si: "ගනුදෙනුකරුවන්" },
  { flag: "suppliers", en: "Suppliers", si: "සැපයුම්කරුවන්" },
  { flag: "banking", en: "Banking", si: "බැංකු" },
  { flag: "ac_jobs", en: "AC Jobs", si: "AC සේවා" },
  { flag: "vehicles", en: "Vehicles", si: "වාහන" },
  { flag: "export", en: "Data export", si: "දත්ත export" },
  { flag: "offline", en: "Offline billing", si: "Offline billing" },
  { flag: "bulk_messaging", en: "Bulk customer messages", si: "සමූහ customer messages" },
];

const FEATURE_ICONS = [SalesIcon, StockIcon, BillsIcon, VatIcon, BankingIcon, CustomersIcon, JobsIcon];
const CAPABILITY_ICONS = [ShieldIcon, VatIcon, UsersIcon, LayersIcon, BankingIcon];
const PROOF_ICONS = [ShieldIcon, LanguageIcon, VatIcon, UsersIcon, LayersIcon, StockIcon];
const INDUSTRY_ACCENTS = [
  "from-teal-300/30 via-cyan-200/10 to-transparent",
  "from-sky-300/25 via-teal-200/10 to-transparent",
  "from-emerald-300/25 via-teal-200/10 to-transparent",
  "from-cyan-300/20 via-slate-200/5 to-transparent",
  "from-teal-200/25 via-emerald-200/10 to-transparent",
  "from-sky-200/20 via-teal-200/10 to-transparent",
];

const INDUSTRY_REPORT_SI: Record<string, string> = {
  "Daily sales": "දිනපතා විකුණුම්",
  "Expiry alert": "කල් ඉකුත් දැනුම්දීම්",
  "Top sellers": "වැඩිම විකිණෙන භාණ්ඩ",
  "Warranty expiring": "Warranty අවසන් වන භාණ්ඩ",
  "Sales by brand": "Brand අනුව විකුණුම්",
  "Sales by project": "Project අනුව විකුණුම්",
  "Stock by unit": "Unit අනුව තොග",
  "Slow movers": "මන්දගාමී භාණ්ඩ",
  "Fast movers": "වේගයෙන් විකිණෙන භාණ්ඩ",
  "Reorder list": "නැවත ඇණවුම් ලැයිස්තුව",
  "Installations pending": "අවසන් නොකළ installations",
  "Warranty registrations": "Warranty ලියාපදිංචි",
  "Pipe & accessory usage": "Pipe සහ accessories භාවිතය",
  "Stock aging 30/60/90 days": "තොග වයස 30/60/90 දින",
  "Profit per vehicle": "වාහනයකට ලාභය",
  "Cash vs leasing mix": "Cash සහ leasing මිශ්‍රණය",
};

function industryReportLabel(report: string, locale: string) {
  return locale === "si" ? INDUSTRY_REPORT_SI[report] ?? report : report;
}

export function MarketingHomePage() {
  const { locale, setLocale } = useLocale();
  const isSinhala = locale === "si";
  const c = isSinhala ? PAGE_COPY.si : PAGE_COPY.en;
  const year = new Date().getFullYear();

  const salesStoryItems = isSinhala
    ? ["වේගවත් counter flow", "Credit sales", "Returns සහ quotations"]
    : ["Fast counter flow", "Credit sales", "Returns & quotations"];
  const stockMetrics = isSinhala
    ? [["තොගයේ", "1,248"], ["අඩු තොග", "18"], ["වර්ග", "42"]]
    : [["In stock", "1,248"], ["Low stock", "18"], ["Categories", "42"]];
  const billingRows = isSinhala
    ? [["Invoice #INV-2048", "Rs. 18,500"], ["Credit balance", "Rs. 7,200"], ["ලැබුණු ගෙවීම", "Rs. 11,300"]]
    : [["Invoice #INV-2048", "Rs. 18,500"], ["Credit balance", "Rs. 7,200"], ["Payment received", "Rs. 11,300"]];

  return (
    <div lang={locale} className="min-h-screen overflow-hidden bg-white text-slate-950">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-teal-600 text-sm font-black text-white shadow-[0_8px_22px_rgba(13,148,136,0.22)]">L</span>
            <span className="text-xl font-bold tracking-[-0.035em] text-slate-950">LakBiz</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-500 lg:flex">
            <a href="#features" className="transition hover:text-slate-950">{c.nav.features}</a>
            <a href="#solutions" className="transition hover:text-slate-950">{c.nav.solutions}</a>
            <a href="#plans" className="transition hover:text-slate-950">{c.nav.pricing}</a>
            <a href="#industries" className="transition hover:text-slate-950">{c.nav.industries}</a>
            <a href="#contact" className="transition hover:text-slate-950">{c.nav.contact}</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setLocale(isSinhala ? "en" : "si")}
              className="min-h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
              aria-label="Toggle language"
            >
              {isSinhala ? "English" : "සිංහල"}
            </button>
            <Link href="/login" className="hidden min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 sm:inline-flex">
              {c.nav.signIn}
            </Link>
            <a href="mailto:hello@lakbiz.app" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-teal-600 px-4 text-xs font-bold text-white shadow-[0_8px_22px_rgba(13,148,136,0.2)] transition hover:bg-teal-700 sm:px-5 sm:text-sm">
              {c.nav.demo}
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-white pb-12 pt-28 sm:pt-32 lg:pb-14 lg:pt-36">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(circle_at_84%_10%,rgba(20,184,166,0.16),transparent_31%),radial-gradient(circle_at_18%_8%,rgba(45,212,191,0.08),transparent_25%)]" />
          <div className="pointer-events-none absolute right-[-8rem] top-24 h-[29rem] w-[29rem] rounded-full border border-teal-100" />
          <div className="pointer-events-none absolute right-[-1rem] top-48 h-[18rem] w-[18rem] rounded-full border border-teal-100/80" />

          <div className="relative mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12 xl:gap-16">
              <div className={`text-center lg:text-left ${isSinhala ? "max-w-[670px]" : "max-w-[620px]"}`}>
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50/80 px-4 py-2 text-[11px] font-bold text-teal-800 lg:mx-0">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-[9px] text-white">✓</span>
                  {c.badge}
                </div>

                <h1 className={`mt-6 font-bold tracking-[-0.052em] text-slate-950 ${isSinhala ? "text-[2.35rem] leading-[1.08] sm:text-[2.95rem] lg:text-[3.7rem]" : "text-[2.8rem] leading-[0.98] sm:text-[3.7rem] lg:text-[4.45rem]"}`}>
                  {c.heroTitle}{" "}
                  <span className="text-teal-600">{c.heroAccent}</span>
                </h1>
                <p className={`mx-auto mt-6 max-w-[560px] text-base text-slate-500 sm:text-lg lg:mx-0 ${isSinhala ? "leading-8" : "leading-7 sm:leading-8"}`}>
                  {c.heroDesc}
                </p>

                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                  <a href="mailto:hello@lakbiz.app" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-teal-600 px-7 text-sm font-bold text-white shadow-[0_14px_34px_rgba(13,148,136,0.22)] transition hover:bg-teal-700">
                    {c.primaryCta}<span className="ml-2">→</span>
                  </a>
                  <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-7 text-sm font-bold text-slate-800 shadow-[0_6px_20px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:bg-slate-50">
                    {c.secondaryCta}
                  </Link>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500 lg:justify-start">
                  {c.heroTrust.map((item) => (
                    <span key={item} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <ProductShowcase locale={locale} />
            </div>
          </div>
        </section>

        <section id="solutions" className="relative z-10 bg-white pb-14">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="grid overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-[0_16px_55px_rgba(15,23,42,0.07)] sm:grid-cols-2 lg:grid-cols-5">
              {c.capabilities.map(([title, desc], index) => {
                const Icon = CAPABILITY_ICONS[index];
                return (
                  <div key={title} className={`flex gap-3.5 px-5 py-5 ${index > 0 ? "border-t border-slate-100 sm:border-l sm:border-t-0" : ""}`}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100"><Icon className="h-5 w-5" /></span>
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

        <section id="features" className="scroll-mt-24 bg-[#f4f7fa] py-16 lg:py-20">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <SectionHeading eyebrow={c.featuresEyebrow} title={c.featuresTitle} description={c.featuresDesc} compact={isSinhala} />

            <div className="mt-10 grid gap-4 lg:grid-cols-12">
              <FeatureStory
                title={c.features[0][0]}
                description={c.features[0][1]}
                Icon={FEATURE_ICONS[0]}
                dark
                className="lg:col-span-7 lg:row-span-2"
              >
                <div className="mt-8 grid gap-3 sm:grid-cols-[1.25fr_0.75fr]">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">{isSinhala ? "අද" : "Today"}</span>
                      <span className="rounded-full bg-teal-300/10 px-2.5 py-1 text-[10px] font-bold text-teal-300">{isSinhala ? "සජීවී" : "LIVE"}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {["Rs. 45,680", isSinhala ? "බිල් 32" : "32 bills", "Rs. 12,340"].map((value) => (
                        <div key={value} className="rounded-xl bg-white/[0.045] px-3 py-3 text-sm font-bold text-white">{value}</div>
                      ))}
                    </div>
                    <div className="mt-4 h-20 rounded-xl bg-[linear-gradient(180deg,rgba(45,212,191,0.15),rgba(45,212,191,0.02))] p-3">
                      <svg viewBox="0 0 360 70" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
                        <path d="M0 58 C40 55 55 32 92 40 C130 48 142 20 180 31 C220 43 240 13 275 23 C312 33 328 8 360 14" fill="none" stroke="#5eead4" strokeWidth="3.5" strokeLinecap="round" />
                      </svg>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {salesStoryItems.map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm font-semibold text-slate-300">
                        <span className="h-2 w-2 rounded-full bg-teal-300" />{item}
                      </div>
                    ))}
                  </div>
                </div>
              </FeatureStory>

              <FeatureStory
                title={c.features[1][0]}
                description={c.features[1][1]}
                Icon={FEATURE_ICONS[1]}
                className="lg:col-span-5"
              >
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {stockMetrics.map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-inset ring-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                      <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
                    </div>
                  ))}
                </div>
              </FeatureStory>

              <FeatureStory
                title={c.features[2][0]}
                description={c.features[2][1]}
                Icon={FEATURE_ICONS[2]}
                className="lg:col-span-5"
              >
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  {billingRows.map(([label, value], index) => (
                    <div key={label} className={`flex items-center justify-between py-2 text-sm ${index > 0 ? "border-t border-slate-200/70" : ""}`}>
                      <span className="font-medium text-slate-600">{label}</span>
                      <span className="font-bold text-slate-950">{value}</span>
                    </div>
                  ))}
                </div>
              </FeatureStory>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {c.features.slice(3).map(([title, desc], index) => {
                const Icon = FEATURE_ICONS[index + 3];
                return (
                  <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_26px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon className="h-5 w-5" /></span>
                    <h3 className="mt-4 text-base font-bold tracking-tight text-slate-950">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="industries" className="scroll-mt-24 bg-[#07111f] py-16 text-white lg:py-20">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div className="max-w-3xl">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-300">{c.industriesEyebrow}</p>
                <h2 className={`mt-3 font-bold tracking-[-0.045em] text-white ${isSinhala ? "text-[2rem] leading-[1.12] sm:text-[2.55rem] lg:text-[2.75rem]" : "text-3xl sm:text-4xl lg:text-[3rem]"}`}>{c.industriesTitle}</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-400 lg:justify-self-end">{c.industriesDesc}</p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sectors.map((sector, index) => {
                const desc = c.industryDescriptions[sector.id as keyof typeof c.industryDescriptions] ?? sector.description;
                return (
                  <article key={sector.id} className="group relative overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-6 transition duration-200 hover:-translate-y-0.5 hover:border-teal-300/25 hover:bg-white/[0.055]">
                    <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br ${INDUSTRY_ACCENTS[index % INDUSTRY_ACCENTS.length]}`} />
                    <div className="relative flex items-start justify-between gap-4">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.07] text-teal-300 ring-1 ring-inset ring-white/[0.08]"><SectorIcon sectorId={sector.id} className="h-6 w-6" /></span>
                      <span className="text-sm text-slate-600 transition group-hover:text-teal-300">↗</span>
                    </div>
                    <h3 className="relative mt-7 text-xl font-bold tracking-tight text-white">{isSinhala ? sector.nameSi : sector.nameEn}</h3>
                    <p className="relative mt-2 max-w-md text-sm leading-6 text-slate-400">{desc}</p>
                    <div className="relative mt-5 flex flex-wrap gap-2">
                      {sector.reports.slice(0, 2).map((report) => (
                        <span key={report} className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold text-slate-500">{industryReportLabel(report, locale)}</span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="plans" className="scroll-mt-24 bg-[#eef3f6] py-16 lg:py-20">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-10">
            <SectionHeading eyebrow={c.pricingEyebrow} title={c.pricingTitle} description={c.pricingDesc} compact={isSinhala} />

            <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-3 lg:gap-6">
              {PLANS.map((plan) => {
                const highlight = plan.highlight;
                const enabledRows = PLAN_FEATURE_ROWS.filter((row) => plan.features[row.flag]);
                const planName = isSinhala ? plan.nameSi : plan.nameEn;
                const planDesc = c.planDescriptions[plan.id as keyof typeof c.planDescriptions] ?? "";
                return (
                  <article key={plan.id} className={`relative flex flex-col overflow-hidden rounded-[1.45rem] border bg-white ${highlight ? "border-teal-400 shadow-[0_26px_70px_rgba(13,148,136,0.16)] ring-1 ring-teal-200 lg:-translate-y-3" : "border-slate-200 shadow-[0_10px_34px_rgba(15,23,42,0.05)]"}`}>
                    {highlight && <div className="bg-teal-600 px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.16em] text-white">{c.mostPopular}</div>}
                    <div className="flex flex-1 flex-col p-6 sm:p-7">
                      <div>
                        <h3 className="text-xl font-bold text-slate-950">{planName}</h3>
                        <p className="mt-1 text-sm text-slate-500">{planDesc}</p>
                        <p className="mt-5 text-[2.65rem] font-bold tracking-[-0.05em] text-teal-700">
                          {formatLkrPrice(plan.priceMonthlyLkr)}
                          <span className="ml-1 text-sm font-semibold tracking-normal text-slate-400">/month</span>
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-100">
                            {isSinhala ? `පරිශීලකයින් ${plan.maxUsers} දක්වා` : `Up to ${plan.maxUsers} ${plan.maxUsers === 1 ? "user" : "users"}`}
                          </span>
                          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-100">
                            {isSinhala ? `ශාඛා ${plan.maxBranches}` : `${plan.maxBranches} ${plan.maxBranches === 1 ? "branch" : "branches"}`}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-slate-100 pt-5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{c.includes}</p>
                        <ul className="mt-4 space-y-2.5">
                          {enabledRows.slice(0, highlight ? 8 : 7).map((row) => (
                            <li key={row.flag} className="flex items-center gap-2.5 text-sm text-slate-600">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-50 text-[9px] font-bold text-teal-700">✓</span>
                              {isSinhala ? row.si : row.en}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <a href="mailto:hello@lakbiz.app" className={`mt-7 inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold transition ${highlight ? "bg-teal-600 text-white shadow-[0_12px_28px_rgba(13,148,136,0.2)] hover:bg-teal-700" : "border border-teal-300 bg-white text-teal-700 hover:bg-teal-50"}`}>
                        {c.planCta}
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">{c.planFootnote}</p>
          </div>
        </section>

        <section className="bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-[1380px] px-4 sm:px-6 lg:px-10">
            <div className="relative overflow-hidden rounded-[1.8rem] bg-[#07111f] px-6 py-10 text-white shadow-[0_28px_70px_rgba(7,17,31,0.16)] sm:px-9 lg:px-12 lg:py-12">
              <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border border-teal-300/10" />
              <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
                <div className="max-w-xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-300">{c.proofEyebrow}</p>
                  <h2 className={`mt-3 font-bold tracking-[-0.045em] text-white ${isSinhala ? "text-[2rem] leading-[1.12] sm:text-[2.5rem]" : "text-3xl sm:text-4xl"}`}>{c.proofTitle}</h2>
                  <p className="mt-4 text-sm leading-6 text-slate-400">{c.proofDesc}</p>
                </div>
                <div className="grid gap-x-7 gap-y-6 sm:grid-cols-2">
                  {c.proofItems.map(([title, desc], index) => {
                    const Icon = PROOF_ICONS[index];
                    return (
                      <div key={title} className="flex gap-3.5 border-t border-white/[0.08] pt-5 first:border-t-0 first:pt-0 sm:first:border-t sm:first:pt-5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-300/10 text-teal-300 ring-1 ring-inset ring-teal-300/10"><Icon className="h-5 w-5" /></span>
                        <div>
                          <h3 className="text-sm font-bold text-white">{title}</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-24 bg-white pb-16 lg:pb-20">
          <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10">
            <div className="relative overflow-hidden rounded-[1.8rem] bg-[linear-gradient(110deg,#075c61_0%,#0d9488_58%,#08796f_100%)] px-6 py-10 text-white shadow-[0_28px_70px_rgba(6,78,84,0.2)] sm:px-9 lg:px-12 lg:py-12">
              <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-white/10" />
              <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-100">{c.ctaEyebrow}</p>
                  <h2 className={`mt-3 font-bold tracking-[-0.045em] ${isSinhala ? "text-[2rem] leading-[1.12] sm:text-[2.6rem]" : "text-3xl sm:text-4xl"}`}>{c.ctaTitle}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-teal-50/80">{c.ctaDesc}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
                  <a href="mailto:hello@lakbiz.app" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-teal-800 shadow-[0_10px_26px_rgba(4,47,46,0.16)] transition hover:bg-teal-50">{c.ctaPrimary}<span className="ml-2">→</span></a>
                  <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 bg-white/[0.06] px-6 text-sm font-bold text-white transition hover:bg-white/[0.12]">{c.ctaSecondary}</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#07111f] text-slate-400">
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
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
                <a href="mailto:hello@lakbiz.app" className="hover:text-white">{c.nav.demo}</a>
                <Link href="/login" className="hover:text-white">{c.nav.signIn}</Link>
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

function SectionHeading({ eyebrow, title, description, compact = false }: { eyebrow: string; title: string; description?: string; compact?: boolean }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.19em] text-teal-700">{eyebrow}</p>
      <h2 className={`mt-3 font-bold tracking-[-0.045em] text-slate-950 ${compact ? "text-[2rem] leading-[1.12] sm:text-[2.5rem] lg:text-[2.65rem]" : "text-3xl sm:text-4xl lg:text-[2.8rem]"}`}>{title}</h2>
      {description && <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
    </div>
  );
}

function FeatureStory({
  title,
  description,
  Icon,
  dark = false,
  className = "",
  children,
}: {
  title: string;
  description: string;
  Icon: typeof SalesIcon;
  dark?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <article className={`relative overflow-hidden rounded-[1.55rem] border p-6 shadow-[0_12px_36px_rgba(15,23,42,0.055)] sm:p-7 ${dark ? "border-slate-900 bg-[#07111f] text-white" : "border-slate-200 bg-white"} ${className}`}>
      {dark && <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-teal-300/10 blur-3xl" />}
      <div className="relative">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${dark ? "bg-teal-300/10 text-teal-300 ring-1 ring-inset ring-teal-300/10" : "bg-teal-50 text-teal-700"}`}><Icon className="h-5 w-5" /></span>
        <h3 className={`mt-5 text-xl font-bold tracking-tight sm:text-2xl ${dark ? "text-white" : "text-slate-950"}`}>{title}</h3>
        <p className={`mt-2 max-w-2xl text-sm leading-6 ${dark ? "text-slate-400" : "text-slate-500"}`}>{description}</p>
        {children}
      </div>
    </article>
  );
}

function ProductShowcase({ locale }: { locale: string }) {
  const isSinhala = locale === "si";
  const stats = isSinhala
    ? [
        ["අද විකුණුම්", "Rs. 45,680", "සජීවී"],
        ["ලාභය", "Rs. 12,340", "Track කර ඇත"],
        ["බිල්", "32", "සූදානම්"],
        ["මුදල්", "Rs. 128,750", "ලබා ගත හැක"],
      ]
    : [
        ["Today sales", "Rs. 45,680", "Live"],
        ["Profit", "Rs. 12,340", "Tracked"],
        ["Bills", "32", "Ready"],
        ["Cash", "Rs. 128,750", "Available"],
      ];
  const navItems = isSinhala
    ? ["මුල් පුවරුව", "විකුණුම්", "තොග", "ගනුදෙනුකරුවන්", "බිල්", "VAT වාර්තාව"]
    : ["Dashboard", "Sales", "Stock", "Customers", "Bills", "VAT return"];
  const sideCards = isSinhala
    ? [["අඩු තොග", "Cooking Oil 5L", "ඒකක 2 ඉතිරි"], ["ලැබිය යුතු", "Rs. 85,420", "Credit customers"], ["ගෙවිය යුතු VAT", "Rs. 9,500", "මෙම කාර්තුව"]]
    : [["LOW STOCK", "Cooking Oil 5L", "2 units left"], ["RECEIVABLES", "Rs. 85,420", "Credit customers"], ["VAT PAYABLE", "Rs. 9,500", "This quarter"]];

  return (
    <div className="relative mx-auto w-full max-w-[840px] pb-12" aria-hidden="true">
      <div className="absolute inset-x-16 bottom-4 h-24 rounded-full bg-teal-200/65 blur-3xl" />
      <div className="relative ml-auto w-[94%] rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-[0_38px_90px_rgba(15,23,42,0.17)]">
        <div className="overflow-hidden rounded-[1.3rem] border border-slate-200 bg-white">
          <div className="flex h-11 items-center gap-2 bg-slate-950 px-4">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="ml-3 hidden rounded-full bg-white/[0.07] px-3 py-1 text-[9px] font-medium text-slate-500 sm:block">lakbiz.app/dashboard</span>
          </div>

          <div className="grid min-h-[31rem] grid-cols-[5.5rem_1fr] bg-[#f6f8fb] sm:grid-cols-[10rem_1fr]">
            <aside className="bg-[#07111f] px-2.5 py-5 sm:px-4">
              <p className="mb-5 px-2 text-xs font-bold text-teal-300 sm:text-base">LakBiz</p>
              {navItems.map((item, index) => (
                <div key={item} className={`mb-1.5 rounded-lg px-2 py-2 text-[8px] font-semibold sm:px-2.5 sm:text-[10px] ${index === 0 ? "bg-teal-400/15 text-white" : "text-slate-600"}`}>{item}</div>
              ))}
            </aside>

            <div className="min-w-0 p-3 sm:p-5 lg:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="hidden h-9 flex-1 items-center rounded-xl border border-slate-200 bg-white px-3 text-[10px] text-slate-400 shadow-sm sm:flex">{isSinhala ? "ගනුදෙනු, භාණ්ඩ සහ ගනුදෙනුකරුවන් සොයන්න…" : "Search transactions, products, customers…"}</div>
                <div className="ml-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                  <span className="h-6 w-6 rounded-full bg-teal-100" />
                  <span className="hidden text-[10px] font-semibold text-slate-700 md:block">{isSinhala ? "වෙළඳසැල" : "Customer Shop"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {stats.map(([label, value, hint]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_4px_14px_rgba(15,23,42,0.045)]">
                    <p className="truncate text-[8px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-1.5 truncate text-xs font-bold text-slate-950 sm:text-sm">{value}</p>
                    <p className="mt-1 text-[8px] font-semibold text-teal-600">{hint}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[1.5fr_0.7fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-slate-800 sm:text-xs">{isSinhala ? "විකුණුම් විශ්ලේෂණය" : "Sales analytics"}</p>
                    <span className="rounded-full bg-slate-50 px-2 py-1 text-[8px] font-semibold text-slate-400">{isSinhala ? "මේ සතිය" : "This week"}</span>
                  </div>
                  <div className="mt-5 h-44 sm:h-52">
                    <svg viewBox="0 0 500 190" className="h-full w-full" preserveAspectRatio="none">
                      <defs><linearGradient id="heroChart" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity="0.22" /><stop offset="100%" stopColor="#14b8a6" stopOpacity="0" /></linearGradient></defs>
                      {[42, 84, 126, 168].map((y) => <line key={y} x1="0" x2="500" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />)}
                      <path d="M0 160 C55 142 72 118 122 126 C170 134 190 98 235 108 C288 120 302 70 355 84 C400 96 425 45 500 58 L500 190 L0 190 Z" fill="url(#heroChart)" />
                      <path d="M0 160 C55 142 72 118 122 126 C170 134 190 98 235 108 C288 120 302 70 355 84 C400 96 425 45 500 58" fill="none" stroke="#0d9488" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>

                <div className="hidden space-y-3 md:block">
                  {sideCards.map(([label, value, hint]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]">
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

      <div className="absolute -bottom-1 left-2 w-[8.5rem] rounded-[1.65rem] border-[5px] border-slate-950 bg-white p-2 shadow-[0_24px_58px_rgba(15,23,42,0.24)] sm:-left-3 sm:w-[10.6rem]">
        <div className="mx-auto mb-2 h-1.5 w-11 rounded-full bg-slate-200" />
        <div className="flex items-center justify-between px-1">
          <p className="text-[8px] font-bold text-slate-950">LakBiz</p>
          <span className="h-2 w-2 rounded-full bg-teal-500" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 p-1.5">
              <p className="truncate text-[5px] font-semibold text-slate-400">{label}</p>
              <p className="mt-0.5 truncate text-[7px] font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-lg bg-teal-600 px-2 py-2 text-center text-[6px] font-bold text-white">{isSinhala ? "ඉක්මන් විකිණීම" : "Quick sale"}</div>
      </div>
    </div>
  );
}
