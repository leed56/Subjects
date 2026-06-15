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

function readBusiness(): BusinessInfo {
  return { ...loadAppData().business };
}

function readForm(form: HTMLFormElement): BusinessInfo {
  const fd = new FormData(form);
  const vatRegistered = fd.get("vatRegistered") === "on";
  return {
    name: String(fd.get("name") ?? "").trim() || "My Shop",
    phone: String(fd.get("phone") ?? "").trim() || undefined,
    address: String(fd.get("address") ?? "").trim() || undefined,
    vatRegistered,
    vatNumber: vatRegistered
      ? String(fd.get("vatNumber") ?? "").trim() || undefined
      : undefined,
    quarterStartMonth: Number(fd.get("quarterStartMonth") ?? 4) || 4,
  };
}

function fillForm(form: HTMLFormElement, business: BusinessInfo) {
  const set = (name: string, value: string) => {
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
      el.value = value;
    }
  };
  set("name", business.name);
  set("phone", business.phone ?? "");
  set("address", business.address ?? "");
  const vat = form.elements.namedItem("vatRegistered");
  if (vat instanceof HTMLInputElement) {
    vat.checked = business.vatRegistered ?? false;
  }
  set("vatNumber", business.vatNumber ?? "");
  set("quarterStartMonth", String(business.quarterStartMonth ?? 4));
}

export default function ShopSettingsPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const savingRef = useRef(false);
  const { updateBusiness } = useAppStore();
  const { org } = useSubscription();
  const { user } = useAuth();
  const { t } = useLocale();
  const [status, setStatus] = useState<{
    kind: "ok" | "warn";
    text: string;
  } | null>(null);

  // Fill form once from localStorage — inputs stay uncontrolled (DOM owns values)
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    fillForm(form, readBusiness());
  }, []);

  const handleSave = async () => {
    const form = formRef.current;
    if (!form || savingRef.current) return;

    savingRef.current = true;
    setStatus(null);

    const payload = readForm(form);

    // Sync persist — no React state touching form fields
    saveAppData(mergeBusinessIntoApp(loadAppData(), payload));

    let cloudOk = false;
    let statusMsg: { kind: "ok" | "warn"; text: string } | null = null;

    if (user && isSupabaseConfigured()) {
      let targetOrgId = org.id;
      if (!targetOrgId) {
        const { orgId } = await getOrCreateOrgForUser(user.id, payload);
        targetOrgId = orgId;
      }
      if (targetOrgId) {
        const cloudError = await saveOrgShopSettings(targetOrgId, payload);
        cloudOk = !cloudError;
        if (cloudError) {
          statusMsg = {
            kind: "warn",
            text: `${t("vat.settings_saved_local")} — ${t("vat.cloud_sync_note")}`,
          };
        }
      }
    }

    if (!statusMsg) {
      statusMsg = {
        kind: cloudOk ? "ok" : "warn",
        text: cloudOk
          ? t("vat.settings_saved_cloud")
          : user
            ? t("vat.settings_saved_local")
            : `${t("vat.settings_saved_local")} — ${t("vat.sign_in_for_cloud")}`,
      };
    }

    setStatus(statusMsg);
    queueMicrotask(() => updateBusiness(payload));
    savingRef.current = false;
  };

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">{t("vat.shop_settings")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("vat.shop_settings_hint")}</p>

        {/* Fixed-height status slot — no layout jump */}
        <div className="mt-4 min-h-[3rem]">
          {status && (
            <p
              className={`rounded-lg px-4 py-3 text-sm ${
                status.kind === "ok"
                  ? "bg-teal-50 text-teal-800"
                  : "bg-amber-50 text-amber-900"
              }`}
            >
              {status.text}
            </p>
          )}
        </div>

        <form
          ref={formRef}
          className="mt-2 space-y-4 rounded-xl border bg-white p-5"
          onSubmit={(e) => e.preventDefault()}
        >
          <label className="block text-sm">
            {t("vat.shop_name")} *
            <input
              name="name"
              required
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            {t("common.phone")}
            <input name="phone" className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block text-sm">
            {t("common.address")}
            <input name="address" className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>

          <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-4 space-y-4">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                name="vatRegistered"
                type="checkbox"
                className="h-4 w-4 rounded border-teal-600"
              />
              {t("vat.registered")}
            </label>
            <p className="text-xs text-slate-600">{t("vat.registered_hint")}</p>

            <label className="block text-sm">
              {t("vat.vat_number")}
              <input
                name="vatNumber"
                placeholder="VAT-XXXXXXX"
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              {t("vat.quarter_start")}
              <select
                name="quarterStartMonth"
                defaultValue="4"
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
            onClick={() => void handleSave()}
            className="w-full rounded-lg bg-teal-700 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
          >
            {t("common.save")}
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
