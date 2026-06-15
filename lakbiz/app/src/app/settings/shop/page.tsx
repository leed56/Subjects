"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import type { BusinessInfo } from "@/lib/invoice";
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

export default function ShopSettingsPage() {
  const { ready, updateBusiness } = useAppStore();
  const { org, refreshOrg } = useSubscription();
  const { user } = useAuth();
  const { t } = useLocale();
  const [form, setForm] = useState<BusinessInfo | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMode, setSaveMode] = useState<"local" | "cloud" | null>(null);
  const [cloudOrgId, setCloudOrgId] = useState<string | null>(null);
  const initialized = useRef(false);

  // Load once from localStorage — never re-fetch cloud into the form (that caused resets)
  useEffect(() => {
    if (!ready || initialized.current) return;
    initialized.current = true;
    setForm({ ...loadAppData().business });
  }, [ready]);

  useEffect(() => {
    if (org.id) setCloudOrgId(org.id);
  }, [org.id]);

  if (!ready || !form) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-lg px-4 py-10">{t("common.loading")}</main>
      </div>
    );
  }

  const activeOrgId = org.id ?? cloudOrgId;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    setSaveMode(null);

    const payload: BusinessInfo = {
      ...form,
      vatRegistered: form.vatRegistered ?? false,
      quarterStartMonth: form.quarterStartMonth ?? 4,
    };

    // Write localStorage synchronously first (guaranteed persist)
    const nextApp = mergeBusinessIntoApp(loadAppData(), payload);
    saveAppData(nextApp);
    updateBusiness(payload);
    setForm(payload);

    let targetOrgId = activeOrgId;

    if (user && isSupabaseConfigured()) {
      if (!targetOrgId) {
        const { orgId, error: createError } = await getOrCreateOrgForUser(
          user.id,
          payload,
        );
        if (createError) {
          setError(t("vat.cloud_sync_note"));
          setSaveMode("local");
          setSaved(true);
          setSaving(false);
          return;
        }
        if (orgId) {
          targetOrgId = orgId;
          setCloudOrgId(orgId);
          void refreshOrg();
        }
      }

      if (targetOrgId) {
        const cloudError = await saveOrgShopSettings(targetOrgId, payload);
        if (cloudError) {
          setError(t("vat.cloud_sync_note"));
          setSaveMode("local");
        } else {
          setSaveMode("cloud");
        }
        setSaved(true);
      } else {
        setSaveMode("local");
        setSaved(true);
      }
    } else {
      setSaveMode("local");
      setSaved(true);
      if (!isSupabaseConfigured()) {
        setError(t("vat.no_supabase_env"));
      } else if (!user) {
        setError(t("vat.sign_in_for_cloud"));
      }
    }

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
              value={form.name}
              onChange={(e) => {
                setSaved(false);
                setForm({ ...form, name: e.target.value });
              }}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            {t("common.phone")}
            <input
              value={form.phone ?? ""}
              onChange={(e) => {
                setSaved(false);
                setForm({ ...form, phone: e.target.value });
              }}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            {t("common.address")}
            <input
              value={form.address ?? ""}
              onChange={(e) => {
                setSaved(false);
                setForm({ ...form, address: e.target.value });
              }}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>

          <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-4">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.vatRegistered ?? false}
                onChange={(e) => {
                  setSaved(false);
                  setForm({ ...form, vatRegistered: e.target.checked });
                }}
                className="h-4 w-4 rounded border-teal-600"
              />
              {t("vat.registered")}
            </label>
            <p className="mt-2 text-xs text-slate-600">{t("vat.registered_hint")}</p>

            {form.vatRegistered && (
              <div className="mt-4 space-y-3">
                <label className="block text-sm">
                  {t("vat.vat_number")}
                  <input
                    value={form.vatNumber ?? ""}
                    onChange={(e) => {
                      setSaved(false);
                      setForm({ ...form, vatNumber: e.target.value });
                    }}
                    placeholder="VAT-XXXXXXX"
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  {t("vat.quarter_start")}
                  <select
                    value={form.quarterStartMonth ?? 4}
                    onChange={(e) => {
                      setSaved(false);
                      setForm({
                        ...form,
                        quarterStartMonth: Number(e.target.value),
                      });
                    }}
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
          {user && activeOrgId
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
