import { SiteHeader } from "@/components/site-header";
import { DashboardStat } from "@/components/dashboard-stat";

export default function DashboardPage() {
  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Owner dashboard</h1>
          <p className="text-slate-600">
            Demo data — Sample AC &amp; car dealer, Colombo
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardStat
            labelEn="Today's sales"
            labelSi="අද විකුණුම"
            value="Rs. 485,000"
          />
          <DashboardStat
            labelEn="Today's profit"
            labelSi="අද ලාභය"
            value="Rs. 92,400"
            hint="Owner only"
          />
          <DashboardStat
            labelEn="Credit outstanding"
            labelSi="ණය බිලි"
            value="Rs. 1.2M"
          />
          <DashboardStat
            labelEn="Low stock items"
            labelSi="අවසන් වෙන තොග"
            value="7"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardStat
            labelEn="Bank balance"
            labelSi="බැංකු ශේෂය"
            value="Rs. 3.4M"
          />
          <DashboardStat
            labelEn="Cash in hand"
            labelSi="අතේ මුදල්"
            value="Rs. 125,000"
          />
          <DashboardStat
            labelEn="Cheques due (7 days)"
            labelSi="ඉදිරියට ලැබෙන චෙක්"
            value="3"
          />
          <DashboardStat
            labelEn="Cars over 60 days"
            labelSi="දින 60+ වාහන"
            value="2"
          />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">
              Pending AC installations
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>• Mr. Perera — 18000 BTU Daikin — deposit received</li>
              <li>• Office Nugegoda — 2× cassette units — site visit done</li>
              <li>• Mrs. Silva — pipe extra 6m — awaiting schedule</li>
            </ul>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Vehicle stock alert</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>• Toyota Prius 2018 — 74 days — cost Rs. 6.8M</li>
              <li>• Suzuki Wagon R 2020 — 61 days — cost Rs. 4.2M</li>
              <li>• Honda Fit 2019 — sold today — profit Rs. 380,000</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
