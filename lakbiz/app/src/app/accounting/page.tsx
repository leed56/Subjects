"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProCard, ProLoadingState } from "@/components/ui/pro-shell";
import { PageHeader, Button, EmptyState } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/table";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useOnlineStatus } from "@/lib/offline/connectivity";
import { formatLkr } from "@/lib/format";
import { parseLedgerAmount, validateJournal } from "@/lib/general-ledger";
import {
  fetchGeneralLedger,
  initializeGeneralLedger,
  postGeneralLedgerJournal,
  LedgerUnavailable,
  type LedgerSnapshot,
} from "@/lib/supabase/general-ledger-client";

import { LedgerDetail } from "@/components/accounting/ledger-detail";
import { LedgerStatements } from "@/components/accounting/ledger-statements";
import { SalesLedgerBridge } from "@/components/accounting/sales-ledger-bridge";

type DraftLine = { accountCode: string; debit: string; credit: string };
const blankLines = (): DraftLine[] => [
  { accountCode: "1000", debit: "", credit: "" },
  { accountCode: "3000", debit: "", credit: "" },
];
export default function AccountingPage() {
  const { org, orgRole } = useSubscription();
  return <AccountingWorkspace key={`${org.id ?? "guest"}:${orgRole}`} />;
}
function AccountingWorkspace() {
  const { org, orgRole, can, isReadOnly, ready } = useSubscription();
  const { locale } = useLocale();
  const online = useOnlineStatus();
  const copy = (en: string, si: string, ta: string) =>
    locale === "si" ? si : locale === "ta" ? ta : en;
  const [result, setResult] = useState<{
    orgId: string;
    data?: LedgerSnapshot;
    error?: string;
    unavailable?: boolean;
  } | null>(null);
  const [selection, setSelection] = useState<
    { batchId: string } | { accountId: string } | null
  >(null);
  const [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [locked, setLocked] = useState(false),
    [notice, setNotice] = useState("");
  const [date, setDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
  const [memo, setMemo] = useState(""),
    [lines, setLines] = useState(blankLines);
  const requestKey = useRef<string | null>(null),
    inFlight = useRef(false);
  useEffect(() => {
    if (!ready || orgRole !== "owner" || !org.isAuthenticated || !org.id)
      return;
    const orgId = org.id;
    let alive = true;
    fetchGeneralLedger(orgId)
      .then((data) => {
        if (alive) setResult({ orgId, data });
      })
      .catch((error) => {
        if (alive)
          setResult({
            orgId,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load accounting",
            unavailable: error instanceof LedgerUnavailable,
          });
      });
    return () => {
      alive = false;
    };
  }, [ready, org.id, org.isAuthenticated, orgRole, revision]);
  const current = result?.orgId === org.id ? result : null;
  const data = current?.data;
  const writable =
    orgRole === "owner" &&
    org.isAuthenticated &&
    !isReadOnly &&
    can("banking") &&
    online;
  async function initialize() {
    if (!org.id || !writable || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice("");
    try {
      await initializeGeneralLedger(org.id);
      setRevision((v) => v + 1);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to initialize accounting",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function post(event: FormEvent) {
    event.preventDefault();
    if (!org.id || !data || !writable || inFlight.current) return;
    try {
      const parsed = lines.map((line) => ({
        accountCode: line.accountCode,
        debitMinor: line.debit ? parseLedgerAmount(line.debit) : 0,
        creditMinor: line.credit ? parseLedgerAmount(line.credit) : 0,
      }));
      validateJournal(parsed, data.accounts);
      if (!memo.trim() || memo.trim().length > 500)
        throw new Error("Enter a journal description (up to 500 characters).");
      inFlight.current = true;
      setBusy(true);
      setLocked(true);
      setNotice("");
      requestKey.current ??= `manual:${crypto.randomUUID()}`;
      const id = await postGeneralLedgerJournal(
        org.id,
        requestKey.current,
        date,
        memo.trim(),
        parsed,
      );
      setNotice(
        `${copy("Journal posted", "සටහන තහවුරු කරන ලදී", "பதிவு செய்யப்பட்டுவிட்டது")}: ${id}`,
      );
      requestKey.current = null;
      setLocked(false);
      setMemo("");
      setLines(blankLines());
      setRevision((v) => v + 1);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to post journal",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-50";
  function updateLine(index: number, key: keyof DraftLine, value: string) {
    setLines((previous) =>
      previous.map((line, i) =>
        i === index ? { ...line, [key]: value } : line,
      ),
    );
  }
  return (
    <AppShell>
      <ProMain>
        <PageHeader
          sector={org.sector}
          title={copy("Accounting", "ගිණුම්කරණය", "கணக்கியல்")}
          description={copy(
            "General ledger, journal entries and trial balance.",
            "ප්‍රධාන ලෙජරය, ජර්නල් සටහන් සහ ශේෂ පිරික්සුම.",
            "பொதுப் பேரேடு, பதிவுகள் மற்றும் இருப்புச் சோதனை.",
          )}
        />
        {!ready ? (
          <ProLoadingState label="Loading accounting" />
        ) : orgRole !== "owner" ? (
          <EmptyState title="Owner access only" />
        ) : !org.isAuthenticated ? (
          <EmptyState
            title="Sign in to your business account"
            description="Production accounting uses your connected business. Client showcase balances are separate."
          />
        ) : !current ? (
          <ProLoadingState label="Loading ledger" />
        ) : current.error ? (
          <ProCard>
            <p role="alert" className="text-sm text-amber-800">
              {current.error}
            </p>
            <Button className="mt-3" onClick={() => setRevision((v) => v + 1)}>
              Retry
            </Button>
          </ProCard>
        ) : (
          data && (
            <div className="space-y-5">
              <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                {copy(
                  "Manual journals are available. New-sale revenue/VAT posting is a separate owner opt-in below. Historical sales, purchases and stock are not imported. A journal does not change physical stock or customer balances.",
                  "ජර්නල් සටහන් ඇතුළත් කළ හැක. නව අලෙවි ආදායම්/VAT සටහන් සඳහා හිමිකරු පහතින් සක්‍රීය කළ යුතුය. පැරණි අලෙවි, මිලදී ගැනීම් හෝ තොග ආනයනය නොවේ. සටහනකින් තොග හෝ පාරිභෝගික ශේෂ වෙනස් නොවේ.",
                  "நேரடி பதிவுகள் கிடைக்கும். புதிய விற்பனை வருவாய்/VAT பதிவை உரிமையாளர் கீழே செயல்படுத்த வேண்டும். பழைய விற்பனை, கொள்முதல், சரக்கு இறக்குமதி செய்யப்படாது. பதிவு சரக்கு அல்லது வாடிக்கையாளர் இருப்பை மாற்றாது.",
                )}
              </div>
              {notice && (
                <p
                  role="status"
                  className="rounded-xl border border-slate-200 bg-white p-4 text-sm"
                >
                  {notice}
                </p>
              )}
              {data.accounts.length === 0 ? (
                <ProCard title="Set up your chart of accounts">
                  <p className="mb-4 text-sm text-slate-500">
                    Creates standard LKR accounts without importing or changing
                    existing balances.
                  </p>
                  <Button
                    variant="primary"
                    onClick={initialize}
                    disabled={!writable}
                    loading={busy}
                  >
                    Initialize accounts
                  </Button>
                </ProCard>
              ) : (
                <>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setRevision((value) => value + 1)}
                    >
                      Refresh ledger reports
                    </Button>
                  </div>
                  <LedgerStatements
                    trial={data.trial}
                    onAccount={(accountId) => setSelection({ accountId })}
                  />
                  {org.id ? <SalesLedgerBridge key={org.id} orgId={org.id} writable={writable} onJournal={(batchId) => setSelection({ batchId })} /> : null}
                  <ProCard
                    title={copy(
                      "Trial balance · LKR",
                      "ශේෂ පිරික්සුම · LKR",
                      "இருப்புச் சோதனை · LKR",
                    )}
                  >
                    <DataTable
                      rows={data.trial}
                      columns={[
                        {
                          key: "code",
                          header: "Account",
                          render: (row) => (
                            <button
                              type="button"
                              className="text-left font-medium text-blue-700 hover:underline"
                              onClick={() =>
                                setSelection({ accountId: row.id })
                              }
                            >
                              {row.code} · {row.name}
                            </button>
                          ),
                        },
                        {
                          key: "debit",
                          header: "Debit",
                          align: "right",
                          render: (row) => formatLkr(row.debitMinor / 100),
                        },
                        {
                          key: "credit",
                          header: "Credit",
                          align: "right",
                          render: (row) => formatLkr(row.creditMinor / 100),
                        },
                      ]}
                    />
                  </ProCard>
                  {selection && org.id && (
                    <LedgerDetail
                      key={JSON.stringify(selection)}
                      orgId={org.id}
                      selection={selection}
                      accounts={data.accounts}
                      onClose={() => setSelection(null)}
                    />
                  )}
                  <ProCard
                    title={copy(
                      "Post a journal",
                      "ජර්නල් සටහනක් ඇතුළත් කරන්න",
                      "பதிவைச் சேர்",
                    )}
                  >
                    <form onSubmit={post} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                        <label className="text-sm">
                          Date
                          <input
                            required
                            type="date"
                            className={inputClass}
                            value={date}
                            disabled={locked || busy}
                            onChange={(e) => setDate(e.target.value)}
                          />
                        </label>
                        <label className="text-sm">
                          Description
                          <input
                            required
                            maxLength={500}
                            className={inputClass}
                            value={memo}
                            disabled={locked || busy}
                            onChange={(e) => setMemo(e.target.value)}
                          />
                        </label>
                      </div>
                      {lines.map((line, index) => (
                        <div
                          key={index}
                          className="grid gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-[2fr_1fr_1fr]"
                        >
                          <label className="text-xs">
                            Account · {index + 1}
                            <select
                              className={inputClass}
                              value={line.accountCode}
                              disabled={locked || busy}
                              onChange={(e) =>
                                updateLine(index, "accountCode", e.target.value)
                              }
                            >
                              {data.accounts.map((account) => (
                                <option key={account.id} value={account.code}>
                                  {account.code} · {account.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-xs">
                            Debit · LKR
                            <input
                              inputMode="decimal"
                              className={inputClass}
                              value={line.debit}
                              disabled={locked || busy}
                              onChange={(e) =>
                                updateLine(index, "debit", e.target.value)
                              }
                            />
                          </label>
                          <label className="text-xs">
                            Credit · LKR
                            <input
                              inputMode="decimal"
                              className={inputClass}
                              value={line.credit}
                              disabled={locked || busy}
                              onChange={(e) =>
                                updateLine(index, "credit", e.target.value)
                              }
                            />
                          </label>
                        </div>
                      ))}
                      {locked && (
                        <p className="text-sm text-amber-800">
                          This entry is locked for a safe retry. Retry sends the
                          same journal once; review the ledger if the connection
                          was interrupted.
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3">
                        <Button
                          disabled={locked || busy || lines.length >= 200}
                          onClick={() =>
                            setLines((previous) => [
                              ...previous,
                              { accountCode: "1000", debit: "", credit: "" },
                            ])
                          }
                        >
                          Add line
                        </Button>
                        {lines.length > 2 && (
                          <Button
                            disabled={locked || busy}
                            onClick={() =>
                              setLines((previous) => previous.slice(0, -1))
                            }
                          >
                            Remove last line
                          </Button>
                        )}
                        <Button
                          variant="primary"
                          type="submit"
                          disabled={!writable}
                          loading={busy}
                        >
                          {locked ? "Retry same journal" : "Post journal"}
                        </Button>
                      </div>
                      {!writable && (
                        <p className="text-sm text-amber-800">
                          Posting requires an online owner account with an
                          active banking entitlement.
                        </p>
                      )}
                    </form>
                  </ProCard>
                  <ProCard title="Recent journals · latest 50">
                    <DataTable
                      rows={data.journals}
                      columns={[
                        {
                          key: "date",
                          header: "Date",
                          render: (row) => row.journal_date,
                        },
                        {
                          key: "memo",
                          header: "Description",
                          render: (row) => row.memo,
                        },
                        {
                          key: "id",
                          header: "Reference",
                          render: (row) => (
                            <button
                              type="button"
                              className="font-mono text-xs text-blue-700 hover:underline"
                              onClick={() => setSelection({ batchId: row.id })}
                            >
                              {row.id}
                            </button>
                          ),
                        },
                      ]}
                      emptyState={
                        <EmptyState
                          title="No posted journals"
                          description="Initialize opening balances only after reconciling your existing accounts."
                        />
                      }
                    />
                  </ProCard>
                </>
              )}
            </div>
          )
        )}
      </ProMain>
    </AppShell>
  );
}
