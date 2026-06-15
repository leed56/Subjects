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
  fetchOrgShopSettings,
  getOrCreateOrgForUser,
  mergeBusinessSettings,
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

const SHOP_SETTINGS_KEY = "lakbiz-shop-settings-v1";

type Status = { kind: "ok" | "warn"; text: string };

function readForm(form: HTMLFormElement): BusinessInfo {
  const fd = new FormData(form);
  const vatRegistered = fd.get("vatRegistered") === "on";
  return {
    name: String(fd.get("name") ?? "").trim() || "My Shop",
    phone: String(fd.get("phone") ?? "").trim() || undefined,
    address: String(fd.get("address") ?? "").trim() || undefined,
    vatRegistered,
    vatNumber: String(fd.get("vatNumber") ?? "").trim() || undefined,
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

function verifyLocalSave(expected: BusinessInfo): boolean {
  try {
    const raw = localStorage.getItem(SHOP_SETTINGS_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as BusinessInfo;
    return saved.name === expected.name;
  } catch {
    return false;
  }
}

export default function ShopSettingsPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  const { updateBusiness } = useAppStore();
  const { org } = useSubscription();
  const { user } = useAuth();
  const { t } = useLocale();

  // Fill from localStorage on mount
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    fillForm(form, loadShopSettings());
  }, []);

  // Once org.id is known, pull from Supabase and merge
  useEffect(() => {
    if (!org.id || !isSupabaseConfigured()) return;
    const form = formRef.current;
    if (!form) return;
    void fetchOrgShopSettings(org.id).then((cloud) => {
      if (!cloud || !formRef.current) return;
      const local = loadShopSettings();
      const merged = mergeBusinessSettings(local, cloud);
      fillForm(formRef.current, merged);
      saveShopSettings(merged);
    });
  }, [org.id]);

  async function handleSave() {
    const form = formRef.current;
    if (!form || isSaving) return;

    setIsSaving(true);
    try {
      const payload = readForm(form);

      saveShopSettings(payload);
      updateBusiness(payload);

      if (!verifyLocalSave(payload)) {
        setStatus({
          kind: "warn",
          text: "Save failed — browser blocked storage. Check privacy settings.",
        });
        return;
      }

      setStatus({
        kind: "ok",
        text: `${t("vat.settings_saved_local")}: "${payload.name}"`,
      });

      if (!user || !isSupabaseConfigured()) return;

      let targetOrgId = org.id;
      if (!targetOrgId) {
        const { orgId } = await getOrCreateOrgForUser(user.id, payload);
        targetOrgId = orgId;
      }
      if (!targetOrgId) return;

      const cloudError = await saveOrgShopSettings(targetOrgId, payload);
      setStatus(
        cloudError
          ? {
              kind: "warn",
              text: `${t("vat.settings_saved_local")} — ${t("vat.cloud_sync_note")}`,
            }
          : {
              kind: "ok",
              text: t("vat.settings_saved_cloud"),
            },
      );
    } catch (err) {
      setStatus({
        kind: "warn",
        text: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader sticky={false} />
      <main className="relative z-10 mx-auto max-w-lg scroll-mt-4 px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">{t("vat.shop_settings")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("vat.shop_settings_hint")}</p>

        <div className="mt-4 min-h-[3.5rem]">
          {status ? (
            <p
              role="status"
              aria-live="polite"
              className={`rounded-lg px-4 py-3 text-sm ${
                status.kind === "ok"
                  ? "bg-teal-50 text-teal-800"
                  : "bg-amber-50 text-amber-900"
              }`}
            >
              {status.text}
            </p>
          ) : (
            <span className="block text-sm text-transparent select-none" aria-hidden>
              .
            </span>
          )}
        </div>

        <form
          ref={formRef}
          className="mt-2 space-y-4 rounded-xl border bg-white p-5 shadow-sm"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <label className="block text-sm">
            {t("vat.shop_name")} *
            <input
              name="name"
              required
              autoComplete="organization"
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            {t("common.phone")}
            <input
              name="phone"
              autoComplete="tel"
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            {t("common.address")}
            <input
              name="address"
              autoComplete="street-address"
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
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
            disabled={isSaving}
            className="w-full rounded-lg bg-teal-700 py-3 text-base font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {isSaving ? t("common.loading") : t("common.save")}
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
