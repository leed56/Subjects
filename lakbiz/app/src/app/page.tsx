import Link from "next/link";

const features = [
  {
    title: "Sales, stock and billing",
    desc: "Run daily sales, stock, invoices, credit customers, suppliers and purchase records from one clean system.",
    icon: "POS",
  },
  {
    title: "Sri Lanka VAT ready",
    desc: "Track output VAT, input VAT and quarterly summaries using your shop settings and real business data.",
    icon: "VAT",
  },
  {
    title: "Banking and cheques",
    desc: "Manage bank accounts, received cheques, paid cheques and cheque status flows for local businesses.",
    icon: "BANK",
  },
  {
    title: "Sector modules",
    desc: "Use AC service jobs, vehicle showroom, customer CRM and supplier ledgers when your business plan includes them.",
    icon: "PRO",
  },
];

const sectors = [
  "Retail shops",
  "Supermarkets",
  "Electronics",
  "Electricals",
  "Spare parts",
  "AC service",
  "Vehicle dealers",
  "Wholesalers",
];

const steps = [
  "Pay manually by cash or bank transfer",
  "LakBiz admin creates your shop account",
  "Receive your login details",
  "Start using your assigned modules",
];

const plans = [
  { name: "Starter", price: "Rs. 1,490 / month", detail: "Sales, stock and bills for small shops" },
  { name: "Business", price: "Rs. 2,990 / month", detail: "Customers, suppliers and banking included" },
  { name: "Pro", price: "Rs. 4,990 / month", detail: "AC jobs, vehicles and advanced modules" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-slate-50 text-slate-950">
      <MarketingNav />
      <main>
        <section className="relative pt-28 sm:pt-32 lg:pt-36">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[58rem] -translate-x-1/2 rounded-full bg-teal-200/40 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
              <div className="text-center lg:text-left">
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-4 py-2 text-xs font-black text-teal-800 shadow-sm lg:mx-0">
                  Admin-managed SaaS for Sri Lankan SMEs
                </div>
                <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl lg:leading-[1.02]">
                  LakBiz business software with accounts created by our team
                </h1>
                <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg lg:mx-0">
                  We set up your shop, plan and login after manual payment. Your team signs in and uses only the modules assigned to your business.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-2xl bg-teal-600 px-7 py-4 text-sm font-black text-white shadow-xl shadow-teal-700/20 transition hover:-translate-y-0.5 hover:bg-teal-700"
                  >
                    Customer sign in <span className="ml-2">→</span>
                  </Link>
                  <a
                    href="#contact"
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-7 py-4 text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-800"
                  >
                    Request access
                  </a>
                </div>
                <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500 lg:justify-start">
                  <span>Manual cash / bank payment</span>
                  <span>Admin-created accounts</span>
                  <span>No public signup</span>
                </div>
              </div>
              <ProductPreview />
            </div>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step} className="rounded-[1.5rem] border border-white bg-white p-5 shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/60">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-sm font-black text-teal-700">
                  {index + 1}
                </div>
                <p className="mt-4 text-sm font-black text-slate-900">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">Features</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Everything needed for daily shop operations</h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-[1.75rem] border border-white bg-white p-6 shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/60">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-xs font-black text-teal-300">{feature.icon}</div>
                <h3 className="mt-5 text-lg font-black text-slate-950">{feature.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="solutions" className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/20 sm:p-10">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-300">Sectors</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Configured for your business type</h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {sectors.map((sector) => (
                <div key={sector} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200">{sector}</div>
              ))}
            </div>
          </div>
        </section>

        <section id="plans" className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">Plans</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Plans are assigned manually by LakBiz admin</h2>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">Customers cannot self-upgrade online. Contact us, pay manually, and we update your shop plan from the platform admin panel.</p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.name} className="rounded-[1.75rem] border border-white bg-white p-6 shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/60">
                <h3 className="text-xl font-black text-slate-950">{plan.name}</h3>
                <p className="mt-3 text-2xl font-black text-teal-700">{plan.price}</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{plan.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="mx-auto my-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] bg-gradient-to-br from-teal-600 to-emerald-700 p-8 text-white shadow-2xl shadow-teal-900/20 sm:p-12">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-100">Get access</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Pay manually and we create your LakBiz login</h2>
              <p className="mt-4 text-base font-semibold leading-7 text-teal-50">Contact the LakBiz team to create your shop, choose the correct plan, and receive your login details.</p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 text-sm font-black text-teal-800 shadow-xl shadow-teal-950/10">Sign in</Link>
              <Link href="/login?next=/admin" className="inline-flex items-center justify-center rounded-2xl border border-white/30 px-7 py-4 text-sm font-black text-white hover:bg-white/10">Platform admin</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function MarketingNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/70 bg-white/85 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-700 text-sm font-black text-white shadow-lg shadow-teal-700/20">L</span>
          <div className="leading-tight">
            <span className="block text-xl font-black tracking-tight text-teal-700">LakBiz</span>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:block">Sri Lanka</span>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 lg:flex">
          <a href="#features" className="transition hover:text-teal-700">Features</a>
          <a href="#solutions" className="transition hover:text-teal-700">Solutions</a>
          <a href="#plans" className="transition hover:text-teal-700">Plans</a>
          <a href="#contact" className="transition hover:text-teal-700">Contact</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="hidden text-sm font-semibold text-slate-600 transition hover:text-teal-700 sm:inline-flex">Sign in</Link>
          <a href="#contact" className="inline-flex items-center justify-center rounded-full bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700 sm:px-5 sm:text-sm">Request access</a>
        </div>
      </div>
    </header>
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
            <span className="ml-3 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-slate-300">lakbiz.app/dashboard</span>
          </div>
          <div className="grid min-h-[25rem] grid-cols-[5.5rem_1fr] bg-slate-50 sm:grid-cols-[10rem_1fr]">
            <aside className="bg-slate-950 p-3 text-white sm:p-4">
              <p className="mb-5 text-sm font-black text-teal-300 sm:text-lg">LakBiz</p>
              {["Dashboard", "Sales", "Stock", "Customers", "Bills", "VAT"].map((item, index) => (
                <div key={item} className={`mb-2 rounded-xl px-2 py-2 text-[9px] font-bold sm:px-3 sm:text-xs ${index === 0 ? "bg-teal-500 text-white" : "text-slate-400"}`}>{item}</div>
              ))}
            </aside>
            <div className="p-3 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="hidden h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-400 sm:flex sm:items-center">Search transactions, customers, products...</div>
                <div className="ml-auto flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm">
                  <span className="h-7 w-7 rounded-full bg-gradient-to-br from-teal-100 to-emerald-100" />
                  <span className="hidden text-xs font-bold sm:block">Customer Shop</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {[["Today Sales", "Rs. 45,680", "Live"], ["Profit", "Rs. 12,340", "Tracked"], ["Bills", "32", "Ready"], ["Cash", "Rs. 128,750", "Available"]].map(([label, value, hint]) => (
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
                        <span className="text-[8px] font-semibold text-slate-400">{["M", "T", "W", "T", "F", "S", "S"][index]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <MiniPanel title="Low Stock Alert" value="Cooking Oil 5L" hint="2 units left" />
                  <MiniPanel title="Receivables" value="Rs. 85,420" hint="Credit customers" />
                  <MiniPanel title="VAT Payable" value="Rs. 9,500" hint="This quarter" />
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
