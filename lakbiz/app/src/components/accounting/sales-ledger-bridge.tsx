"use client";
import { useEffect, useRef, useState } from "react";
import { ProCard } from "@/components/ui/pro-shell";
import { Button } from "@/components/ui/primitives";
import { DataTable } from "@/components/ui/table";
import { LedgerUnavailable } from "@/lib/supabase/general-ledger-client";
import { fetchSalesLedger, setSalesLedgerEnabled, type SalesLedgerSnapshot } from "@/lib/supabase/sales-ledger-client";

export function SalesLedgerBridge({ orgId, writable, onJournal }: {
  orgId: string;
  writable: boolean;
  onJournal: (id: string) => void;
}) {
  const [result, setResult] = useState<{ orgId: string; reviewOnly: boolean; data?: SalesLedgerSnapshot; error?: string; unavailable?: boolean } | null>(null);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [revision, setRevision] = useState(0);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => {
    let current = true;
    fetchSalesLedger(orgId, reviewOnly).then(data => {
      if (current) setResult({ orgId, reviewOnly, data });
    }).catch(error => {
      if (current) setResult({ orgId, reviewOnly, error: error instanceof Error ? error.message : "Unable to load sales integration", unavailable: error instanceof LedgerUnavailable });
    });
    return () => { current = false; };
  }, [orgId, revision, reviewOnly]);
  const current = result?.orgId === orgId && result.reviewOnly === reviewOnly ? result : null;
  const data = current?.data;
  async function toggle() {
    if (!data || !writable || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice("");
    try {
      await setSalesLedgerEnabled(orgId, !data.enabled, acknowledged);
      if (alive.current) {
        setAcknowledged(false);
        // Reload the authoritative setting; do not assume success from local state.
        setResult(null);
        setRevision(value => value + 1);
        setNotice("Setting saved. Existing sales and journals were not changed.");
      }
    } catch (error) {
      if (alive.current) {
        setNotice(error instanceof Error ? error.message : "Unable to save integration setting");
        // Reconcile a lost response before another attempt.
        setResult(null);
        setRevision(value => value + 1);
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return <ProCard title="Sales → accounting">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${data?.enabled ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
        {current?.unavailable ? "Migration pending" : !current ? "Loading status" : current.error ? "Status unavailable" : data?.enabled ? "New-sales posting enabled" : "Automatic posting off"}
      </span>
      <Button type="button" variant="secondary" disabled={busy} onClick={() => { setResult(null); setRevision(value => value + 1); }}>Refresh integration</Button>
    </div>
    <p className="text-sm leading-6 text-slate-600">
      Opt-in for new sales only: cash, card clearing, bank transfers and credit receivables are posted against net sales and VAT from the saved invoice. No historical import, COGS, stock valuation, purchase, return or later-settlement posting is included. These entries alone are not your complete business profit.
    </p>
    {notice ? <p role="status" className="mt-3 text-sm text-sky-800">{notice}</p> : null}
    {!current ? <p role="status" className="mt-4 text-sm text-slate-500">Loading integration…</p> : current.error ?
      <p role="alert" className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">{current.error}</p> : data ? <>
        <div className="my-5 rounded-xl border border-sky-100 bg-sky-50 p-4">
          {!data.enabled ? <label className="mb-3 flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={acknowledged} disabled={!writable || busy} onChange={event => setAcknowledged(event.target.checked)} className="mt-1 h-4 w-4 accent-blue-600" />
            <span>I understand this starts with new sales only, posts revenue/VAT without COGS, and leaves unsupported sources for review. I have not manually posted the same new sales.</span>
          </label> : <p className="mb-3 text-sm text-sky-900">Posted invoice totals and tender evidence are protected from edits. Disabling preserves all existing journals.</p>}
          <Button type="button" variant={data.enabled ? "secondary" : "primary"} loading={busy} disabled={!writable || busy || (!data.enabled && !acknowledged)} onClick={toggle}>
            {data.enabled ? "Disable new-sales posting" : "Enable for new sales"}
          </Button>
          {!writable ? <p className="mt-2 text-xs text-slate-600">An online owner with an active banking entitlement is required to change this setting.</p> : null}
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-semibold text-slate-900">Show
            <select className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1 font-normal" value={reviewOnly ? "review" : "all"} disabled={busy} onChange={event => setReviewOnly(event.target.value === "review")}>
              <option value="all">Latest 50 captured sales</option>
              <option value="review">Latest 50 requiring review</option>
            </select>
          </label>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{data.reviewCount} requiring review · all captured sales</span>
        </div>
        <DataTable rows={data.events} emptyState={<p className="py-5 text-sm text-slate-500">{reviewOnly ? "No sales requiring review." : "No captured sales. Sales made before enabling are intentionally excluded."}</p>} columns={[
          { key: "sale", header: "Sale", render: row => <span className="break-all">{row.sale_id}</span> },
          { key: "status", header: "Status", render: row => <span className={`rounded-full px-2 py-1 text-xs font-medium ${row.status === "posted" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{row.status === "needs_review" ? "Needs review" : row.status === "posted" ? "Posted" : "Pending"}</span> },
          { key: "reason", header: "Review / journal", render: row => row.journal_id ? <button type="button" className="font-medium text-blue-700 hover:underline" onClick={() => onJournal(row.journal_id!)}>View journal</button> : <span className="text-xs">{row.reason ?? "Awaiting transaction completion"}</span> },
        ]} />
        <p className="mt-3 text-xs leading-5 text-slate-500">Cheque, return-credit and missing or invalid tender evidence require separate adapters. Review entries are not posted automatically; there is no resolution or historical replay action in this phase. Refresh ledger reports separately to see newly posted totals.</p>
      </> : null}
  </ProCard>;
}
