"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { LK_BANKS } from "@/lib/banks";
import { formatLkr } from "@/lib/format";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ChequeRecord, ChequeStatus } from "@/lib/store/types";

const statusLabels: Record<ChequeStatus, string> = {
  pending: "Pending",
  deposited: "Deposited",
  cleared: "Cleared",
  bounced: "Bounced",
};

export default function BankingPage() {
  const {
    data,
    ready,
    addBankAccount,
    deleteBankAccount,
    addCheque,
    updateChequeStatus,
  } = useAppStore();

  const [showBankForm, setShowBankForm] = useState(false);
  const [bankName, setBankName] = useState(LK_BANKS[0]);
  const [branch, setBranch] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [balance, setBalance] = useState(0);

  const [showChequeForm, setShowChequeForm] = useState(false);
  const [chDirection, setChDirection] = useState<"received" | "paid">("received");
  const [chNo, setChNo] = useState("");
  const [chBank, setChBank] = useState(LK_BANKS[0]);
  const [chParty, setChParty] = useState("");
  const [chAmount, setChAmount] = useState(0);
  const [chDate, setChDate] = useState(new Date().toISOString().slice(0, 10));
  const [chPostDated, setChPostDated] = useState(false);

  const [statusCheque, setStatusCheque] = useState<ChequeRecord | null>(null);
  const [depositAccountId, setDepositAccountId] = useState("");

  if (!ready || !data) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10">Loading...</main>
      </div>
    );
  }

  const totalBank = data.bankAccounts.reduce((s, a) => s + a.balance, 0);
  const pending = data.cheques.filter((c) => c.status === "pending");

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Banking</h1>
            <p className="text-slate-600">
              බැංකු සහ චෙක් — total balance{" "}
              <strong>{formatLkr(totalBank)}</strong>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBankForm((v) => !v)}
              className="rounded-lg border border-teal-700 px-3 py-2 text-sm text-teal-700"
            >
              + Bank account
            </button>
            <button
              onClick={() => setShowChequeForm((v) => !v)}
              className="rounded-lg bg-teal-700 px-3 py-2 text-sm text-white"
            >
              + Cheque
            </button>
          </div>
        </div>

        {showBankForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addBankAccount({
                bankName,
                branch,
                accountName,
                accountNumber,
                balance,
              });
              setShowBankForm(false);
              setAccountName("");
              setAccountNumber("");
              setBalance(0);
            }}
            className="mb-6 rounded-xl border bg-white p-5"
          >
            <h2 className="font-semibold">Add bank account</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {LK_BANKS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
              <input
                placeholder="Branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                required
                placeholder="Account name *"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                required
                placeholder="Account number *"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Opening balance (LKR)"
                value={balance || ""}
                onChange={(e) => setBalance(Number(e.target.value))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
            >
              Save account
            </button>
          </form>
        )}

        {showChequeForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addCheque({
                direction: chDirection,
                chequeNo: chNo,
                bankName: chBank,
                partyName: chParty,
                amount: chAmount,
                chequeDate: chDate,
                postDated: chPostDated,
              });
              setShowChequeForm(false);
              setChNo("");
              setChParty("");
              setChAmount(0);
            }}
            className="mb-6 rounded-xl border bg-white p-5"
          >
            <h2 className="font-semibold">Add cheque</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select
                value={chDirection}
                onChange={(e) =>
                  setChDirection(e.target.value as "received" | "paid")
                }
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="received">Received from customer</option>
                <option value="paid">Paid to supplier</option>
              </select>
              <input
                required
                placeholder="Cheque number *"
                value={chNo}
                onChange={(e) => setChNo(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <select
                value={chBank}
                onChange={(e) => setChBank(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {LK_BANKS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
              <input
                required
                placeholder="Party name *"
                value={chParty}
                onChange={(e) => setChParty(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                type="number"
                required
                placeholder="Amount (LKR) *"
                value={chAmount || ""}
                onChange={(e) => setChAmount(Number(e.target.value))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                type="date"
                required
                value={chDate}
                onChange={(e) => setChDate(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={chPostDated}
                  onChange={(e) => setChPostDated(e.target.checked)}
                />
                Post-dated cheque (PDC)
              </label>
            </div>
            <button
              type="submit"
              className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
            >
              Save cheque
            </button>
          </form>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {data.bankAccounts.length === 0 ? (
            <p className="text-sm text-slate-500 md:col-span-3">
              No bank accounts — add one above.
            </p>
          ) : (
            data.bankAccounts.map((acc) => (
              <div
                key={acc.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <p className="text-sm text-slate-500">{acc.bankName}</p>
                <p className="text-xs text-slate-400">{acc.accountNumber}</p>
                <p className="mt-1 text-xl font-bold">{formatLkr(acc.balance)}</p>
                <button
                  onClick={() => {
                    if (confirm("Delete this account?")) deleteBankAccount(acc.id);
                  }}
                  className="mt-2 text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        <section className="mt-10">
          <h2 className="font-semibold text-slate-900">
            Cheque register ({pending.length} pending)
          </h2>
          {data.cheques.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No cheques yet — add manually or use Cheque payment on Sales.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Party</th>
                    <th className="px-4 py-3">In/Out</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cheques.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-mono">{c.chequeNo}</td>
                      <td className="px-4 py-3">{c.partyName}</td>
                      <td className="px-4 py-3">
                        {c.direction === "received" ? "In" : "Out"}
                        {c.postDated && (
                          <span className="ml-1 text-xs text-amber-600">PDC</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{formatLkr(c.amount)}</td>
                      <td className="px-4 py-3">{c.chequeDate}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                          {statusLabels[c.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.status !== "cleared" && c.status !== "bounced" && (
                          <button
                            onClick={() => setStatusCheque(c)}
                            className="text-teal-700 hover:underline"
                          >
                            Update
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {statusCheque && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5">
              <h3 className="font-semibold">Update cheque status</h3>
              <p className="mt-1 text-sm text-slate-500">
                {statusCheque.partyName} — {formatLkr(statusCheque.amount)}
              </p>
              <select
                className="mt-3 w-full rounded-lg border px-3 py-2"
                defaultValue={statusCheque.status}
                onChange={(e) => {
                  const status = e.target.value as ChequeStatus;
                  if (status === "cleared" && data.bankAccounts.length === 0) {
                    alert("Add a bank account first to mark cleared.");
                    return;
                  }
                  if (status === "cleared") {
                    setDepositAccountId(data.bankAccounts[0]?.id ?? "");
                  }
                }}
                id="cheque-status-select"
              >
                <option value="pending">Pending</option>
                <option value="deposited">Deposited</option>
                <option value="cleared">Cleared</option>
                <option value="bounced">Bounced</option>
              </select>
              {data.bankAccounts.length > 0 && (
                <select
                  className="mt-3 w-full rounded-lg border px-3 py-2"
                  value={depositAccountId || data.bankAccounts[0].id}
                  onChange={(e) => setDepositAccountId(e.target.value)}
                >
                  {data.bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bankName} — {a.accountNumber}
                    </option>
                  ))}
                </select>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    const sel = document.getElementById(
                      "cheque-status-select",
                    ) as HTMLSelectElement;
                    updateChequeStatus(
                      statusCheque.id,
                      sel.value as ChequeStatus,
                      depositAccountId || data.bankAccounts[0]?.id,
                    );
                    setStatusCheque(null);
                  }}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setStatusCheque(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
