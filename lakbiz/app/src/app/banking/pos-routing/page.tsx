"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import {
  ProButton,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
  ProPageHeader,
} from "@/components/ui/pro-shell";
import {
  configurePosBankRoute,
  fetchPosBankRoute,
  saleTenderSchemaUnavailable,
} from "@/lib/supabase/sale-tender-client";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useWriteAccess } from "@/lib/subscription/use-can-write";

const inputClass =
  "mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-teal-300 focus:ring-4 focus:ring-teal-100";

export default function PosBankRoutingPage() {
  const { data, ready } = useAppStore();
  const { org, orgRole } = useSubscription();
  const { canWrite, disabledHint } = useWriteAccess();
  const [routeAccountId, setRouteAccountId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!org.isAuthenticated || !org.id || orgRole !== "owner") {
        if (!cancelled) setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      const result = await fetchPosBankRoute(org.id);
      if (cancelled) return;

      if (saleTenderSchemaUnavailable(result.error)) {
        setUpgradeNeeded(true);
        setLoading(false);
        return;
      }

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      const id = result.bankAccountId ?? "";
      setRouteAccountId(id);
      setSelectedAccountId(id);
      setUpgradeNeeded(false);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [org.id, org.isAuthenticated, orgRole]);

  const currentAccount = useMemo(
    () => data?.bankAccounts.find((account) => account.id === routeAccountId) ?? null,
    [data?.bankAccounts, routeAccountId],
  );

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label="Loading POS payment routing…" />
        </ProMain>
      </AppShell>
    );
  }

  if (!org.isAuthenticated || orgRole !== "owner") {
    return (
      <AppShell>
        <ProMain>
          <ProEmptyState
            title="Owner access required"
            description="The POS bank destination is part of the private financial configuration and can only be changed by the business owner."
            action={<ProButton href="/dashboard">Dashboard</ProButton>}
          />
        </ProMain>
      </AppShell>
    );
  }

  async function saveRoute() {
    if (!org.id || !selectedAccountId || saving) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    const result = await configurePosBankRoute(org.id, selectedAccountId);
    setSaving(false);

    if (!result.ok) {
      if (saleTenderSchemaUnavailable(result.error)) {
        setUpgradeNeeded(true);
        return;
      }
      setError(result.error ?? "Could not save the POS bank destination.");
      return;
    }

    setRouteAccountId(selectedAccountId);
    setMessage("POS bank-transfer destination updated.");
  }

  return (
    <AppShell>
      <ProMain>
        <ProPageHeader
          eyebrow="Private payment routing"
          title="POS bank-transfer destination"
          description="Choose the owner bank account that receives POS bank-transfer payments. Cashier and data-entry accounts can accept the transfer without seeing this account id, account balance or Banking ledger."
          actions={
            <>
              <ProButton href="/banking" variant="secondary">Banking</ProButton>
              <ProButton href="/sales" variant="secondary">Sales / POS</ProButton>
            </>
          }
        />

        {upgradeNeeded ? (
          <ProCard>
            <ProEmptyState
              title="Payment-routing database upgrade required"
              description="Migrations 00015–00017 must be applied to the verified LakBiz Supabase project before this private route can be configured."
              action={<ProButton href="/banking" variant="secondary">Back to Banking</ProButton>}
            />
          </ProCard>
        ) : loading ? (
          <ProLoadingState label="Loading private POS route…" />
        ) : data.bankAccounts.length === 0 ? (
          <ProCard>
            <ProEmptyState
              title="Add a real bank account first"
              description="LakBiz will not invent a bank account for POS settlements. Add the owner's actual receiving account in Banking, then choose it here."
              action={<ProButton href="/banking">Open Banking</ProButton>}
            />
          </ProCard>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <ProCard>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">Current route</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">
                {currentAccount ? currentAccount.bankName : "Not configured"}
              </h2>
              {currentAccount ? (
                <div className="mt-4 rounded-2xl bg-slate-950 p-5 text-white">
                  <p className="text-sm font-semibold">{currentAccount.accountName}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {currentAccount.branch || "—"} · {currentAccount.accountNumber}
                  </p>
                  <p className="mt-4 text-xs leading-5 text-slate-300">
                    Operational POS users do not receive this account identifier or its balance. The database resolves it privately when the sale is finalized.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Bank-transfer checkout will remain blocked for Banking-enabled businesses until the owner selects a destination.
                </p>
              )}
            </ProCard>

            <ProCard>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">Owner configuration</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">Receiving account</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Select the real account where customer POS transfers should be posted. This setting does not expose Banking access to managers, cashiers or data-entry users.
              </p>

              <label className="mt-5 block text-xs font-bold text-slate-600">
                Bank account
                <select
                  className={inputClass}
                  value={selectedAccountId}
                  onChange={(event) => {
                    setSelectedAccountId(event.target.value);
                    setMessage(null);
                    setError(null);
                  }}
                >
                  <option value="">Select receiving account</option>
                  {data.bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.bankName} · {account.accountName} · {account.accountNumber}
                    </option>
                  ))}
                </select>
              </label>

              {message && (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  {message}
                </p>
              )}
              {error && (
                <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={() => void saveRoute()}
                disabled={!canWrite || !selectedAccountId || saving || selectedAccountId === routeAccountId}
                title={!canWrite ? disabledHint ?? undefined : undefined}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving destination…" : selectedAccountId === routeAccountId ? "Destination saved" : "Save POS destination"}
              </button>
            </ProCard>
          </div>
        )}
      </ProMain>
    </AppShell>
  );
}
