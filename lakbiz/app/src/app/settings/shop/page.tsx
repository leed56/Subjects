"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

function normalizePayload(form: BusinessInfo): BusinessInfo {
  return {
    ...form,
    name: form.name.trim() || "My Shop",
    phone: form.phone?.trim() || undefined,
    address: form.address?.trim() || undefined,
    vatRegistered: form.vatRegistered ?? false,
    vatNumber: form.vatRegistered
      ? form.vatNumber?.trim() || undefined
      : undefined,
    quarterStartMonth: form.quarterStartMonth ?? 4,
  };
}

export default function ShopSettingsPage() {
  const { updateBusiness } = useAppStore();
  const { org } = useSubscription();
  const { user } = useAuth();
  const { t } = useLocale();

  const [form, setForm] = useState<BusinessInfo>(defaultBusiness);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"ok" | "warn">("ok");

  useEffect(() => {
    setForm({ ...loadAppData().business });
    setLoaded(true);
  }, []);

  const patch = useCallback((partial: Partial<BusinessInfo>) => {
    setStatus(null);
    setForm((prev) => ({ ...prev, ...partial }));
  }, []);

  const saveLocal = useCallback(
    (payload: BusinessInfo) => {
      saveAppData(mergeBusinessIntoApp(loadAppData(), payload));
      updateBusiness(payload);
    },
    [updateBusiness],
  );

  const syncCloud = useCallback(
    async (payload: BusinessInfo) => {
      if (!user || !isSupabaseConfigured()) return false;

      let targetOrgId = org.id;
      if (!targetOrgId) {
        const { orgId } = await getOrCreateOrgForUser(user.id, payload);
        targetOrgId = orgId;
      }
      if (!targetOrgId) return false;

      const err = await saveOrgShopSettings(targetOrgId, payload);
      return !err;
    },
    [org.id, user],
  );

  const onSave = useCallback(() => {
    const payload = normalizePayload(form);

    try {
      saveLocal(payload);
      setStatusKind("ok");
      setStatus(t("vat.settings_saved_local"));

      void syncCloud(payload).then((cloudOk) => {
        if (cloudOk) {
          setStatusKind("ok");
          setStatus(t("vat.settings_saved_cloud"));
        } else if (user && isSupabaseConfigured()) {
          setStatusKind("warn");
          setStatus(`${t("vat.settings_saved_local")} — ${t("vat.cloud_sync_note")}`);
        } else if (!user) {
          setStatusKind("warn");
          setStatus(`${t("vat.settings_saved_local")} — ${t("vat.sign_in_for_cloud")}`);
        }
      });
    } catch (err) {
      setStatusKind("warn");
      setStatus(err instanceof Error ? err.message : "Save failed");
    }
  }, [form, saveLocal, syncCloud, t, user]);

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">{t("vat.shop_settings")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("vat.shop_settings_hint")}</p>

        <div className="mt-4 min-h-[3rem]">
          {status && (
            <p
              className={`rounded-lg px-4 py-3 text-sm ${
                statusKind === "ok"
                  ? "bg-teal-50 text-teal-800"
                  : "bg-amber-50 text-amber-900"
              }`}
            >
              {status}
            </p>
          )}
        </div>

        <div className="mt-2 space-y-4 rounded-xl border bg-white p-5">
          <label className="block text-sm">
            {t("vat.shop_name")} *
            <input
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            {t("common.phone")}
            <input
              value={form.phone ?? ""}
              onChange={(e) => patch({ phone: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            {t("common.address")}
            <input
              value={form.address ?? ""}
              onChange={(e) => patch({ address: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>

          <div className="space-y-4 rounded-lg border border-teal-100 bg-teal-50/50 p-4">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.vatRegistered ?? false}
                onChange={(e) => patch({ vatRegistered: e.target.checked })}
                className="h-4 w-4 rounded border-teal-600"
              />
              {t("vat.registered")}
            </label>
            <p className="text-xs text-slate-600">{t("vat.registered_hint")}</p>

            <label className="block text-sm">
              {t("vat.vat_number")}
              <input
                value={form.vatNumber ?? ""}
                onChange={(e) => patch({ vatNumber: e.target.value })}
                placeholder="VAT-XXXXXXX"
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              {t("vat.quarter_start")}
              <select
                value={form.quarterStartMonth ?? 4}
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

          <button
            type="button"
            onClick={onSave}
            disabled={!loaded}
            className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("common.save")}
          </button>
        </div>

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
