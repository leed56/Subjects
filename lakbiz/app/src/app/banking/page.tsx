"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import {
  ProBadge,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
  ProPageHeader,
  ProPageShell,
  ProStatCard,
} from "@/components/ui/pro-shell";
import { LK_BANKS } from "@/lib/banks";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import type {
  BankTransactionType,
  ChequeRecord,
  ChequeStatus,
} from "@/lib/store/types";

const TXN_TYPES: BankTransactionType[] = [
  "deposit",
  "withdrawal",
  "fee",
  "interest",
  "adjustment",
];

export default function BankingPage() {
  const {
    data,
    ready,
    addBankAccount,
    deleteBankAccount,
    addBankTransaction,
    deleteBankTransaction,
    addBankTransfer,
    addCheque,
    updateChequeStatus,
  } = useAppStore();
  const { t } = useLocale();

  const statusLabels: Record<ChequeStatus, string> = {
    pending: t("bank.status.pending"),
    deposited: t("bank.status.deposited"),
    cleared: t("bank.status.cleared"),
    bounced: t("bank.status.bounced"),
  };

  const txnTypeLabels: Record<BankTransactionType, string> = {
    deposit: t("bank.txn.deposit"),
    withdrawal: t("bank.txn.withdrawal"),
    fee: t("bank.txn.fee"),
    interest: t("bank.txn.interest"),
    adjustment: t("bank.txn.adjustment"),
  };

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
  const [selectedChequeStatus, setSelectedChequeStatus] = useState<ChequeStatus>("pending");

  const [showTxnForm, setShowTxnForm] = useState(false);
  const [txnAccountId, setTxnAccountId] = useState("");
  const [txnType, setTxnType] = useState<BankTransactionType>("deposit");
  const [txnAmount, setTxnAmount] = useState(0);
  const [txnDesc, setTxnDesc] = useState("");
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10));

  const [showTransferForm, setShowTransferForm] = useState(false);
  const [trFrom, setTrFrom] = useState("");
  const [trTo, setTrTo] = useState("");
  const [trAmount, setTrAmount] = useState(0);
  const [trDesc, setTrDesc] = useState("");
  const [trDate, setTrDate] = useState(new Date().toISOString().slice(0, 10));

  if (!ready || !data) {
    return (
      <ProPageShell>
        <SiteHeader />
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </ProPageShell>
    );
  }

  const totalBank = data.bankAccounts.reduce((s, a) => s + a.balance, 0);
  const pending = data.cheques.filter((c) => c.status === "pending");
  const deposited = data.cheques.filter((c) => c.status === "deposited");
  const chequeValue = data.cheques
    .filter((c) => c.status !== "bounced")
    .reduce((sum, c) => sum + (c.direction === "received" ? c.amount : -c.amount), 0);

  const openStatusModal = (cheque: ChequeRecord) => {
    setStatusCheque(cheque);
    setSelectedChequeStatus(cheque.status);
    setDepositAccountId(data.bankAccounts[0]?.id ?? "");
  };

  const accountLabel = (id: string) => {
    const a = data.bankAccounts.find((x) => x.id === id);
    return a ? `${a.bankName} — ${a.accountNumber}` : "—";
  };

  const ledger = [
    ...data.bankTransactions.map((tx) => ({
      key: tx.id,
      date: tx.date,
      label: txnTypeLabels[tx.type],
      detail: `${accountLabel(tx.accountId)}${tx.description ? ` · ${tx.description}` : ""}`,
      signed: tx.type === "withdrawal" || tx.type === "fee" ? -tx.amount : tx.amount,
      removable: tx.id,
    })),
    ...data.bankTransfers.map((tr) => ({
      key: tr.id,
      date: tr.date,
      label: t("bank.transfer"),
      detail: `${accountLabel(tr.fromAccountId)} → ${accountLabel(tr.toAccountId)}${tr.description ? ` · ${tr.description}` : ""}`,
      signed: tr.amount,
      removable: null as string | null,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <ProPageShell>
      <SiteHeader />
      <ProMain>
        <ProPageHeader
          eyebrow="Banking control"
          title={t("bank.title")}
          description={`${t("bank.subtitle")} — ${t("bank.total_balance")} ${formatLkr(totalBank)}`}
          actions={
            <>
              <button
                onClick={() => setShowBankForm((v) => !v)}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm transition hover:border-teal-200 hover:text-teal-800 active:scale-[0.98]"
              >
                {t("bank.add_account")}
              </button>
              <button
                onClick={() => {
                  setTxnAccountId(data.bankAccounts[0]?.id ?? "");
                  setShowTxnForm((v) => !v);
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm transition hover:border-teal-200 hover:text-teal-800 active:scale-[0.98]"
              >
                {t("bank.record_txn")}
              </button>
              <button
                onClick={() => {
                  setTrFrom(data.bankAccounts[0]?.id ?? "");
                  setTrTo(data.bankAccounts[1]?.id ?? "");
                  setShowTransferForm((v) => !v);
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm transition hover:border-teal-200 hover:text-teal-800 active:scale-[0.98]"
              >
                {t("bank.transfer")}
              </button>
              <button
                onClick={() => setShowChequeForm((v) => !v)}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700 active:scale-[0.98]"
              >
                {t("bank.add_cheque")}
              </button>
            </>
          }
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProStatCard label={t("bank.total_balance")} value={formatLkr(totalBank)} hint={`${data.bankAccounts.length} accounts`} icon="🏦" tone="teal" />
          <ProStatCard label={t("bank.pending")} value={String(pending.length)} hint={t("bank.cheque_register")} icon="🧾" tone="amber" />
          <ProStatCard label={t("bank.status.deposited")} value={String(deposited.length)} hint="Awaiting clearance" icon="📥" tone="blue" />
          <ProStatCard label="Cheque value" value={formatLkr(chequeValue)} hint="Received minus paid" icon="💸" tone="emerald" />
        </section>

        {showBankForm && (
          <section className="mt-6">
            <ProCard eyebrow="Bank account" title={t("bank.add_account_title")}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addBankAccount({ bankName, branch, accountName, accountNumber, balance });
                  setShowBankForm(false);
                  setAccountName("");
                  setAccountNumber("");
                  setBalance(0);
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <select value={bankName} onChange={(e) => setBankName(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                    {LK_BANKS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                  <input placeholder={t("bank.branch")} value={branch} onChange={(e) => setBranch(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input required placeholder={t("bank.account_name")} value={accountName} onChange={(e) => setAccountName(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input required placeholder={t("bank.account_no")} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input type="number" placeholder={t("bank.opening_balance")} value={balance || ""} onChange={(e) => setBalance(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button type="submit" className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700">{t("bank.save_account")}</button>
                  <button type="button" onClick={() => setShowBankForm(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">{t("common.cancel")}</button>
                </div>
              </form>
            </ProCard>
          </section>
        )}

        {showTxnForm && (
          <section className="mt-6">
            <ProCard eyebrow="Ledger" title={t("bank.txn_title")}>
              {data.bankAccounts.length === 0 ? (
                <ProEmptyState title={t("bank.no_accounts")} description={t("bank.txn_need_account")} />
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const ok = addBankTransaction({
                      accountId: txnAccountId,
                      type: txnType,
                      amount: txnAmount,
                      description: txnDesc,
                      date: txnDate,
                    });
                    if (ok) {
                      setShowTxnForm(false);
                      setTxnAmount(0);
                      setTxnDesc("");
                    }
                  }}
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <select value={txnAccountId} onChange={(e) => setTxnAccountId(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                      {data.bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.bankName} — {a.accountNumber}</option>)}
                    </select>
                    <select value={txnType} onChange={(e) => setTxnType(e.target.value as BankTransactionType)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                      {TXN_TYPES.map((ty) => <option key={ty} value={ty}>{txnTypeLabels[ty]}</option>)}
                    </select>
                    <input type="number" required placeholder={t("bank.amount")} value={txnAmount || ""} onChange={(e) => setTxnAmount(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                    <input type="date" required value={txnDate} onChange={(e) => setTxnDate(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                    <input placeholder={t("bank.description")} value={txnDesc} onChange={(e) => setTxnDesc(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100 sm:col-span-2" />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-500">{t("bank.adjustment_hint")}</p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button type="submit" className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700">{t("bank.save_txn")}</button>
                    <button type="button" onClick={() => setShowTxnForm(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">{t("common.cancel")}</button>
                  </div>
                </form>
              )}
            </ProCard>
          </section>
        )}

        {showTransferForm && (
          <section className="mt-6">
            <ProCard eyebrow="Ledger" title={t("bank.transfer_title")}>
              {data.bankAccounts.length < 2 ? (
                <ProEmptyState title={t("bank.transfer_need_accounts")} description={t("bank.transfer_need_accounts_desc")} />
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const ok = addBankTransfer({
                      fromAccountId: trFrom,
                      toAccountId: trTo,
                      amount: trAmount,
                      description: trDesc,
                      date: trDate,
                    });
                    if (ok) {
                      setShowTransferForm(false);
                      setTrAmount(0);
                      setTrDesc("");
                    }
                  }}
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <select value={trFrom} onChange={(e) => setTrFrom(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                      {data.bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.bankName} — {a.accountNumber}</option>)}
                    </select>
                    <select value={trTo} onChange={(e) => setTrTo(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                      {data.bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.bankName} — {a.accountNumber}</option>)}
                    </select>
                    <input type="number" required placeholder={t("bank.amount")} value={trAmount || ""} onChange={(e) => setTrAmount(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                    <input type="date" required value={trDate} onChange={(e) => setTrDate(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                    <input placeholder={t("bank.description")} value={trDesc} onChange={(e) => setTrDesc(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100 sm:col-span-2" />
                  </div>
                  {trFrom === trTo && <p className="mt-2 text-xs font-bold text-rose-600">{t("bank.transfer_same")}</p>}
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button type="submit" className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700">{t("bank.save_transfer")}</button>
                    <button type="button" onClick={() => setShowTransferForm(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">{t("common.cancel")}</button>
                  </div>
                </form>
              )}
            </ProCard>
          </section>
        )}

        {showChequeForm && (
          <section className="mt-6">
            <ProCard eyebrow="Cheque register" title={t("bank.add_cheque_title")}>
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
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <select value={chDirection} onChange={(e) => setChDirection(e.target.value as "received" | "paid")} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                    <option value="received">{t("bank.received")}</option>
                    <option value="paid">{t("bank.paid")}</option>
                  </select>
                  <input required placeholder={t("bank.cheque_no")} value={chNo} onChange={(e) => setChNo(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <select value={chBank} onChange={(e) => setChBank(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                    {LK_BANKS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                  <input required placeholder={t("bank.party_name")} value={chParty} onChange={(e) => setChParty(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input type="number" required placeholder={t("bank.amount")} value={chAmount || ""} onChange={(e) => setChAmount(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input type="date" required value={chDate} onChange={(e) => setChDate(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                    <input type="checkbox" checked={chPostDated} onChange={(e) => setChPostDated(e.target.checked)} />
                    {t("bank.pdc")}
                  </label>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button type="submit" className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700">{t("bank.save_cheque")}</button>
                  <button type="button" onClick={() => setShowChequeForm(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">{t("common.cancel")}</button>
                </div>
              </form>
            </ProCard>
          </section>
        )}

        <section className="mt-6">
          <ProCard title={t("bank.total_balance")} eyebrow="Accounts" action={<ProBadge tone="teal">{data.bankAccounts.length} accounts</ProBadge>}>
            {data.bankAccounts.length === 0 ? (
              <ProEmptyState title={t("bank.no_accounts")} description="Add a bank account to track deposits, cleared cheques and balances." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.bankAccounts.map((acc) => (
                  <article key={acc.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 ring-1 ring-slate-100">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-teal-700">{acc.bankName}</p>
                        <h2 className="mt-2 text-base font-black text-slate-950">{acc.accountName}</h2>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{acc.branch || "—"} · {acc.accountNumber}</p>
                      </div>
                      <ProBadge tone="emerald">Active</ProBadge>
                    </div>
                    <p className="mt-5 font-mono text-2xl font-black text-slate-950">{formatLkr(acc.balance)}</p>
                    <button
                      onClick={() => {
                        if (confirm(t("bank.delete_account"))) deleteBankAccount(acc.id);
                      }}
                      className="mt-4 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100"
                    >
                      {t("common.delete")}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </ProCard>
        </section>

        <section className="mt-6">
          <ProCard title={t("bank.transactions")} eyebrow="Ledger" action={<ProBadge tone="teal">{ledger.length}</ProBadge>}>
            {ledger.length === 0 ? (
              <ProEmptyState title={t("bank.no_transactions")} description={t("bank.txn_hint")} />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{t("common.date")}</th>
                      <th className="px-4 py-3">{t("bank.type")}</th>
                      <th className="px-4 py-3">{t("bank.account")}</th>
                      <th className="px-4 py-3 text-right">{t("bank.amount")}</th>
                      <th className="px-4 py-3">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((row) => (
                      <tr key={row.key} className="border-b last:border-0">
                        <td className="px-4 py-3 font-semibold text-slate-600">{row.date.slice(0, 10)}</td>
                        <td className="px-4 py-3 font-black text-slate-950">{row.label}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{row.detail}</td>
                        <td className={`px-4 py-3 text-right font-mono font-black ${row.signed < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          {row.signed < 0 ? "-" : "+"}{formatLkr(Math.abs(row.signed))}
                        </td>
                        <td className="px-4 py-3">
                          {row.removable && (
                            <button
                              onClick={() => {
                                if (confirm(t("bank.delete_txn"))) deleteBankTransaction(row.removable!);
                              }}
                              className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100"
                            >
                              {t("common.delete")}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ProCard>
        </section>

        <section className="mt-6">
          <ProCard title={`${t("bank.cheque_register")} (${pending.length} ${t("bank.pending")})`} action={<ProBadge tone="amber">{data.cheques.length} cheques</ProBadge>}>
            {data.cheques.length === 0 ? (
              <ProEmptyState title={t("bank.cheque_hint")} description="Add received and paid cheques to track pending, deposited, cleared and bounced status." />
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">{t("bank.party")}</th>
                        <th className="px-4 py-3">{t("bank.in_out")}</th>
                        <th className="px-4 py-3">{t("bank.amount")}</th>
                        <th className="px-4 py-3">{t("common.date")}</th>
                        <th className="px-4 py-3">{t("bank.status_col")}</th>
                        <th className="px-4 py-3">{t("common.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.cheques.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="px-4 py-3 font-mono text-xs font-black text-slate-700">{c.chequeNo}</td>
                          <td className="px-4 py-3 font-black text-slate-950">{c.partyName}</td>
                          <td className="px-4 py-3 font-semibold text-slate-600">
                            {c.direction === "received" ? t("bank.in") : t("bank.out")}
                            {c.postDated && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-700">PDC</span>}
                          </td>
                          <td className="px-4 py-3 font-mono font-black text-slate-950">{formatLkr(c.amount)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-600">{c.chequeDate}</td>
                          <td className="px-4 py-3"><ChequeStatusBadge status={c.status} label={statusLabels[c.status]} /></td>
                          <td className="px-4 py-3">
                            {c.status !== "cleared" && c.status !== "bounced" && (
                              <button onClick={() => openStatusModal(c)} className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-black text-teal-700 hover:bg-teal-100">
                                {t("common.update")}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 lg:hidden">
                  {data.cheques.map((c) => (
                    <article key={c.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-black uppercase tracking-wide text-teal-700">{c.chequeNo}</p>
                          <h2 className="mt-2 font-black text-slate-950">{c.partyName}</h2>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{c.bankName} · {c.chequeDate}</p>
                        </div>
                        <ChequeStatusBadge status={c.status} label={statusLabels[c.status]} />
                      </div>
                      <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-slate-400">{c.direction === "received" ? t("bank.in") : t("bank.out")}</p>
                          {c.postDated && <p className="mt-1 text-xs font-black text-amber-700">PDC</p>}
                        </div>
                        <p className="font-mono text-lg font-black text-slate-950">{formatLkr(c.amount)}</p>
                      </div>
                      {c.status !== "cleared" && c.status !== "bounced" && (
                        <button onClick={() => openStatusModal(c)} className="mt-4 w-full rounded-2xl bg-teal-50 px-3 py-3 text-xs font-black text-teal-700 hover:bg-teal-100">
                          {t("common.update")}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}
          </ProCard>
        </section>

        {statusCheque && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-5 shadow-2xl shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-600">{t("bank.update_status")}</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{statusCheque.partyName}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{statusCheque.chequeNo} — {formatLkr(statusCheque.amount)}</p>
                </div>
                <button onClick={() => setStatusCheque(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">✕</button>
              </div>

              <label className="mt-5 block text-sm font-black text-slate-700">
                {t("bank.status_col")}
                <select
                  className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                  value={selectedChequeStatus}
                  onChange={(e) => {
                    const status = e.target.value as ChequeStatus;
                    if (status === "cleared" && data.bankAccounts.length === 0) {
                      alert(t("bank.need_account"));
                      return;
                    }
                    setSelectedChequeStatus(status);
                    if (status === "cleared") setDepositAccountId(data.bankAccounts[0]?.id ?? "");
                  }}
                >
                  <option value="pending">{t("bank.status.pending")}</option>
                  <option value="deposited">{t("bank.status.deposited")}</option>
                  <option value="cleared">{t("bank.status.cleared")}</option>
                  <option value="bounced">{t("bank.status.bounced")}</option>
                </select>
              </label>

              {data.bankAccounts.length > 0 && (
                <label className="mt-4 block text-sm font-black text-slate-700">
                  {t("bank.total_balance")}
                  <select
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"
                    value={depositAccountId || data.bankAccounts[0].id}
                    onChange={(e) => setDepositAccountId(e.target.value)}
                  >
                    {data.bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.bankName} — {a.accountNumber}</option>)}
                  </select>
                </label>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => {
                    updateChequeStatus(statusCheque.id, selectedChequeStatus, depositAccountId || data.bankAccounts[0]?.id);
                    setStatusCheque(null);
                  }}
                  className="flex-1 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700"
                >
                  {t("common.save")}
                </button>
                <button onClick={() => setStatusCheque(null)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}
      </ProMain>
    </ProPageShell>
  );
}

function ChequeStatusBadge({ status, label }: { status: ChequeStatus; label: string }) {
  const tone = status === "cleared" ? "emerald" : status === "bounced" ? "rose" : status === "deposited" ? "teal" : "amber";
  return <ProBadge tone={tone}>{label}</ProBadge>;
}
