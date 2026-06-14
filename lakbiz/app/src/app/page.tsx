import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SectorCard } from "@/components/sector-card";
import { sectors, bankingModules } from "@/lib/sectors";

export default function Home() {
  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <section className="rounded-2xl bg-gradient-to-br from-teal-800 to-teal-950 px-8 py-12 text-white">
          <p className="text-sm font-medium text-teal-200">
            Stock · Sales · Banking — Sri Lanka
          </p>
          <h1 className="mt-2 max-w-2xl text-4xl font-bold leading-tight">
            One app for your shop, AC business, or car lot
          </h1>
          <p className="mt-2 text-lg text-teal-100">
            තොග · විකුණුම් · බැංකු — ඔබේ ව්‍යාපාරය එකම තැනින්
          </p>
          <p className="mt-4 max-w-2xl text-teal-100">
            Grocery, electronics, spare parts, air conditioning, car sales — pick
            your sector templates. Track stock, profit, cheques, and credit in
            plain Sinhala and English.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-teal-900 hover:bg-teal-50"
            >
              Open demo dashboard
            </Link>
            <Link
              href="/sectors"
              className="rounded-lg border border-teal-400 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Browse all sectors
            </Link>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-slate-900">
            Sector templates
          </h2>
          <p className="mt-1 text-slate-600">
            Each sector adds the right fields — not a separate app.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sectors.map((sector) => (
              <SectorCard key={sector.id} sector={sector} />
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl">🏦</span>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {bankingModules.nameEn}
              </h2>
              <p className="text-sm text-slate-500">{bankingModules.nameSi}</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {bankingModules.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <Link
                href="/banking"
                className="mt-4 inline-block text-sm font-medium text-teal-700"
              >
                Banking module details →
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-semibold text-amber-900">Getting started</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-amber-900">
            <li>Pick sector(s) — e.g. AC + Banking for a cooling dealer</li>
            <li>Add stock (products or vehicles)</li>
            <li>Bill customers — cash, cheque, or credit</li>
            <li>Check daily profit on your phone</li>
          </ol>
          <p className="mt-4 text-xs text-amber-800">
            Planning docs: <code>lakbiz/docs/SECTORS.md</code> and{" "}
            <code>lakbiz/docs/DATA_MODEL.md</code>
          </p>
        </section>
      </main>
    </div>
  );
}
