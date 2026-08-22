"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ConfirmDialog } from "@/components/ui/overlay";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import {
  fetchActiveReturnHolds,
  resolveReturnHold,
  returnHoldSchemaUnavailable,
  setReturnHoldDisposition,
  type ReturnHoldAction,
  type ReturnHoldDisposition,
  type ReturnHoldRecord,
} from "@/lib/supabase/return-hold-client";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)]";
const secondary =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

type ResolveTarget = { hold: ReturnHoldRecord; action: ReturnHoldAction } | null;

function dispositionTone(disposition: ReturnHoldDisposition): "warning" | "danger" | "info" {
  if (disposition === "damaged") return "danger";
  if (disposition === "quarantine") return "warning";
  return "info";
}

export default function ReturnInspectionPage() {
  const { data, ready } = useAppStore();
  const { org, orgRole } = useSubscription();
  const [holds, setHolds] = useState<ReturnHoldRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [resolveTarget, setResolveTarget] = useState<ResolveTarget>(null);

  const canInspect = orgRole === "owner" || orgRole === "manager";
  const pharmacy = org.sector === "pharmacy";

  const load = async () => {
    if (!org.isAuthenticated || !org.id || !canInspect) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await fetchActiveReturnHolds(org.id);
    setHolds(result.data);
    setError(result.error);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    if (!org.isAuthenticated || !org.id || !canInspect) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchActiveReturnHolds(org.id).then((result) => {
      if (cancelled) return;
      setHolds(result.data);
      setError(result.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [canInspect, org.id, org.isAuthenticated]);

  const productsById = useMemo(
    () => new Map((data?.products ?? []).map((product) => [product.id, product] as const)),
    [data?.products],
  );
  const totalQty = holds.reduce((sum, hold) => sum + hold.qty, 0);
  const inspectionQty = holds.filter((hold) => hold.disposition === "inspection").reduce((sum, hold) => sum + hold.qty, 0);
  const quarantineQty = holds.filter((hold) => hold.disposition === "quarantine").reduce((sum, hold) => sum + hold.qty, 0);
  const damagedQty = holds.filter((hold) => hold.disposition === "damaged").reduce((sum, hold) => sum + hold.qty, 0);

  const changeDisposition = async (hold: ReturnHoldRecord, disposition: ReturnHoldDisposition) => {
    if (!org.id || busyId) return;
    setBusyId(hold.id);
    setError(null);
    const result = await setReturnHoldDisposition(org.id, hold.id, disposition, notes[hold.id]);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "Could not update inspection disposition.");
      return;
    }
    await load();
  };

  const confirmResolution = async () => {
    if (!resolveTarget || !org.id || busyId) return;
    const { hold, action } = resolveTarget;
    const note = notes[hold.id]?.trim() ?? "";
    if (action === "write_off" && !note) {
      setResolveTarget(null);
      setError("Add an inspection note before writing off returned stock.");
      return;
    }

    setBusyId(hold.id);
    setError(null);
    const result = await resolveReturnHold(org.id, hold.id, action, note);
    setBusyId(null);
    setResolveTarget(null);
    if (!result.ok) {
      setError(result.error ?? "Could not resolve return inspection hold.");
      return;
    }

    // A write-off changes aggregate AppData stock and increments the server sync
    // generation. Full reload makes this device pull the authoritative snapshot
    // before it can push an older local copy. Resale release also benefits from
    // re-fetching exact identity availability immediately.
    window.location.reload();
  };

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain><ProLoadingState label="Loading return inspection…" /></ProMain>
      </AppShell>
    );
  }

  if (!org.isAuthenticated || !canInspect) {
    return (
      <AppShell>
        <ProMain>
          <EmptyState
            title="Owner or manager approval required"
            description="Customer-return inspection can change whether physical stock is sellable or written off, so cashier and data-entry accounts cannot resolve these holds."
            action={<Link href="/stock/advanced/queue" className={secondary}>Back to receiving queue</Link>}
          />
        </ProMain>
      </AppShell>
    );
  }

  const schemaMissing = returnHoldSchemaUnavailable(error);

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title="Return inspection"
          description="Resolve customer-return stock without changing the original invoice or double-moving inventory. Approval restores only the exact identity; write-off removes the physical quantity from stock."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/stock/advanced/queue" className={secondary}>Receiving queue</Link>
              <Link href="/returns" className={secondary}>Returns control</Link>
            </div>
          }
        />

        {pharmacy && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
            <p className="font-semibold">Pharmacy safety lock</p>
            <p className="mt-1 text-amber-800">Customer-returned medicine cannot be released to dispensing stock from this generic workflow. Keep it quarantined or write it off according to your pharmacy procedure.</p>
          </div>
        )}

        {loading ? (
          <ProLoadingState label="Loading active return holds…" />
        ) : schemaMissing ? (
          <section className={card}>
            <EmptyState
              title="Return-inspection database upgrade required"
              description="Apply the controlled return-hold resolution migration to the verified LakBiz Supabase project before resolving held stock."
              action={<Link href="/stock/advanced/queue" className={secondary}>Back to queue</Link>}
            />
          </section>
        ) : error && holds.length === 0 ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-800">{error}</div>
        ) : (
          <div className="space-y-5">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">{error}</div>
            )}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Held quantity</p>
                <p className="mt-2 text-3xl font-semibold">{totalQty}</p>
                <p className="mt-1 text-sm text-slate-300">{holds.length} inspection record{holds.length === 1 ? "" : "s"}</p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-sky-700">Inspection</p>
                <p className="mt-2 text-3xl font-semibold text-sky-950">{inspectionQty}</p>
                <p className="mt-1 text-sm text-sky-800">Awaiting decision</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-700">Quarantine</p>
                <p className="mt-2 text-3xl font-semibold text-amber-950">{quarantineQty}</p>
                <p className="mt-1 text-sm text-amber-800">Blocked from POS</p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-rose-700">Damaged</p>
                <p className="mt-2 text-3xl font-semibold text-rose-950">{damagedQty}</p>
                <p className="mt-1 text-sm text-rose-800">Needs write-off decision</p>
              </div>
            </section>

            {holds.length === 0 ? (
              <section className={card}>
                <EmptyState
                  title="No customer-return stock is on hold"
                  description="When a tracked return is kept out of POS for inspection, it will appear here with its exact batch, size/colour or IMEI identity."
                  action={<Link href="/stock/advanced/queue" className={secondary}>Receiving queue</Link>}
                />
              </section>
            ) : (
              <section className="grid gap-4 xl:grid-cols-2">
                {holds.map((hold) => {
                  const product = productsById.get(hold.productId);
                  const busy = busyId === hold.id;
                  return (
                    <article key={hold.id} className={card}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-700">{hold.returnNo}</p>
                          <h2 className="mt-1 truncate text-base font-semibold text-slate-950">{product?.name ?? "Returned stock"}</h2>
                          <p className="mt-1 text-xs text-slate-500">Returned {new Date(hold.createdAt).toLocaleString("en-LK")}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge tone={dispositionTone(hold.disposition)}>{hold.disposition}</StatusBadge>
                          <span className="rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-bold text-white">× {hold.qty}</span>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Exact returned identity</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{hold.identityLabel ?? "Identity unavailable — resale release is blocked"}</p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                        <Link href={`/bills/${hold.saleId}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 hover:text-teal-700">Original bill</Link>
                        <Link href={`/bills/${hold.saleId}/returns/${hold.returnId}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 hover:text-teal-700">Return finance</Link>
                      </div>

                      <label className="mt-4 block text-xs font-semibold text-slate-600">
                        Inspection note
                        <textarea
                          value={notes[hold.id] ?? hold.note ?? ""}
                          onChange={(event) => setNotes((current) => ({ ...current, [hold.id]: event.target.value }))}
                          rows={2}
                          placeholder="Condition found, packaging, test result or write-off reason"
                          className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-300 focus:ring-4 focus:ring-teal-100/70"
                        />
                      </label>

                      <div className="mt-4 border-t border-slate-100 pt-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Inspection disposition</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(["inspection", "quarantine", "damaged"] as ReturnHoldDisposition[]).map((disposition) => (
                            <button
                              key={disposition}
                              type="button"
                              disabled={busy || hold.disposition === disposition}
                              onClick={() => void changeDisposition(hold, disposition)}
                              className={`min-h-9 rounded-lg px-3 text-xs font-bold capitalize transition disabled:cursor-default ${
                                hold.disposition === disposition
                                  ? "bg-slate-950 text-white"
                                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                              }`}
                            >
                              {disposition}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="max-w-sm text-[11px] leading-5 text-slate-500">Resolving a hold is terminal and preserved in the inventory audit trail.</p>
                        <div className="flex flex-wrap gap-2">
                          {!pharmacy && (
                            <button
                              type="button"
                              disabled={busy || !hold.identityLabel || hold.disposition === "damaged"}
                              onClick={() => setResolveTarget({ hold, action: "approve_resale" })}
                              className="min-h-10 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Approve for resale
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setResolveTarget({ hold, action: "write_off" })}
                            className="min-h-10 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Write off
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </div>
        )}

        <ConfirmDialog
          open={resolveTarget !== null}
          title={resolveTarget?.action === "write_off" ? "Write off returned stock?" : "Approve returned stock for resale?"}
          description={
            resolveTarget?.action === "write_off"
              ? "This permanently removes the held physical quantity from aggregate stock. Add an inspection note before confirming."
              : "This restores only the exact batch, variant or serialized identity to POS availability. Aggregate stock will not be increased again."
          }
          confirmLabel={resolveTarget?.action === "write_off" ? "Write off" : "Approve resale"}
          tone={resolveTarget?.action === "write_off" ? "danger" : "default"}
          loading={resolveTarget ? busyId === resolveTarget.hold.id : false}
          onConfirm={() => void confirmResolution()}
          onClose={() => setResolveTarget(null)}
        />
      </ProMain>
    </AppShell>
  );
}
