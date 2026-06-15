"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/lib/i18n/locale-provider";
import { defaultBusiness, type BusinessInfo } from "@/lib/invoice";
import {
  loadShopSettings,
  saveShopSettings,
} from "@/lib/store/shop-settings";

const QUARTER_MONTHS = [
  { value: 1, key: "vat.month_jan" },
  { value: 4, key: "vat.month_apr" },
  { value: 7, key: "vat.month_jul" },
  { value: 10, key: "vat.month_oct" },
] as const;

export default function ShopSettingsPage() {
  const { t } = useLocale();
  const initDone = useRef(false);
  const [form, setForm] = useState<BusinessInfo | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    setForm(loadShopSettings());
  }, []);

  function patch(partial: Partial<BusinessInfo>) {
    setStatus(null);
    setForm((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  function handleSave() {
    if (!form) return;

    const payload: BusinessInfo = {
      ...form,
      name: form.name.trim() || "My Shop",
      vatRegistered: form.vatRegistered ?? false,
      quarterStartMonth: form.quarterStartMonth ?? 4,
    };

    try {
      saveShopSettings(payload);
      setStatus(`${t("vat.settings_saved_local")}: "${payload.name}"`);
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Save failed",
      );
    }
  }

  if (!form) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-lg px-4 py-10 text-slate-600">
          {t("common.loading")}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">{t("vat.shop_settings")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("vat.shop_settings_hint")}</p>

        <div className="mt-4 min-h-[3rem]">
          {status && (
            <p className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">
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
            <label className="block text-sm">
              {t("vat.vat_number")}
              <input
                value={form.vatNumber ?? ""}
                onChange={(e) => patch({ vatNumber: e.target.value })}
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
            onClick={handleSave}
            className="w-full rounded-lg bg-teal-700 py-3 text-base font-semibold text-white hover:bg-teal-800"
          >
            {t("common.save")}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/dashboard" className="text-teal-700 underline">
            {t("nav.dashboard")}
          </Link>
        </p>
      </main>
    </div>
  );
}
