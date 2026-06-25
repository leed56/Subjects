"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useAuth } from "@/components/auth-provider";
import { SiteHeader } from "@/components/site-header";
import {
  ProBadge,
  ProButton,
  ProCard,
  ProMain,
  ProPageHeader,
  ProPageShell,
} from "@/components/ui/pro-shell";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import type { BusinessInfo } from "@/lib/invoice";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchOrgShopSettings,
  getOrCreateOrgForUser,
} from "@/lib/supabase/org-settings";
import { useAppStore } from "@/lib/store/use-app-store";

const SHOP_KEY = "lakbiz-shop-settings-v1";
const APP_KEY = "lakbiz-app-data-v2";

type Msg = { ok: boolean; text: string };
type BtnState = "idle" | "saving" | "saved";

function readStorage(): Partial<BusinessInfo> | null {
  try {
    const a = localStorage.getItem(SHOP_KEY);
    if (a) return JSON.parse(a) as Partial<BusinessInfo>;
    const b = localStorage.getItem(APP_KEY);
    if (b) return ((JSON.parse(b) as { business?: Partial<BusinessInfo> }).business ?? null);
  } catch {}
  return null;
}

function writeStorage(data: BusinessInfo): void {
  localStorage.setItem(SHOP_KEY, JSON.stringify(data));
  try {
    const raw = localStorage.getItem(APP_KEY);
    const app = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    app.business = { ...((app.business as object) ?? {}), ...data };
    localStorage.setItem(APP_KEY, JSON.stringify(app));
  } catch {}
}

function readForm(form: HTMLFormElement, logoDataUrl?: string): BusinessInfo {
  const fd = new FormData(form);
  const preset = String(fd.get("companyIncomeTaxRatePreset") ?? "30");
  const customRaw = Number(fd.get("companyIncomeTaxRateCustom"));
  const companyIncomeTaxRate =
    preset === "custom"
      ? customRaw
      : Number(preset);

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
    companyIncomeTaxRate,
  };
}

function incomeTaxPresetValue(rate: number | undefined): string {
  const normalized = rate ?? 30;
  if (normalized === 30 || normalized === 15 || normalized === 45) {
    return String(normalized);
  }
  return "custom";
}

function fillForm(form: HTMLFormElement, s: Partial<BusinessInfo>) {
  const set = (name: string, value: string) => {
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) el.value = value;
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
  set("companyIncomeTaxRatePreset", incomeTaxPresetValue(s.companyIncomeTaxRate));
  set(
    "companyIncomeTaxRateCustom",
    incomeTaxPresetValue(s.companyIncomeTaxRate) === "custom"
      ? String(s.companyIncomeTaxRate ?? 30)
      : "",
  );
  const cb = form.elements.namedItem("vatRegistered");
  if (cb instanceof HTMLInputElement) cb.checked = s.vatRegistered ?? false;
}

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
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function fieldClass() {
  return "mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-teal-300 focus:ring-4 focus:ring-teal-100";
}

function labelClass() {
  return "block text-sm font-black text-slate-700";
}

