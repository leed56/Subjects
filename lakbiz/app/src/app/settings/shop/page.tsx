"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { defaultBusiness, type BusinessInfo } from "@/lib/invoice";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  getOrCreateOrgForUser,
  saveOrgShopSettings,
} from "@/lib/supabase/org-settings";
import { updateBusiness as mergeBusinessIntoApp } from "@/lib/store/actions";
import { useAppStore } from "@/lib/store/use-app-store";
import { loadAppData, saveAppData } from "@/lib/store/storage";

const QUARTER_MONTHS = [
  { value: 1, key: "vat.month_jan" },
  { value: 4, key: "vat.month_apr" },
  { value: 7, key: "vat.month_jul" },
  { value: 10, key: "vat.month_oct" },
] as const;

function readDraftFromStorage(): BusinessInfo {
  return { ...loadAppData().business };
}

export default function ShopSettingsPage() {
  const { updateBusiness } = useAppStore();
  const { org } = useSubscription();
  const { user } = useAuth();
  const { t } = useLocale();

  // Match server + client first paint, then load localStorage once (avoids hydration flash)
  const [draft, setDraft] = useState<BusinessInfo>(defaultBusiness);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMode, setSaveMode] = useState<"local" | "cloud" | null>(null);

  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setDraft(readDraftFromStorage());
  }, []);

  const patch = useCallback((partial: Partial<BusinessInfo>) => {
    setSaved(false);
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload: BusinessInfo = {
      ...draft,
      name: draft.name.trim() || "My Shop",
      vatRegistered: draft.vatRegistered ?? false,
      quarterStartMonth: draft.quarterStartMonth ?? 4,
    };

    // 1) Persist locally first (sync) — survives refresh even if cloud fails
    const nextApp = mergeBusinessIntoApp(loadAppData(), payload);
    saveAppData(nextApp);
    updateBusiness(payload);
    setDraft(payload);

    // 2) Cloud sync in background — no refreshOrg, no form re-init
    let cloudOk = false;
    if (user && isSupabaseConfigured()) {
      let targetOrgId = org.id;
      if (!targetOrgId) {
        const { orgId } = await getOrCreateOrgForUser(user.id, payload);
        targetOrgId = orgId;
      }
      if (targetOrgId) {
        const cloudError = await saveOrgShopSettings(targetOrgId, payload);
        cloudOk = !cloudError;
        if (cloudError) setError(t("vat.cloud_sync_note"));
      }
    } else if (!user) {
      setError(t("vat.sign_in_for_cloud"));
    }

    setSaveMode(cloudOk ? "cloud" : "local");
    setSaved(true);
    setSaving(false);
  };

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">{t("vat.shop_settings")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("vat.shop_settings_hint")}</p>

        {saved && (
          <p className="mt-4 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {saveMode === "cloud"
              ? t("vat.settings_saved_cloud")
              : t("vat.settings_saved_local")}
            {error ? (
              <span className="mt-1 block text-amber-800">{error}</span>
            ) : null}
          </p>
        )}

        {error && !saved && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </p>
        )}

        <form onSubmit={handleSave} className="mt-6 space-y-4 rounded-xl border bg-white p-5">
          <label className="block text-sm">
            {t("vat.shop_name")} *
            <input
              required
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            {t("common.phone")}
            <input
              value={draft.phone ?? ""}
              onChange={(e) => patch({ phone: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            {t("common.address")}
            <input
              value={draft.address ?? ""}
              onChange={(e) => patch({ address: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>

          <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-4">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.vatRegistered ?? false}
                onChange={(e) => patch({ vatRegistered: e.target.checked })}
                className="h-4 w-4 rounded border-teal-600"
              />
              {t("vat.registered")}
            </label>
            <p className="mt-2 text-xs text-slate-600">{t("vat.registered_hint")}</p>

            {draft.vatRegistered && (
              <div className="mt-4 space-y-3">
                <label className="block text-sm">
                  {t("vat.vat_number")}
                  <input
                    value={draft.vatNumber ?? ""}
                    onChange={(e) => patch({ vatNumber: e.target.value })}
                    placeholder="VAT-XXXXXXX"
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  {t("vat.quarter_start")}
                  <select
                    value={draft.quarterStartMonth ?? 4}
                    onChange={(e) =>
                      patch({ quarterStartMonth: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  >
                    {QUARTER_MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {t(m.key)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {saving ? t("common.loading") : t("common.save")}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          {user && org.id
            ? t("vat.save_hint_cloud")
            : user
              ? t("vat.save_hint_create_org")
              : t("vat.save_hint_local")}
        </p>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/vat" className="text-teal-700 underline">
            {t("vat.view_return")}
          </Link>
          {" · "}
          <Link href="/dashboard" className="text-teal-700 underline">
            {t("nav.dashboard")}
          </Link>
          {" · "}
          <Link href="/settings/billing" className="text-teal-700 underline">
            {t("nav.billing")}
          </Link>
        </p>
      </main>
    </div>
  );
}
