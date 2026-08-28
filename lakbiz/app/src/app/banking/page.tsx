"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import { Dialog, DrawerFooter } from "@/components/ui/overlay";
import {
  ActionMenu,
  AlertRow,
  Button,
  EmptyState,
  MetricCard,
  PageHeader,
  StatusBadge,
  Tabs,
} from "@/components/ui/primitives";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { BankingIcon, BillsIcon, InboxIcon } from "@/components/ui/icons";
import { LK_BANKS } from "@/lib/banks";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
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

type BankingSection = "accounts" | "transactions" | "cheques" | "transfers";

type TransactionRow = {
  id: string;
  date: string;
  label: string;
  detail: string;
  signed: number;
};

type TransferRow = {
  id: string;
  date: string;
  from: string;
  to: string;
  description: string;
  amount: number;
};

export default function BankingPage() {
  const {
    data,
    ready,
    addBankAccountToCloud,
    deleteBankAccountToCloud,
    addBankTransactionToCloud,
    deleteBankTransactionToCloud,
    addBankTransferToCloud,
    addChequeToCloud,
    updateChequeStatusToCloud,
  } = useAppStore();
  const { t } = useLocale();
  const { canWrite } = useWriteAccess();

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

  const [activeSection, setActiveSection] = useState<BankingSection>("accounts");

  const [showBankModal, setShowBankModal] = useState(false);
  const [bankName, setBankName] = useState(LK_BANKS[0]);
  const [branch, setBranch] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [balance, setBalance] = useState(0);

  const [showChequeModal, setShowChequeModal] = useState(false);
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

  const [showTxnModal, setShowTxnModal] = useState(false);
  const [txnAccountId, setTxnAccountId] = useState("");
  const [txnType, setTxnType] = useState<BankTransactionType>("deposit");
  const [txnAmount, setTxnAmount] = useState(0);
  const [txnDesc, setTxnDesc] = useState("");
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10));

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [trFrom, setTrFrom] = useState("");
  const [trTo, setTrTo] = useState("");
  const [trAmount, setTrAmount] = useState(0);
  const [trDesc, setTrDesc] = useState("");
  const [trDate, setTrDate] = useState(new Date().toISOString().slice(0, 10));

  const [savingBank, setSavingBank] = useState(false);
  const [savingTxn, setSavingTxn] = useState(false);
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [savingCheque, setSavingCheque] = useState(false);
  const [savingChequeStatus, setSavingChequeStatus] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [deletingTxnId, setDeletingTxnId] = useState<string | null>(null);

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  const totalBank = data.bankAccounts.reduce((sum, account) => sum + account.balance, 0);
  const pending = data.cheques.filter((cheque) => cheque.status === "pending");
  const deposited = data.cheques.filter((cheque) => cheque.status === "deposited");

  const accountLabel = (id: string) => {
    const account = data.bankAccounts.find((item) => item.id === id);
    return account ? `${account.bankName} — ${account.accountNumber}` : "—";
  };

  const transactionRows: TransactionRow[] = data.bankTransactions
    .map((tx) => ({
      id: tx.id,
      date: tx.date,
      label: txnTypeLabels[tx.type],
      detail: `${accountLabel(tx.accountId)}${tx.description ? ` · ${tx.description}` : ""}`,
      signed: tx.type === "withdrawal" || tx.type === "fee" ? -tx.amount : tx.amount,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const transferRows: TransferRow[] = data.bankTransfers
    .map((transfer) => ({
      id: transfer.id,
      date: transfer.date,
      from: accountLabel(transfer.fromAccountId),
      to: accountLabel(transfer.toAccountId),
      description: transfer.description ?? "",
      amount: transfer.amount,
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const hasAnyBankingData =
    data.bankAccounts.length > 0 ||
    transactionRows.length > 0 ||
    transferRows.length > 0 ||
    data.cheques.length > 0;

  const transactionColumns: DataTableColumn<TransactionRow>[] = [
    {
      key: "type",
      header: t("bank.type"),
      render: (row) => (
        <div>
          <span className="font-medium text-slate-950">{row.label}</span>
          <p className="mt-1 text-xs text-slate-500 sm:hidden">{row.date.slice(0, 10)}</p>
        </div>
      ),
    },
    {
      key: "date",
      header: t("common.date"),
      render: (row) => <span className="text-slate-500">{row.date.slice(0, 10)}</span>,
      hideOnMobile: true,
    },
    {
      key: "account",
      header: t("bank.account"),
      render: (row) => <span className="text-slate-600">{row.detail}</span>,
      hideOnMobile: true,
    },
    {
      key: "amount",
      header: t("bank.amount"),
      align: "right",
      render: (row) => (
        <span
          className={`font-mono font-semibold tabular-nums ${
            row.signed < 0 ? "text-rose-600" : "text-emerald-700"
          }`}
        >
          {row.signed < 0 ? "−" : "+"}
          {formatLkr(Math.abs(row.signed))}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (row) => (
        <ActionMenu
          label={t("common.actions")}
          items={[
            {
              label: deletingTxnId === row.id ? t("common.saving") : t("common.delete"),
              tone: "danger",
              disabled: !!deletingTxnId || !canWrite,
              onSelect: async () => {
                if (deletingTxnId || !confirm(t("bank.delete_txn"))) return;
                setDeletingTxnId(row.id);
                setFormMessage("");
                const result = await deleteBankTransactionToCloud(row.id);
                setDeletingTxnId(null);
                if (!result.ok) setFormMessage(result.error ?? t("common.save_failed"));
              },
            },
          ]}
        />
      ),
    },
  ];

  const transferColumns: DataTableColumn<TransferRow>[] = [
    {
      key: "route",
      header: t("bank.transfer"),
      render: (row) => (
        <div>
          <p className="font-medium text-slate-950">{row.from}</p>
          <p className="mt-1 text-xs text-slate-500">→ {row.to}</p>
        </div>
      ),
    },
    {
      key: "date",
      header: t("common.date"),
      render: (row) => <span className="text-slate-500">{row.date.slice(0, 10)}</span>,
    },
    {
      key: "description",
      header: t("bank.description"),
      render: (row) => <span className="text-slate-500">{row.description || "—"}</span>,
      hideOnMobile: true,
    },
    {
      key: "amount",
      header: t("bank.amount"),
      align: "right",
      render: (row) => (
        <span className="font-mono font-semibold tabular-nums text-slate-950">
          {formatLkr(row.amount)}
        </span>
      ),
    },
  ];

  const chequeColumns: DataTableColumn<ChequeRecord>[] = [
    {
      key: "cheque",
      header: "#",
      render: (cheque) => (
        <div>
          <p className="font-mono text-xs font-semibold text-slate-950">{cheque.chequeNo}</p>
          <p className="mt-1 text-xs text-slate-500">{cheque.partyName}</p>
        </div>
      ),
    },
    {
      key: "direction",
      header: t("bank.in_out"),
      render: (cheque) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-700">
            {cheque.direction === "received" ? t("bank.in") : t("bank.out")}
          </span>
          {cheque.postDated && <StatusBadge tone="warning">PDC</StatusBadge>}
        </div>
      ),
    },
    {
      key: "bank",
      header: t("bank.account"),
      render: (cheque) => (
        <div>
          <p className="text-slate-700">{cheque.bankName}</p>
          <p className="mt-1 text-xs text-slate-400">{cheque.chequeDate}</p>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      key: "amount",
      header: t("bank.amount"),
      align: "right",
      render: (cheque) => (
        <span className="font-mono font-semibold tabular-nums text-slate-950">
          {formatLkr(cheque.amount)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("bank.status_col"),
      render: (cheque) => (
        <ChequeStatusBadge status={cheque.status} label={statusLabels[cheque.status]} />
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (cheque) =>
        cheque.status !== "cleared" && cheque.status !== "bounced" ? (
          <Button size="sm" variant="ghost" onClick={() => openStatusModal(cheque)}>
            {t("common.update")}
          </Button>
        ) : null,
    },
  ];

  const closeAllModals = () => {
    setShowBankModal(false);
    setShowTxnModal(false);
    setShowTransferModal(false);
    setShowChequeModal(false);
  };

  const resetBankForm = () => {
    setBankName(LK_BANKS[0]);
    setBranch("");
    setAccountName("");
    setAccountNumber("");
    setBalance(0);
    setFormMessage("");
  };

  const resetTxnForm = () => {
    setTxnType("deposit");
    setTxnAmount(0);
    setTxnDesc("");
    setTxnDate(new Date().toISOString().slice(0, 10));
    setFormMessage("");
  };

  const resetTransferForm = () => {
    setTrAmount(0);
    setTrDesc("");
    setTrDate(new Date().toISOString().slice(0, 10));
    setFormMessage("");
  };

  const resetChequeForm = () => {
    setChDirection("received");
    setChNo("");
    setChBank(LK_BANKS[0]);
    setChParty("");
    setChAmount(0);
    setChDate(new Date().toISOString().slice(0, 10));
    setChPostDated(false);
    setFormMessage("");
  };

  const openBankModal = () => {
    if (!canWrite) {
      setFormMessage(t("sub.read_only"));
      return;
    }
    closeAllModals();
    resetBankForm();
    setShowBankModal(true);
  };

  const openTxnModal = () => {
    if (!canWrite) {
      setFormMessage(t("sub.read_only"));
      return;
    }
    closeAllModals();
    resetTxnForm();
    setTxnAccountId(data.bankAccounts[0]?.id ?? "");
    setShowTxnModal(true);
  };

  const openTransferModal = () => {
    if (!canWrite) {
      setFormMessage(t("sub.read_only"));
      return;
    }
    closeAllModals();
    resetTransferForm();
    setTrFrom(data.bankAccounts[0]?.id ?? "");
    setTrTo(data.bankAccounts[1]?.id ?? "");
    setShowTransferModal(true);
  };

  const openChequeModal = () => {
    if (!canWrite) {
      setFormMessage(t("sub.read_only"));
      return;
    }
    closeAllModals();
    resetChequeForm();
    setShowChequeModal(true);
  };

  const openStatusModal = (cheque: ChequeRecord) => {
    setStatusCheque(cheque);
    setSelectedChequeStatus(cheque.status);
    setDepositAccountId(data.bankAccounts[0]?.id ?? "");
  };

  const inputClass =
    "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={t("bank.title")}
          description={t("bank.subtitle")}
          actions={
            <>
              <Button variant="secondary" onClick={openBankModal} disabled={!canWrite}>
                {t("bank.add_account")}
              </Button>
              <Button variant="primary" onClick={openTxnModal} disabled={!canWrite}>
                {t("bank.record_txn")}
              </Button>
              <ActionMenu
                label={t("common.actions")}
                items={[
                  {
                    label: t("bank.transfer"),
                    onSelect: openTransferModal,
                    disabled: !canWrite,
                  },
                  {
                    label: t("bank.add_cheque"),
                    onSelect: openChequeModal,
                    disabled: !canWrite,
                  },
                ]}
              />
            </>
          }
          metrics={
            hasAnyBankingData ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label={t("bank.total_balance")}
                  value={formatLkr(totalBank)}
                  icon={<BankingIcon className="h-4.5 w-4.5" />}
                />
                <MetricCard
                  label={t("bank.pending")}
                  value={String(pending.length)}
                  icon={<BillsIcon className="h-4.5 w-4.5" />}
                  tone={pending.length > 0 ? "warning" : "default"}
                />
                <MetricCard
                  label={t("bank.status.deposited")}
                  value={String(deposited.length)}
                  icon={<InboxIcon className="h-4.5 w-4.5" />}
                />
              </div>
            ) : undefined
          }
        />

        <WriteDisabledHint className="mb-5" />

        {formMessage &&
          !showBankModal &&
          !showTxnModal &&
          !showTransferModal &&
          !showChequeModal && (
            <div className="mb-5">
              <AlertRow tone="warning">{formMessage}</AlertRow>
            </div>
          )}

        {!hasAnyBankingData ? (
          <EmptyState
            icon={<BankingIcon className="h-5 w-5" />}
            title={t("bank.onboarding_title")}
            description={t("bank.onboarding_desc")}
            action={
              canWrite ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" onClick={openBankModal}>
                    {t("bank.add_account")}
                  </Button>
                  <Button variant="secondary" onClick={openChequeModal}>
                    {t("bank.add_cheque")}
                  </Button>
                </div>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Tabs
                value={activeSection}
                onChange={(value) => setActiveSection(value as BankingSection)}
                tabs={[
                  { value: "accounts", label: t("bank.account") },
                  { value: "transactions", label: t("bank.transactions") },
                  { value: "cheques", label: t("bank.cheque_register") },
                  { value: "transfers", label: t("bank.transfer") },
                ]}
              />
              <p className="text-xs font-medium text-slate-400">
                {activeSection === "accounts" && `${data.bankAccounts.length} ${t("bank.account")}`}
                {activeSection === "transactions" && `${transactionRows.length} ${t("bank.transactions")}`}
                {activeSection === "cheques" && `${data.cheques.length} ${t("bank.cheque_register")}`}
                {activeSection === "transfers" && `${transferRows.length} ${t("bank.transfer")}`}
              </p>
            </div>

            {activeSection === "accounts" && (
              <div className="grid gap-4 lg:grid-cols-2">
                {data.bankAccounts.length === 0 ? (
                  <div className="lg:col-span-2">
                    <EmptyState
                      size="compact"
                      icon={<BankingIcon className="h-5 w-5" />}
                      title={t("bank.no_accounts")}
                      description={t("bank.onboarding_desc")}
                      action={
                        canWrite ? (
                          <Button variant="primary" onClick={openBankModal}>
                            {t("bank.add_account")}
                          </Button>
                        ) : undefined
                      }
                    />
                  </div>
                ) : (
                  data.bankAccounts.map((account) => (
                    <article
                      key={account.id}
                      className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition hover:border-slate-300"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-teal-700 ring-1 ring-inset ring-slate-100">
                            <BankingIcon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-950">{account.accountName}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{account.bankName}</p>
                          </div>
                        </div>
                        <ActionMenu
                          label={t("common.actions")}
                          items={[
                            {
                              label:
                                deletingAccountId === account.id
                                  ? t("common.saving")
                                  : t("common.delete"),
                              tone: "danger",
                              disabled: !!deletingAccountId || !canWrite,
                              onSelect: async () => {
                                if (deletingAccountId || !confirm(t("bank.delete_account"))) return;
                                setDeletingAccountId(account.id);
                                setFormMessage("");
                                const result = await deleteBankAccountToCloud(account.id);
                                setDeletingAccountId(null);
                                if (!result.ok) {
                                  setFormMessage(result.error ?? t("common.save_failed"));
                                }
                              },
                            },
                          ]}
                        />
                      </div>

                      <div className="mt-6">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          {t("bank.total_balance")}
                        </p>
                        <p className="mt-1.5 font-mono text-2xl font-bold tracking-tight text-slate-950 tabular-nums">
                          {formatLkr(account.balance)}
                        </p>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-400">{t("bank.account_no")}</p>
                          <p className="mt-1 break-all font-mono font-medium text-slate-700">{account.accountNumber}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-400">{t("bank.branch")}</p>
                          <p className="mt-1 break-words font-medium leading-relaxed text-slate-700">{account.branch || "—"}</p>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}

            {activeSection === "transactions" && (
              <DataTable
                columns={transactionColumns}
                rows={transactionRows}
                emptyState={
                  <EmptyState
                    size="compact"
                    title={t("bank.no_transactions")}
                    description={t("bank.txn_hint")}
                    action={
                      canWrite ? (
                        <Button variant="primary" onClick={openTxnModal}>
                          {t("bank.record_txn")}
                        </Button>
                      ) : undefined
                    }
                  />
                }
              />
            )}

            {activeSection === "cheques" && (
              <DataTable
                columns={chequeColumns}
                rows={data.cheques}
                emptyState={
                  <EmptyState
                    size="compact"
                    title={t("bank.cheque_register")}
                    description={t("bank.cheque_hint")}
                    action={
                      canWrite ? (
                        <Button variant="primary" onClick={openChequeModal}>
                          {t("bank.add_cheque")}
                        </Button>
                      ) : undefined
                    }
                  />
                }
              />
            )}

            {activeSection === "transfers" && (
              <DataTable
                columns={transferColumns}
                rows={transferRows}
                emptyState={
                  <EmptyState
                    size="compact"
                    title={t("bank.transfer")}
                    description={
                      data.bankAccounts.length < 2
                        ? t("bank.transfer_need_accounts_desc")
                        : undefined
                    }
                    action={
                      canWrite ? (
                        <Button variant="primary" onClick={openTransferModal}>
                          {t("bank.transfer")}
                        </Button>
                      ) : undefined
                    }
                  />
                }
              />
            )}
          </>
        )}

        <Dialog
          open={showBankModal}
          onClose={() => setShowBankModal(false)}
          title={t("bank.add_account_title")}
          description={t("bank.account")}
          size="lg"
          footer={
            <DrawerFooter
              onCancel={() => setShowBankModal(false)}
              primaryLabel={savingBank ? t("common.saving") : t("bank.save_account")}
              primaryType="submit"
              primaryForm="bank-account-form"
              primaryDisabled={savingBank}
              primaryLoading={savingBank}
            />
          }
        >
          <form
            id="bank-account-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (savingBank) return;
              setSavingBank(true);
              setFormMessage("");
              const result = await addBankAccountToCloud({
                bankName,
                branch,
                accountName,
                accountNumber,
                balance,
              });
              setSavingBank(false);
              if (!result.ok) {
                setFormMessage(result.error ?? t("common.save_failed"));
                return;
              }
              setShowBankModal(false);
              resetBankForm();
              setActiveSection("accounts");
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={bankName} onChange={(event) => setBankName(event.target.value)} className={inputClass}>
                {LK_BANKS.map((bank) => <option key={bank}>{bank}</option>)}
              </select>
              <input placeholder={t("bank.branch")} value={branch} onChange={(event) => setBranch(event.target.value)} className={inputClass} />
              <input required placeholder={t("bank.account_name")} value={accountName} onChange={(event) => setAccountName(event.target.value)} className={inputClass} />
              <input required placeholder={t("bank.account_no")} value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} className={inputClass} />
              <input type="number" placeholder={t("bank.opening_balance")} value={balance || ""} onChange={(event) => setBalance(Number(event.target.value))} className={inputClass} />
            </div>
            {formMessage && showBankModal && <p className="mt-3 text-sm font-medium text-amber-700">{formMessage}</p>}
          </form>
        </Dialog>

        <Dialog
          open={showTxnModal}
          onClose={() => setShowTxnModal(false)}
          title={t("bank.txn_title")}
          description={t("bank.transactions")}
          size="lg"
          footer={
            data.bankAccounts.length === 0 ? (
              canWrite ? (
                <DrawerFooter
                  onCancel={() => setShowTxnModal(false)}
                  primaryLabel={t("bank.add_account")}
                  onPrimary={() => {
                    setShowTxnModal(false);
                    openBankModal();
                  }}
                />
              ) : undefined
            ) : (
              <DrawerFooter
                onCancel={() => setShowTxnModal(false)}
                primaryLabel={savingTxn ? t("common.saving") : t("bank.save_txn")}
                primaryType="submit"
                primaryForm="bank-txn-form"
                primaryDisabled={savingTxn}
                primaryLoading={savingTxn}
              />
            )
          }
        >
          {data.bankAccounts.length === 0 ? (
            <EmptyState size="compact" title={t("bank.no_accounts")} description={t("bank.txn_need_account")} />
          ) : (
            <form
              id="bank-txn-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (savingTxn) return;
                setSavingTxn(true);
                setFormMessage("");
                const result = await addBankTransactionToCloud({
                  accountId: txnAccountId,
                  type: txnType,
                  amount: txnAmount,
                  description: txnDesc,
                  date: txnDate,
                });
                setSavingTxn(false);
                if (!result.ok) {
                  setFormMessage(result.error ?? t("common.save_failed"));
                  return;
                }
                setShowTxnModal(false);
                resetTxnForm();
                setActiveSection("transactions");
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={txnAccountId} onChange={(event) => setTxnAccountId(event.target.value)} className={inputClass}>
                  {data.bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.bankName} — {account.accountNumber}</option>
                  ))}
                </select>
                <select value={txnType} onChange={(event) => setTxnType(event.target.value as BankTransactionType)} className={inputClass}>
                  {TXN_TYPES.map((type) => <option key={type} value={type}>{txnTypeLabels[type]}</option>)}
                </select>
                <input type="number" required placeholder={t("bank.amount")} value={txnAmount || ""} onChange={(event) => setTxnAmount(Number(event.target.value))} className={inputClass} />
                <input type="date" required value={txnDate} onChange={(event) => setTxnDate(event.target.value)} className={inputClass} />
                <input placeholder={t("bank.description")} value={txnDesc} onChange={(event) => setTxnDesc(event.target.value)} className={`${inputClass} sm:col-span-2`} />
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">{t("bank.adjustment_hint")}</p>
              {formMessage && showTxnModal && <p className="mt-3 text-sm font-medium text-amber-700">{formMessage}</p>}
            </form>
          )}
        </Dialog>

        <Dialog
          open={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          title={t("bank.transfer_title")}
          description={t("bank.transfer")}
          size="lg"
          footer={
            data.bankAccounts.length < 2 ? (
              canWrite ? (
                <DrawerFooter
                  onCancel={() => setShowTransferModal(false)}
                  primaryLabel={t("bank.add_account")}
                  onPrimary={() => {
                    setShowTransferModal(false);
                    openBankModal();
                  }}
                />
              ) : undefined
            ) : (
              <DrawerFooter
                onCancel={() => setShowTransferModal(false)}
                primaryLabel={savingTransfer ? t("common.saving") : t("bank.save_transfer")}
                primaryType="submit"
                primaryForm="bank-transfer-form"
                primaryDisabled={savingTransfer || trFrom === trTo}
                primaryLoading={savingTransfer}
              />
            )
          }
        >
          {data.bankAccounts.length < 2 ? (
            <EmptyState size="compact" title={t("bank.transfer_need_accounts")} description={t("bank.transfer_need_accounts_desc")} />
          ) : (
            <form
              id="bank-transfer-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (savingTransfer) return;
                setSavingTransfer(true);
                setFormMessage("");
                const result = await addBankTransferToCloud({
                  fromAccountId: trFrom,
                  toAccountId: trTo,
                  amount: trAmount,
                  description: trDesc,
                  date: trDate,
                });
                setSavingTransfer(false);
                if (!result.ok) {
                  setFormMessage(result.error ?? t("common.save_failed"));
                  return;
                }
                setShowTransferModal(false);
                resetTransferForm();
                setActiveSection("transfers");
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={trFrom} onChange={(event) => setTrFrom(event.target.value)} className={inputClass}>
                  {data.bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.bankName} — {account.accountNumber}</option>)}
                </select>
                <select value={trTo} onChange={(event) => setTrTo(event.target.value)} className={inputClass}>
                  {data.bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.bankName} — {account.accountNumber}</option>)}
                </select>
                <input type="number" required placeholder={t("bank.amount")} value={trAmount || ""} onChange={(event) => setTrAmount(Number(event.target.value))} className={inputClass} />
                <input type="date" required value={trDate} onChange={(event) => setTrDate(event.target.value)} className={inputClass} />
                <input placeholder={t("bank.description")} value={trDesc} onChange={(event) => setTrDesc(event.target.value)} className={`${inputClass} sm:col-span-2`} />
              </div>
              {trFrom === trTo && <p className="mt-2 text-xs font-semibold text-rose-600">{t("bank.transfer_same")}</p>}
              {formMessage && showTransferModal && <p className="mt-3 text-sm font-medium text-amber-700">{formMessage}</p>}
            </form>
          )}
        </Dialog>

        <Dialog
          open={showChequeModal}
          onClose={() => setShowChequeModal(false)}
          title={t("bank.add_cheque_title")}
          description={t("bank.cheque_register")}
          size="lg"
          footer={
            <DrawerFooter
              onCancel={() => setShowChequeModal(false)}
              primaryLabel={savingCheque ? t("common.saving") : t("bank.save_cheque")}
              primaryType="submit"
              primaryForm="bank-cheque-form"
              primaryDisabled={savingCheque}
              primaryLoading={savingCheque}
            />
          }
        >
          <form
            id="bank-cheque-form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (savingCheque) return;
              setSavingCheque(true);
              setFormMessage("");
              const result = await addChequeToCloud({
                direction: chDirection,
                chequeNo: chNo,
                bankName: chBank,
                partyName: chParty,
                amount: chAmount,
                chequeDate: chDate,
                postDated: chPostDated,
              });
              setSavingCheque(false);
              if (!result.ok) {
                setFormMessage(result.error ?? t("common.save_failed"));
                return;
              }
              setShowChequeModal(false);
              resetChequeForm();
              setActiveSection("cheques");
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={chDirection} onChange={(event) => setChDirection(event.target.value as "received" | "paid")} className={inputClass}>
                <option value="received">{t("bank.received")}</option>
                <option value="paid">{t("bank.paid")}</option>
              </select>
              <input required placeholder={t("bank.cheque_no")} value={chNo} onChange={(event) => setChNo(event.target.value)} className={inputClass} />
              <select value={chBank} onChange={(event) => setChBank(event.target.value)} className={inputClass}>
                {LK_BANKS.map((bank) => <option key={bank}>{bank}</option>)}
              </select>
              <input required placeholder={t("bank.party_name")} value={chParty} onChange={(event) => setChParty(event.target.value)} className={inputClass} />
              <input type="number" required placeholder={t("bank.amount")} value={chAmount || ""} onChange={(event) => setChAmount(Number(event.target.value))} className={inputClass} />
              <input type="date" required value={chDate} onChange={(event) => setChDate(event.target.value)} className={inputClass} />
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700 sm:col-span-2">
                <input type="checkbox" checked={chPostDated} onChange={(event) => setChPostDated(event.target.checked)} />
                {t("bank.pdc")}
              </label>
            </div>
            {formMessage && showChequeModal && <p className="mt-3 text-sm font-medium text-amber-700">{formMessage}</p>}
          </form>
        </Dialog>

        <Dialog
          open={!!statusCheque}
          onClose={() => setStatusCheque(null)}
          title={statusCheque?.partyName ?? ""}
          description={statusCheque ? `${statusCheque.chequeNo} — ${formatLkr(statusCheque.amount)}` : undefined}
          footer={
            <DrawerFooter
              onCancel={() => setStatusCheque(null)}
              primaryLabel={savingChequeStatus ? t("common.saving") : t("common.save")}
              primaryDisabled={savingChequeStatus}
              primaryLoading={savingChequeStatus}
              onPrimary={async () => {
                if (!statusCheque || savingChequeStatus) return;
                setSavingChequeStatus(true);
                setFormMessage("");
                const result = await updateChequeStatusToCloud(
                  statusCheque.id,
                  selectedChequeStatus,
                  depositAccountId || data.bankAccounts[0]?.id,
                );
                setSavingChequeStatus(false);
                if (!result.ok) {
                  setFormMessage(result.error ?? t("common.save_failed"));
                  return;
                }
                setStatusCheque(null);
              }}
            />
          }
        >
          <label className="block text-sm font-medium text-slate-700">
            {t("bank.status_col")}
            <select
              className={`${inputClass} mt-2`}
              value={selectedChequeStatus}
              onChange={(event) => {
                const status = event.target.value as ChequeStatus;
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
            <label className="mt-4 block text-sm font-medium text-slate-700">
              {t("bank.total_balance")}
              <select
                className={`${inputClass} mt-2`}
                value={depositAccountId || data.bankAccounts[0].id}
                onChange={(event) => setDepositAccountId(event.target.value)}
              >
                {data.bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.bankName} — {account.accountNumber}</option>
                ))}
              </select>
            </label>
          )}
        </Dialog>
      </ProMain>
    </AppShell>
  );
}

function ChequeStatusBadge({ status, label }: { status: ChequeStatus; label: string }) {
  const tone =
    status === "cleared"
      ? "positive"
      : status === "bounced"
        ? "danger"
        : status === "deposited"
          ? "info"
          : "warning";
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
