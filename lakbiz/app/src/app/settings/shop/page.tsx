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
import { useAppStore } from "@/lib/store/use-app-store";
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

const SAVE_STATUS_KEY = "lakbiz-shop-save-status";

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

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    fillForm(form, loadShopSettings());

    try {
      const raw = sessionStorage.getItem(SAVE_STATUS_KEY);
      if (raw) {
        setStatus(JSON.parse(raw) as { kind: "ok" | "warn"; text: string });
        sessionStorage.removeItem(SAVE_STATUS_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const onSubmit = (event: Event) => {
      event.preventDefault();
      if (savingRef.current) return;
      savingRef.current = true;
      setStatus(null);

      const payload = readForm(form);

      try {
        saveShopSettings(payload);
        updateBusiness(payload);
      } catch (err) {
        savingRef.current = false;
        setStatus({
          kind: "warn",
          text: err instanceof Error ? err.message : "Save failed",
        });
        return;
      }

      const localMsg = `${t("vat.settings_saved_local")}: "${payload.name}"`;
      const statusMsg: { kind: "ok" | "warn"; text: string } = {
        kind: "ok",
        text: localMsg,
      };

      setStatus(statusMsg);
      try {
        sessionStorage.setItem(SAVE_STATUS_KEY, JSON.stringify(statusMsg));
      } catch {
        /* ignore */
      }

      savingRef.current = false;

      if (!user || !isSupabaseConfigured()) return;

      void (async () => {
        let targetOrgId = org.id;
        if (!targetOrgId) {
          const { orgId } = await getOrCreateOrgForUser(user.id, payload);
          targetOrgId = orgId;
        }
        if (!targetOrgId) return;

        const cloudError = await saveOrgShopSettings(targetOrgId, payload);
        const cloudMsg = cloudError
          ? {
              kind: "warn" as const,
              text: `${t("vat.settings_saved_local")} — ${t("vat.cloud_sync_note")}`,
            }
          : {
              kind: "ok" as const,
              text: t("vat.settings_saved_cloud"),
            };

        setStatus(cloudMsg);
        try {
          sessionStorage.setItem(SAVE_STATUS_KEY, JSON.stringify(cloudMsg));
        } catch {
          /* ignore */
        }
      })();
    };

    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [user, org.id, t, updateBusiness]);

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
          noValidate
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

          <div className="space-y-4 rounded-lg border border-teal-100 bg-teal-50/50 p-4">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                name="vatRegistered"
                type="checkbox"
                className="h-4 w-4 rounded border-teal-600"
              />
              {t("vat.registered")}
            </label>
            <label className="block text-sm">
              {t("vat.vat_number")}
              <input
                name="vatNumber"
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
            type="submit"
            className="w-full rounded-lg bg-teal-700 py-3 text-base font-semibold text-white hover:bg-teal-800"
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
        </p>
      </main>
    </div>
  );
}
