"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import {
  ProBadge,
  ProButton,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
  ProPageHeader,
} from "@/components/ui/pro-shell";
import { useLocale } from "@/lib/i18n/locale-provider";
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

const copy = {
  en: {
    loading: "Loading bank-transfer settings…",
    ownerRequired: "Owner access required",
    ownerRequiredDesc: "Only the business owner can view or change the bank account used to receive POS bank transfers.",
    eyebrow: "Bank transfer setup",
    title: "Receiving account",
    description: "Choose where customer bank transfers from Sales / POS should be recorded. Only the business owner can view or change this account.",
    banking: "Banking",
    sales: "Sales / POS",
    unavailableTitle: "Bank-transfer setup is temporarily unavailable",
    unavailableDesc: "This setting is not available right now. Please try again later or contact LakBiz support if the problem continues.",
    backBanking: "Back to Banking",
    noAccountTitle: "Add a bank account first",
    noAccountDesc: "Add the real account that receives customer transfers in Banking, then return here to select it for POS sales.",
    openBanking: "Open Banking",
    current: "Current receiving account",
    notConfigured: "Not set up",
    notConfiguredDesc: "Bank-transfer payments from POS will stay unavailable until a receiving account is selected.",
    protected: "Only the owner can view this account and its Banking details.",
    settings: "Payment settings",
    chooseTitle: "Where should POS bank transfers go?",
    chooseDesc: "Select the account that receives customer bank transfers. Cashiers can record the payment without seeing the account balance or Banking activity.",
    bankAccount: "Bank account",
    selectAccount: "Select receiving account",
    savedMessage: "Receiving account updated.",
    saveError: "Could not save the receiving account.",
    saving: "Saving…",
    chooseButton: "Select an account",
    savedButton: "Saved",
    saveButton: "Save receiving account",
    active: "Active",
  },
  si: {
    loading: "බැංකු මාරු සැකසුම් පූරණය වෙමින්…",
    ownerRequired: "හිමිකරුගේ ප්‍රවේශය අවශ්‍යයි",
    ownerRequiredDesc: "POS බැංකු මාරු ලැබෙන ගිණුම බැලීමට හෝ වෙනස් කිරීමට හැක්කේ ව්‍යාපාර හිමිකරුට පමණි.",
    eyebrow: "බැංකු මාරු සැකසුම",
    title: "මුදල් ලැබෙන ගිණුම",
    description: "Sales / POS හරහා ලැබෙන පාරිභෝගික බැංකු මාරු සටහන් විය යුතු ගිණුම තෝරන්න. මෙම ගිණුම බැලීමට හෝ වෙනස් කිරීමට හැක්කේ හිමිකරුට පමණි.",
    banking: "බැංකු",
    sales: "විකුණුම් / POS",
    unavailableTitle: "බැංකු මාරු සැකසුම තාවකාලිකව ලබාගත නොහැක",
    unavailableDesc: "මෙම සැකසුම දැන් ලබාගත නොහැක. පසුව නැවත උත්සාහ කරන්න. ගැටලුව දිගටම පවතී නම් LakBiz සහාය අමතන්න.",
    backBanking: "බැංකු වෙත ආපසු",
    noAccountTitle: "පළමුව බැංකු ගිණුමක් එක් කරන්න",
    noAccountDesc: "පාරිභෝගික මාරු ලැබෙන සැබෑ ගිණුම Banking තුළ එක් කර, POS සඳහා එය තෝරා ගැනීමට මෙතැනට නැවත එන්න.",
    openBanking: "බැංකු විවෘත කරන්න",
    current: "දැනට මුදල් ලැබෙන ගිණුම",
    notConfigured: "තවම සකසා නැහැ",
    notConfiguredDesc: "මුදල් ලැබෙන ගිණුමක් තෝරා ගන්නා තෙක් POS බැංකු මාරු ගෙවීම් ලබාගත නොහැක.",
    protected: "මෙම ගිණුම සහ එහි Banking තොරතුරු බැලීමට හැක්කේ හිමිකරුට පමණි.",
    settings: "ගෙවීම් සැකසුම්",
    chooseTitle: "POS බැංකු මාරු ලැබිය යුත්තේ කොහෙටද?",
    chooseDesc: "පාරිභෝගික බැංකු මාරු ලැබෙන ගිණුම තෝරන්න. Cashierට ගිණුම් ශේෂය හෝ Banking ක්‍රියාකාරකම් නොපෙනී ගෙවීම සටහන් කළ හැක.",
    bankAccount: "බැංකු ගිණුම",
    selectAccount: "මුදල් ලැබෙන ගිණුම තෝරන්න",
    savedMessage: "මුදල් ලැබෙන ගිණුම යාවත්කාලීන කළා.",
    saveError: "මුදල් ලැබෙන ගිණුම සුරැකීමට නොහැකි විය.",
    saving: "සුරකිමින්…",
    chooseButton: "ගිණුමක් තෝරන්න",
    savedButton: "සුරැකිණි",
    saveButton: "මුදල් ලැබෙන ගිණුම සුරකින්න",
    active: "සක්‍රීය",
  },
} as const;

