import Link from "next/link";

const stats = [
  { value: "10,000+", label: "Active businesses", icon: "👥" },
  { value: "2M+", label: "Invoices generated", icon: "🧾" },
  { value: "25M+", label: "Items sold", icon: "📦" },
  { value: "98.5%", label: "Customer satisfaction", icon: "💚" },
  { value: "24/7", label: "Local support", icon: "🎧" },
];

const features = [
  {
    title: "Sales & Billing",
    desc: "Create fast invoices, manage POS sales, payments, discounts and customer history in one clean workflow.",
    icon: "🧾",
  },
  {
    title: "Stock Management",
    desc: "Track real-time inventory, stock-in, low-stock alerts, suppliers and purchase history without spreadsheets.",
    icon: "📦",
  },
  {
    title: "VAT Compliance",
    desc: "Prepare output VAT, input VAT and quarterly summaries so your business stays ready for reporting.",
    icon: "VAT",
  },
  {
    title: "Customers & Credit",
    desc: "Manage credit balances, receivables, payment reminders and customer records with better visibility.",
    icon: "🤝",
  },
  {
    title: "Reports & Insights",
    desc: "Understand sales, profit, slow stock, payables and business health from one modern dashboard.",
    icon: "📊",
  },
  {
    title: "Multi-Sector Ready",
    desc: "Built for retail shops, supermarkets, AC service, vehicle sales, suppliers and growing SMEs.",
    icon: "🏪",
  },
];

const sectors = [
  "Retail shops",
  "Supermarkets",
  "Restaurants",
  "Pharmacies",
  "Wholesalers",
  "Service centers",
  "Vehicle dealers",
  "Distributors",
];

const testimonials = [
  {
    quote:
      "LakBiz makes billing faster and stock easier to control. It feels built for how Sri Lankan shops actually work.",
    name: "Nimal Perera",
    role: "Retail Shop Owner, Kandy",
  },
  {
    quote:
      "The dashboard gives us sales, credit and VAT visibility without calling the accountant every day.",
    name: "Shanika Fernando",
    role: "Supermarket Owner, Galle",
  },
  {
    quote:
      "Clean, simple and practical. Our team learned it quickly and now uses it for daily operations.",
    name: "Ruwan Dias",
    role: "Distributor, Colombo",
  },
];

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#solutions", label: "Solutions" },
  { href: "/settings/billing", label: "Pricing" },
  { href: "#testimonials", label: "Testimonials" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#f8fafc] text-slate-950 pb-24 sm:pb-0">
      <MarketingNav />
      <main>
        <HeroSection />
        <StatsStrip />
        <FeatureSection />
        <SolutionsSection />
        <TestimonialsSection />
        <FinalCta />
      </main>
      <LandingFooter />
      <MobileStickyCta />
    </div>
  );
}

function MarketingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/70 bg-white/85 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-700 text-sm font-black text-white shadow-lg shadow-teal-700/20">
            L
          </span>
          <div className="leading-tight">
            <span className="block text-xl font-black tracking-tight text-teal-700">
              LakBiz
            </span>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:block">
              Sri Lanka
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 lg:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-teal-700">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-semibold text-slate-600 transition hover:text-teal-700 sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700 sm:px-5 sm:text-sm"
          >
            Start free trial
          </Link>
          <Link
            href="#features"
            aria-label="Open page menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 lg:hidden"
          >
            ☰
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative pt-28 sm:pt-32 lg:pt-36">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[58rem] -translate-x-1/2 rounded-full bg-teal-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-24 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div className="text-center lg:text-left">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-4 py-2 text-xs font-bold text-teal-800 shadow-sm lg:mx-0">
              <span>🇱🇰</span>
              #1 business management platform for Sri Lankan SMEs
            </div>

            <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl lg:leading-[1.02]">
              Simplify sales, stock, billing, VAT and grow your business with{" "}
              <span className="bg-gradient-to-r from-teal-600 to-emerald-500 bg-clip-text text-transparent">
                LakBiz
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg lg:mx-0">
              A modern all-in-one platform for shops and SMEs to manage sales,
              inventory, customers, accounts, VAT, payments and daily operations from
              any device.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-2xl bg-teal-600 px-7 py-4 text-sm font-black text-white shadow-xl shadow-teal-700/20 transition hover:-translate-y-0.5 hover:bg-teal-700"
              >
                Get started free <span className="ml-2">→</span>
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-7 py-4 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-800"
              >
                Watch demo <span className="ml-2">▶</span>
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500 lg:justify-start">
              <span className="flex items-center gap-1.5"><CheckIcon />14-day free trial</span>
              <span className="flex items-center gap-1.5"><CheckIcon />No credit card required</span>
              <span className="flex items-center gap-1.5"><CheckIcon />Cancel anytime</span>
            </div>
          </div>

          <ProductPreview />
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
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
              {[
                "Dashboard",
                "Sales",
                "Stock",
                "Customers",
                "Bills",
                "Reports",
              ].map((item, index) => (
                <div
                  key={item}
                  className={`mb-2 rounded-xl px-2 py-2 text-[9px] font-bold sm:px-3 sm:text-xs ${
                    index === 0 ? "bg-teal-500 text-white" : "text-slate-400"
                  }`}
                >
                  {item}
                </div>
              ))}
              <div className="mt-10 hidden rounded-2xl border border-amber-300/20 bg-white/5 p-3 sm:block">
                <p className="text-lg">👑</p>
                <p className="mt-1 text-xs font-bold">Premium</p>
                <p className="mt-1 text-[10px] text-slate-400">Upgrade for advanced reports.</p>
              </div>
            </aside>
            <div className="p-3 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="hidden h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-400 sm:flex sm:items-center">
                  Search transactions, customers, products...
                </div>
                <div className="ml-auto flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm">
                  <span className="h-7 w-7 rounded-full bg-gradient-to-br from-teal-100 to-emerald-100" />
                  <span className="hidden text-xs font-bold sm:block">Demo Store</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Today Sales", "Rs. 45,680", "↗ 18.6%"],
                  ["Profit", "Rs. 12,340", "↗ 21.4%"],
                  ["Orders", "32", "↗ 14.3%"],
                  ["Cash", "Rs. 128,750", "Available"],
                ].map(([label, value, hint]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-black text-slate-950 sm:text-base">{value}</p>
                    <p className="mt-1 text-[9px] font-semibold text-teal-600">{hint}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_0.8fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-slate-900">Sales Analytics</p>
                    <span className="rounded-full border border-slate-200 px-2 py-1 text-[9px] font-bold text-slate-500">This week</span>
                  </div>
                  <div className="mt-6 flex h-32 items-end gap-2 sm:h-40">
                    {[35, 58, 46, 50, 66, 92, 52].map((height, index) => (
                      <div key={index} className="flex flex-1 flex-col items-center gap-2">
                        <div className="w-full rounded-t-xl bg-gradient-to-t from-teal-100 to-teal-500" style={{ height: `${height}%` }} />
                        <span className="text-[8px] font-semibold text-slate-400">
                          {["M", "T", "W", "T", "F", "S", "S"][index]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <MiniPanel title="Low Stock Alert" value="Cooking Oil 5L" hint="2 units left" tone="red" />
                  <MiniPanel title="Receivables" value="Rs. 85,420" hint="Top dues tracked" />
                  <MiniPanel title="VAT Payable" value="Rs. 9,500" hint="This month" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-8 right-2 hidden w-44 rounded-[2rem] border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-950/20 md:block">
        <div className="rounded-[1.5rem] bg-slate-50 p-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-black text-teal-700">LakBiz</span>
            <span className="text-xs">☰</span>
          </div>
          <p className="text-[10px] font-semibold text-slate-500">Good morning</p>
          <p className="text-sm font-black text-slate-950">Demo Store</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {["Rs.45k", "Rs.12k", "32", "Rs.128k"].map((item) => (
              <div key={item} className="rounded-xl bg-white p-2 text-center shadow-sm">
                <p className="text-[10px] font-black text-slate-900">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 h-16 rounded-xl bg-gradient-to-t from-teal-100 to-white p-2">
            <div className="mt-8 h-1 rounded-full bg-teal-500" />
            <div className="mt-2 h-1 w-3/4 rounded-full bg-teal-300" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniPanel({ title, value, hint, tone = "teal" }: { title: string; value: string; hint: string; tone?: "teal" | "red" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
      <p className={`mt-1 text-[10px] font-bold ${tone === "red" ? "text-red-500" : "text-teal-600"}`}>{hint}</p>
    </div>
  );
}

function StatsStrip() {
  return (
    <section className="relative z-10 pt-16 sm:pt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-3 rounded-[2rem] border border-slate-200 bg-white/90 p-3 shadow-xl shadow-slate-950/5 backdrop-blur md:grid-cols-5">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 rounded-3xl bg-slate-50 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-lg shadow-sm">
                {stat.icon}
              </span>
              <div>
                <p className="text-xl font-black text-slate-950">{stat.value}</p>
                <p className="text-xs font-semibold text-slate-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureSection() {
  return (
    <section id="features" className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Powerful features"
          title="Everything you need to run your business"
          desc="LakBiz brings daily operations together in one simple, responsive and professional platform."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="group rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-900/5"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-base font-black text-teal-700 ring-1 ring-teal-100">
                {feature.icon}
              </div>
              <h3 className="mt-5 text-lg font-black text-slate-950">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{feature.desc}</p>
              <Link href="/login" className="mt-5 inline-flex text-sm font-black text-teal-700">
                Learn more →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SolutionsSection() {
  return (
    <section id="solutions" className="border-y border-slate-200 bg-white py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <SectionHeading
            eyebrow="Built for every business"
            title="Perfect for shops and SMEs of all sizes"
            desc="Start simple with daily billing and stock. Grow into reports, accounts, VAT, credit, staff access and multi-branch operations."
          />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/sectors" className="rounded-2xl bg-slate-950 px-6 py-3 text-center text-sm font-black text-white shadow-lg shadow-slate-950/10">
              Explore sectors
            </Link>
            <Link href="/settings/billing" className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-center text-sm font-black text-slate-800">
              View pricing
            </Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sectors.map((sector, index) => (
            <div key={sector} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">
                {["🏪", "🛒", "🍽️", "💊", "📦", "🛠️", "🚗", "🚚"][index]}
              </div>
              <p className="mt-4 text-sm font-black text-slate-900">{sector}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Loved by businesses"
          title="Made for Sri Lankan teams who move fast"
          desc="A clean experience for owners, cashiers, stock managers, service teams and admins."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {testimonials.map((item) => (
            <article key={item.name} className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-amber-400">★★★★★</p>
              <p className="mt-4 text-sm leading-7 text-slate-700">“{item.quote}”</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-teal-100 to-emerald-100 text-sm font-black text-teal-700">
                  {item.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-950">{item.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{item.role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="pb-16 sm:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-12 shadow-2xl shadow-slate-950/20 sm:px-10 lg:px-14">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="absolute -bottom-24 left-20 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-black text-amber-200">
                👑 Premium-ready business platform
              </div>
              <h2 className="mt-5 max-w-2xl text-3xl font-black tracking-tight text-white sm:text-4xl">
                Ready to simplify your business operations?
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Join growing Sri Lankan businesses using LakBiz to manage billing,
                stock, VAT, payments and reports from one responsive system.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Link href="/login" className="rounded-2xl bg-teal-500 px-7 py-4 text-center text-sm font-black text-white shadow-lg shadow-teal-950/30 transition hover:bg-teal-400">
                Start free trial →
              </Link>
              <Link href="/dashboard" className="rounded-2xl border border-white/20 px-7 py-4 text-center text-sm font-black text-white transition hover:bg-white/10">
                View live demo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
        <div>
          <p className="text-lg font-black text-teal-700">LakBiz</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Sales, stock, billing and VAT for Sri Lankan SMEs.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4 text-xs font-bold text-slate-500">
          <Link href="/login" className="hover:text-teal-700">Login</Link>
          <Link href="/dashboard" className="hover:text-teal-700">Demo</Link>
          <Link href="/settings/billing" className="hover:text-teal-700">Pricing</Link>
          <Link href="/sectors" className="hover:text-teal-700">Sectors</Link>
        </div>
      </div>
    </footer>
  );
}

function MobileStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-xl safe-area-pb sm:hidden">
      <div className="mx-auto flex max-w-lg gap-2">
        <Link href="/login" className="flex flex-1 items-center justify-center rounded-xl bg-teal-600 py-3.5 text-sm font-black text-white shadow-lg shadow-teal-600/25">
          Start free
        </Link>
        <Link href="/dashboard" className="flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3.5 text-sm font-bold text-slate-700">
          Demo
        </Link>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-600">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-8 text-slate-600">{desc}</p>
    </div>
  );
}

function CheckIcon() {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-teal-100 text-[10px] text-teal-700">
      ✓
    </span>
  );
}
