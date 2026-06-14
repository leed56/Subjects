import { SiteHeader } from "@/components/site-header";
import { bankingModules } from "@/lib/sectors";

const demoCheques = [
  {
    no: "104522",
    party: "ABC Electricals",
    amount: "Rs. 450,000",
    date: "2026-06-20",
    status: "Post-dated",
  },
  {
    no: "887120",
    party: "Mr. Jayasinghe (car deposit)",
    amount: "Rs. 500,000",
    date: "2026-06-12",
    status: "Deposited",
  },
  {
    no: "Paid-331",
    party: "Gree distributor",
    amount: "Rs. 1,200,000",
    date: "2026-06-08",
    status: "Cleared",
  },
];

export default function BankingPage() {
  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">
          {bankingModules.nameEn}
        </h1>
        <p className="text-slate-500">{bankingModules.nameSi}</p>
        <p className="mt-2 max-w-2xl text-slate-600">
          Track your business money — not a customer bank app. Built for how Sri
          Lankan B2B actually pays: cash, transfers, cheques, and credit on
          account.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { bank: "People's Bank", bal: "Rs. 1,850,000" },
            { bank: "Sampath Bank", bal: "Rs. 1,120,000" },
            { bank: "BOC — Current", bal: "Rs. 430,000" },
          ].map((acc) => (
            <div
              key={acc.bank}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <p className="text-sm text-slate-500">{acc.bank}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{acc.bal}</p>
            </div>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="font-semibold text-slate-900">Cheque register (demo)</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Cheque #</th>
                  <th className="px-4 py-3">Party</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {demoCheques.map((c) => (
                  <tr key={c.no} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-mono">{c.no}</td>
                    <td className="px-4 py-3">{c.party}</td>
                    <td className="px-4 py-3">{c.amount}</td>
                    <td className="px-4 py-3">{c.date}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Included features</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {bankingModules.features.map((f) => (
              <li key={f} className="text-sm text-slate-600">
                ✓ {f}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
