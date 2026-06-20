"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useAuth } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import type { BusinessInfo } from "@/lib/invoice";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchOrgShopSettings,
  getOrCreateOrgForUser,
  saveOrgShopSettings,
} from "@/lib/supabase/org-settings";

const SHOP_KEY = "lakbiz-shop-settings-v1";
const APP_KEY = "lakbiz-app-data-v2";

type Msg = { ok: boolean; text: string };
type BtnState = "idle" | "saving" | "saved";

function readStorage(): Partial<BusinessInfo> | null {
  try {
    const a = localStorage.getItem(SHOP_KEY);
    if (a) return JSON.parse(a) as Partial<BusinessInfo>;
    const b = localStorage.getItem(APP_KEY);
    if (b) {
      return (
        (JSON.parse(b) as { business?: Partial<BusinessInfo> }).business ??
        null
      );
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeStorage(data: BusinessInfo): void {
  localStorage.setItem(SHOP_KEY, JSON.stringify(data));
  try {
    const raw = localStorage.getItem(APP_KEY);
    const app = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    app.business = { ...((app.business as object) ?? {}), ...data };
    localStorage.setItem(APP_KEY, JSON.stringify(app));
  } catch {
    /* ignore */
  }
}

function readForm(form: HTMLFormElement, logoDataUrl?: string): BusinessInfo {
  const fd = new FormData(form);
  return {
    name: String(fd.get("name") ?? "").trim() || "My Shop",
    nameSi: String(fd.get("nameSi") ?? "").trim() || undefined,
    phone: String(fd.get("phone") ?? "").trim() || undefined,
    email: String(fd.get("email") ?? "").trim() || undefined,
    address: String(fd.get("address") ?? "").trim() || undefined,
    tin: String(fd.get("tin") ?? "").trim() || undefined,
    brNumber: String(fd.get("brNumber") ?? "").trim() || undefined,
    invoiceFooter: String(fd.get("invoiceFooter") ?? "").trim() || undefined,
    logoDataUrl: logoDataUrl || undefined,
    vatRegistered: fd.get("vatRegistered") === "on",
    vatNumber: String(fd.get("vatNumber") ?? "").trim() || undefined,
    quarterStartMonth: Number(fd.get("quarterStartMonth")) || 4,
  };
}

function fillForm(form: HTMLFormElement, s: Partial<BusinessInfo>) {
  const set = (name: string, value: string) => {
    const el = form.elements.namedItem(name);
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement
    ) {
      el.value = value;
    }
  };
  set("name", s.name ?? "");
  set("nameSi", s.nameSi ?? "");
  set("phone", s.phone ?? "");
  set("email", s.email ?? "");
  set("address", s.address ?? "");
  set("tin", s.tin ?? "");
  set("brNumber", s.brNumber ?? "");
  set("invoiceFooter", s.invoiceFooter ?? "");
  set("vatNumber", s.vatNumber ?? "");
  set("quarterStartMonth", String(s.quarterStartMonth ?? 4));
  const cb = form.elements.namedItem("vatRegistered");
  if (cb instanceof HTMLInputElement) cb.checked = s.vatRegistered ?? false;
}

/** Downscale an uploaded image to a small square-ish data URL (<= ~256px). */
async function fileToLogoDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const max = 256;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function msgClasses(ok: boolean): string {
  return ok
    ? "border border-teal-200 bg-teal-50 text-teal-900"
    : "border border-amber-200 bg-amber-50 text-amber-900";
}

export default function ShopSettingsPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const resetBtnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [btnState, setBtnState] = useState<BtnState>("idle");
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined);

  const { user } = useAuth();
  const { org } = useSubscription();
  const { t } = useLocale();

  const orgIdRef = useRef(org.id);
  const userRef = useRef(user);
  orgIdRef.current = org.id;
  userRef.current = user;

  const showMsg = (next: Msg, button: BtnState) => {
    flushSync(() => {
      setMsg(next);
      setBtnState(button);
    });
    statusRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const resetButtonLater = () => {
    if (resetBtnTimerRef.current) clearTimeout(resetBtnTimerRef.current);
    resetBtnTimerRef.current = setTimeout(() => {
      flushSync(() => setBtnState("idle"));
    }, 2500);
  };

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const saved = readStorage();
    if (saved) {
      fillForm(form, saved);
      if (saved.logoDataUrl) setLogoDataUrl(saved.logoDataUrl);
    }
  }, []);

  useEffect(() => {
    if (!org.id || !isSupabaseConfigured()) return;
    void fetchOrgShopSettings(org.id).then((cloud) => {
      const form = formRef.current;
      if (!cloud || !form) return;
      const local = readStorage();
      if (local?.name && local.name !== "My Shop") return;
      fillForm(form, cloud);
      if (cloud.logoDataUrl) setLogoDataUrl(cloud.logoDataUrl);
    });
  }, [org.id]);

  useEffect(() => {
    return () => {
      if (resetBtnTimerRef.current) clearTimeout(resetBtnTimerRef.current);
    };
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = readForm(form, logoDataUrl);

    showMsg({ ok: true, text: t("vat.saving") }, "saving");

    try {
      writeStorage(payload);
    } catch {
      showMsg(
        { ok: false, text: "Save failed — browser storage blocked." },
        "idle",
      );
      return;
    }

    try {
      const check = localStorage.getItem(SHOP_KEY);
      if (!check || (JSON.parse(check) as BusinessInfo).name !== payload.name) {
        showMsg(
          { ok: false, text: "Save failed — storage write did not persist." },
          "idle",
        );
        return;
      }
    } catch {
      showMsg({ ok: false, text: "Save failed." }, "idle");
      return;
    }

    showMsg(
      {
        ok: true,
        text: `${t("vat.saved_success")} — ${payload.name}`,
      },
      "saved",
    );
    resetButtonLater();

    const currentUser = userRef.current;
    if (!currentUser || !isSupabaseConfigured()) return;

    void (async () => {
      try {
        let orgId = orgIdRef.current;
        if (!orgId) {
          const { orgId: newId } = await getOrCreateOrgForUser(
            currentUser.id,
            payload,
          );
          orgId = newId;
          orgIdRef.current = orgId;
        }
        if (!orgId) return;
        const err = await saveOrgShopSettings(orgId, payload);
        showMsg(
          err
            ? {
                ok: false,
                text: `${t("vat.saved_success")} — ${t("vat.cloud_sync_note")}`,
              }
            : {
                ok: true,
                text: `${t("vat.saved_success")} — ${t("vat.settings_saved_cloud")}`,
              },
          "saved",
        );
        resetButtonLater();
      } catch {
        /* local save already succeeded */
      }
    })();
  }

  const saveLabel =
    btnState === "saving"
      ? t("vat.saving")
      : btnState === "saved"
        ? t("vat.saved_success")
        : t("common.save");

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader sticky={false} />
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">{t("vat.shop_settings")}</h1>
        <p className="mt-1 text-sm text-slate-600">{t("vat.shop_settings_hint")}</p>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="mt-6 space-y-4 rounded-xl border bg-white p-5 shadow-sm"
          noValidate
        >
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
              {logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoDataUrl}
                  alt="Logo"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-[10px] text-slate-400">
                  {t("shop.no_logo")}
                </span>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700">
                {t("shop.logo")}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await fileToLogoDataUrl(file);
                    setLogoDataUrl(url);
                  }}
                  className="mt-1 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-teal-700"
                />
              </label>
              {logoDataUrl && (
                <button
                  type="button"
                  onClick={() => setLogoDataUrl(undefined)}
                  className="mt-2 text-xs text-red-600 hover:underline"
                >
                  {t("shop.remove_logo")}
                </button>
              )}
            </div>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            {t("vat.shop_name")} *
            <input
              name="name"
              required
              autoComplete="organization"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            {t("shop.name_si")}
            <input
              name="nameSi"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              {t("common.phone")}
              <input
                name="phone"
                autoComplete="tel"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              {t("shop.email")}
              <input
                name="email"
                type="email"
                autoComplete="email"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            {t("common.address")}
            <input
              name="address"
              autoComplete="street-address"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              {t("shop.br_number")}
              <input
                name="brNumber"
                placeholder={t("shop.br_placeholder")}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              {t("shop.tin")}
              <input
                name="tin"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            {t("shop.invoice_footer")}
            <textarea
              name="invoiceFooter"
              rows={2}
              placeholder={t("shop.invoice_footer_placeholder")}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </label>

          <div className="space-y-3 rounded-lg border border-teal-100 bg-teal-50/40 p-4">
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                name="vatRegistered"
                type="checkbox"
                className="h-4 w-4 accent-teal-600"
              />
              {t("vat.registered")}
            </label>

            <label className="block text-sm font-medium text-slate-700">
              {t("vat.vat_number")}
              <input
                name="vatNumber"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              {t("vat.quarter_start")}
              <select
                name="quarterStartMonth"
                defaultValue="4"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
              >
                <option value="1">{t("vat.month_jan")}</option>
                <option value="4">{t("vat.month_apr")}</option>
                <option value="7">{t("vat.month_jul")}</option>
                <option value="10">{t("vat.month_oct")}</option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={btnState === "saving"}
            className={`w-full rounded-lg py-3 text-base font-semibold text-white transition-colors ${
              btnState === "saved"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : btnState === "saving"
                  ? "cursor-wait bg-teal-600"
                  : "bg-teal-700 hover:bg-teal-800 active:bg-teal-900"
            }`}
          >
            {saveLabel}
          </button>

          <div
            ref={statusRef}
            role="status"
            aria-live="polite"
            className={`min-h-[3.25rem] rounded-lg px-4 py-3 text-sm font-medium ${
              msg
                ? msgClasses(msg.ok)
                : "border border-dashed border-slate-200 bg-slate-50 text-slate-400"
            }`}
          >
            {msg?.text ?? t("vat.save_status_hint")}
          </div>
        </form>

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
