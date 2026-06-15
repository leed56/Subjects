"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { BusinessInfo } from "@/lib/invoice";
import { useAppStore } from "@/lib/store/use-app-store";

const QUARTER_MONTHS = [
  { value: 1, key: "vat.month_jan" },
  { value: 4, key: "vat.month_apr" },
  { value: 7, key: "vat.month_jul" },
  { value: 10, key: "vat.month_oct" },
] as const;

export default function ShopSettingsPage() {
  const { data, ready, updateBusiness } = useAppStore();
  const { t } = useLocale();
  const [form, setForm] = useState<BusinessInfo | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.business) setForm({ ...data.business });
  }, [data?.business]);

  if (!ready || !data || !form) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-lg px-4 py-10">{t("common.loading")}</main>
      </div>
    );
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateBusiness(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">{t("vat.shop_settings")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("vat.shop_settings_hint")}</p>

        {saved && (
          <p className="mt-4 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {t("vat.settings_saved")}
          </p>
        )}

        <form onSubmit={handleSave} className="mt-6 space-y-4 rounded-xl border bg-white p-5">
          <label className="block text-sm">
            {t("vat.shop_name")} *
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            {t("common.phone")}
            <input
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            {t("common.address")}
            <input
              value={form.address ?? ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>

          <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-4">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.vatRegistered ?? false}
                onChange={(e) =>
                  setForm({ ...form, vatRegistered: e.target.checked })
                }
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
                    value={form.vatNumber ?? form.tin ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, vatNumber: e.target.value })
                    }
                    placeholder="VAT-XXXXXXX"
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  {t("vat.quarter_start")}
                  <select
                    value={form.quarterStartMonth ?? 4}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        quarterStartMonth: Number(e.target.value),
                      })
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
            className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
          >
            {t("common.save")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/vat" className="text-teal-700 underline">
            {t("vat.view_return")}
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