export default function PosBankRoutingPage() {
  const { data, ready } = useAppStore();
  const { locale } = useLocale();
  const text = locale === "si" ? copy.si : copy.en;
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
          <ProLoadingState label={text.loading} />
        </ProMain>
      </AppShell>
    );
  }

  if (!org.isAuthenticated || orgRole !== "owner") {
    return (
      <AppShell>
        <ProMain>
          <ProEmptyState
            title={text.ownerRequired}
            description={text.ownerRequiredDesc}
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
      setError(result.error ?? text.saveError);
      return;
    }

    setRouteAccountId(selectedAccountId);
    setMessage(text.savedMessage);
  }

  const buttonLabel = saving
    ? text.saving
    : !selectedAccountId
      ? text.chooseButton
      : selectedAccountId === routeAccountId
        ? text.savedButton
        : text.saveButton;

  return (
    <AppShell>
      <ProMain>
        <ProPageHeader
          eyebrow={text.eyebrow}
          title={text.title}
          description={text.description}
          actions={
            <>
              <ProButton href="/banking" variant="secondary">{text.banking}</ProButton>
              <ProButton href="/sales" variant="secondary">{text.sales}</ProButton>
            </>
          }
        />

        {upgradeNeeded ? (
          <ProCard>
            <ProEmptyState
              title={text.unavailableTitle}
              description={text.unavailableDesc}
              action={<ProButton href="/banking" variant="secondary">{text.backBanking}</ProButton>}
            />
          </ProCard>
        ) : loading ? (
          <ProLoadingState label={text.loading} />
        ) : data.bankAccounts.length === 0 ? (
          <ProCard>
            <ProEmptyState
              title={text.noAccountTitle}
              description={text.noAccountDesc}
              action={<ProButton href="/banking">{text.openBanking}</ProButton>}
            />
          </ProCard>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <ProCard className="h-fit">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">{text.current}</p>
                  <h2 className="mt-2 text-lg font-semibold text-slate-950">
                    {currentAccount ? currentAccount.bankName : text.notConfigured}
                  </h2>
                </div>
                {currentAccount && <ProBadge tone="emerald">{text.active}</ProBadge>}
              </div>

              {currentAccount ? (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)]">
                  <p className="text-sm font-semibold">{currentAccount.accountName}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {currentAccount.branch || "—"} · {currentAccount.accountNumber}
                  </p>
                  <div className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-slate-300">
                    {text.protected}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                  {text.notConfiguredDesc}
                </div>
              )}
            </ProCard>

            <ProCard>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">{text.settings}</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-950">{text.chooseTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text.chooseDesc}</p>

              <label className="mt-5 block text-xs font-bold text-slate-600">
                {text.bankAccount}
                <select
                  className={inputClass}
                  value={selectedAccountId}
                  onChange={(event) => {
                    setSelectedAccountId(event.target.value);
                    setMessage(null);
                    setError(null);
                  }}
                >
                  <option value="">{text.selectAccount}</option>
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
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
              >
                {buttonLabel}
              </button>
            </ProCard>
          </div>
        )}
      </ProMain>
    </AppShell>
  );
}