export default function ShopSettingsPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const resetBtnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [btnState, setBtnState] = useState<BtnState>("idle");
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined);
  const [incomeTaxPreset, setIncomeTaxPreset] = useState("30");

  const { user } = useAuth();
  const { org } = useSubscription();
  const { updateBusinessToCloud } = useAppStore();
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
    resetBtnTimerRef.current = setTimeout(() => flushSync(() => setBtnState("idle")), 2500);
  };

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const saved = readStorage();
    if (saved) {
      fillForm(form, saved);
      if (saved.logoDataUrl) setLogoDataUrl(saved.logoDataUrl);
      setIncomeTaxPreset(incomeTaxPresetValue(saved.companyIncomeTaxRate));
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
      setIncomeTaxPreset(incomeTaxPresetValue(cloud.companyIncomeTaxRate));
    });
  }, [org.id]);

  useEffect(() => () => {
    if (resetBtnTimerRef.current) clearTimeout(resetBtnTimerRef.current);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = readForm(e.currentTarget, logoDataUrl);
    showMsg({ ok: true, text: t("vat.saving") }, "saving");

    try {
      writeStorage(payload);
    } catch {
      showMsg({ ok: false, text: "Save failed — browser storage blocked." }, "idle");
      return;
    }

    const currentUser = userRef.current;
    if (currentUser && isSupabaseConfigured()) {
      try {
        let orgId = orgIdRef.current;
        if (!orgId) {
          const { orgId: newId } = await getOrCreateOrgForUser(currentUser.id, payload);
          orgId = newId;
          orgIdRef.current = orgId;
        }
      } catch {
        showMsg({ ok: false, text: t("common.save_failed") }, "idle");
        return;
      }
    }

    const result = await updateBusinessToCloud(payload);
    if (!result.ok) {
      showMsg(
        {
          ok: false,
          text: result.error ?? `${t("vat.saved_success")} — ${t("vat.cloud_sync_note")}`,
        },
        "idle",
      );
      return;
    }

    showMsg(
      {
        ok: true,
        text: isSupabaseConfigured() && userRef.current
          ? `${t("vat.saved_success")} — ${t("vat.settings_saved_cloud")}`
          : `${t("vat.saved_success")} — ${payload.name}`,
      },
      "saved",
    );
    resetButtonLater();
  }

  const saveLabel = btnState === "saving" ? t("vat.saving") : btnState === "saved" ? t("vat.saved_success") : t("common.save");
  const cloudReady = isSupabaseConfigured();

  return (
    <ProPageShell>
      <SiteHeader sticky={false} />
      <ProMain>
        <ProPageHeader
          eyebrow="Business identity"
          title={t("vat.shop_settings")}
          description={t("vat.shop_settings_hint")}
          actions={
            <>
              <ProButton href="/vat" variant="secondary">{t("vat.view_return")}</ProButton>
              <ProButton href="/dashboard" variant="secondary">{t("nav.dashboard")}</ProButton>
            </>
          }
        />

        <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <ProCard title="Invoice profile" eyebrow="Preview" action={<ProBadge tone={cloudReady ? "emerald" : "amber"}>{cloudReady ? "Cloud sync" : "Browser"}</ProBadge>}>
            <div className="flex items-center gap-4">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-slate-50">
                {logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoDataUrl} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-center text-[10px] font-bold text-slate-400">{t("shop.no_logo")}</span>
                )}
              </div>
              <div>
                <p className="text-sm font-black text-slate-950">{t("vat.shop_name")}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{t("shop.invoice_footer_placeholder")}</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm font-semibold leading-6 text-teal-900">
              {cloudReady ? t("vat.settings_saved_cloud") : t("vat.cloud_sync_note")}
            </div>
          </ProCard>

          <ProCard title={t("vat.shop_settings")} eyebrow="Details and VAT">
            <form ref={formRef} onSubmit={handleSubmit} noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={`${labelClass()} sm:col-span-2`}>
                  {t("shop.logo")}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setLogoDataUrl(await fileToLogoDataUrl(file));
                    }}
                    className="mt-2 block w-full text-xs font-semibold text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-black file:text-teal-700"
                  />
                  {logoDataUrl && (
                    <button type="button" onClick={() => setLogoDataUrl(undefined)} className="mt-2 text-xs font-black text-rose-600 hover:underline">
                      {t("shop.remove_logo")}
                    </button>
                  )}
                </label>

                <label className={`${labelClass()} sm:col-span-2`}>{t("vat.shop_name")} *<input name="name" required autoComplete="organization" className={fieldClass()} /></label>
                <label className={labelClass()}>{t("shop.name_si")}<input name="nameSi" className={fieldClass()} /></label>
                <label className={labelClass()}>{t("common.phone")}<input name="phone" autoComplete="tel" className={fieldClass()} /></label>
                <label className={labelClass()}>{t("shop.email")}<input name="email" type="email" autoComplete="email" className={fieldClass()} /></label>
                <label className={labelClass()}>{t("common.address")}<input name="address" autoComplete="street-address" className={fieldClass()} /></label>
                <label className={labelClass()}>{t("shop.br_number")}<input name="brNumber" placeholder={t("shop.br_placeholder")} className={fieldClass()} /></label>
                <label className={labelClass()}>{t("shop.tin")}<input name="tin" className={fieldClass()} /></label>
                <label className={`${labelClass()} sm:col-span-2`}>{t("shop.invoice_footer")}<textarea name="invoiceFooter" rows={3} placeholder={t("shop.invoice_footer_placeholder")} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-teal-300 focus:ring-4 focus:ring-teal-100" /></label>
              </div>

              <div className="mt-5 rounded-[1.25rem] border border-teal-100 bg-teal-50/60 p-4">
                <label className="flex items-center gap-3 text-sm font-black text-slate-700">
                  <input name="vatRegistered" type="checkbox" className="h-4 w-4 accent-teal-600" />
                  {t("vat.registered")}
                </label>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className={labelClass()}>{t("vat.vat_number")}<input name="vatNumber" className={fieldClass()} /></label>
                  <label className={labelClass()}>
                    {t("vat.quarter_start")}
                    <select name="quarterStartMonth" defaultValue="4" className={fieldClass()}>
                      <option value="1">{t("vat.month_jan")}</option>
                      <option value="4">{t("vat.month_apr")}</option>
                      <option value="7">{t("vat.month_jul")}</option>
                      <option value="10">{t("vat.month_oct")}</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-5 rounded-[1.25rem] border border-indigo-100 bg-indigo-50/60 p-4">
                <p className="text-sm font-black text-slate-800">{t("tax.rate_setting")}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{t("tax.rate_setting_hint")}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className={labelClass()}>
                    {t("tax.income_rate")}
                    <select
                      name="companyIncomeTaxRatePreset"
                      value={incomeTaxPreset}
                      onChange={(e) => setIncomeTaxPreset(e.target.value)}
                      className={fieldClass()}
                    >
                      <option value="30">{t("tax.rate_standard")}</option>
                      <option value="15">{t("tax.rate_export")}</option>
                      <option value="45">{t("tax.rate_special")}</option>
                      <option value="custom">{t("tax.rate_custom")}</option>
                    </select>
                  </label>
                  {incomeTaxPreset === "custom" && (
                    <label className={labelClass()}>
                      {t("tax.rate_custom_value")}
                      <input
                        name="companyIncomeTaxRateCustom"
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        defaultValue="30"
                        className={fieldClass()}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.2fr]">
                <button type="submit" disabled={btnState === "saving"} className={`rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg transition ${btnState === "saved" ? "bg-emerald-600 shadow-emerald-700/20" : btnState === "saving" ? "cursor-wait bg-teal-600 shadow-teal-700/20" : "bg-teal-600 shadow-teal-700/20 hover:bg-teal-700"}`}>
                  {saveLabel}
                </button>
                <div ref={statusRef} role="status" aria-live="polite" className={`rounded-2xl px-4 py-3 text-sm font-bold ${msg ? (msg.ok ? "border border-teal-200 bg-teal-50 text-teal-900" : "border border-amber-200 bg-amber-50 text-amber-900") : "border border-dashed border-slate-200 bg-slate-50 text-slate-400"}`}>
                  {msg?.text ?? t("vat.save_status_hint")}
                </div>
              </div>
            </form>
          </ProCard>
        </section>

        <p className="mt-6 text-center text-sm font-semibold text-slate-500">
          <Link href="/vat" className="text-teal-700 underline">{t("vat.view_return")}</Link>
          {" · "}
          <Link href="/dashboard" className="text-teal-700 underline">{t("nav.dashboard")}</Link>
        </p>
      </ProMain>
    </ProPageShell>
  );
}
