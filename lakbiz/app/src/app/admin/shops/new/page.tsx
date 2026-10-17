"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { BusinessTemplate } from "@/lib/admin/templates";
import { BUSINESS_TEMPLATES } from "@/lib/admin/templates";
import { adminPlanLabel, adminSectorLabel, adminTemplateLabel } from "@/lib/admin/admin-labels";
import { SectorIcon } from "@/components/sector-icon";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { PlanId } from "@/lib/subscription/types";

const PLANS: PlanId[] = ["starter", "business", "pro"];
type CreateShopField = "shopName" | "ownerEmail" | "password" | "trialDays";

export default function AdminCreateShopPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const [templates, setTemplates] = useState<BusinessTemplate[]>(BUSINESS_TEMPLATES);
  const [templateId, setTemplateId] = useState("grocery");
  const [shopName, setShopName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [planId, setPlanId] = useState<PlanId>("business");
  const [trialDays, setTrialDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templatesWarning, setTemplatesWarning] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CreateShopField, string>>>({});
  const shopNameRef = useRef<HTMLInputElement>(null);
  const ownerEmailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const trialDaysRef = useRef<HTMLInputElement>(null);
  const [created, setCreated] = useState<{
    email: string;
    password: string;
    organizationId: string;
    sector: string;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/admin/templates")
      .then((r) => r.json())
      .then((json: {
        ok?: boolean;
        templates?: BusinessTemplate[];
        source?: string;
        error?: string;
      }) => {
        if (json.templates?.length) {
          setTemplates(json.templates);
        }
        if (!json.ok || json.source === "fallback") {
          setTemplatesWarning(t("admin.templates_load_failed"));
        }
      })
      .catch(() => {
        setTemplatesWarning(t("admin.templates_load_failed"));
      });
  }, [t]);

  useEffect(() => {
    const template = templates.find((x) => x.id === templateId);
    if (template) setPlanId(template.defaultPlanId);
  }, [templateId, templates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const normalizedShopName = shopName.trim();
    const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();
    const nextErrors: Partial<Record<CreateShopField, string>> = {};
    if (!normalizedShopName) nextErrors.shopName = t("sub.shop_required");
    if (!normalizedOwnerEmail || !/^\S+@\S+\.\S+$/.test(normalizedOwnerEmail)) {
      nextErrors.ownerEmail = t("admin.email_invalid");
    }
    if (password.length < 6) nextErrors.password = t("admin.password_short");
    if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 90) {
      nextErrors.trialDays = t("admin.trial_invalid");
    }
    setFieldErrors(nextErrors);
    const firstInvalid = (Object.keys(nextErrors) as CreateShopField[])[0];
    if (firstInvalid) {
      const refs = { shopName: shopNameRef, ownerEmail: ownerEmailRef, password: passwordRef, trialDays: trialDaysRef };
      refs[firstInvalid].current?.focus();
      return;
    }

    setLoading(true);
    setError(null);
    setCreated(null);
    try {
      const res = await fetch("/api/admin/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: normalizedShopName,
          ownerEmail: normalizedOwnerEmail,
          password,
          phone: phone.trim(),
          templateId,
          planId,
          trialDays,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        shop?: { email: string; organizationId: string; sector: string };
        error?: string;
      };
      if (!res.ok || !json.ok || !json.shop) {
        setError(json.error ?? t("admin.create_error"));
        return;
      }
      setCreated({
        email: json.shop.email,
        password,
        organizationId: json.shop.organizationId,
        sector: json.shop.sector,
      });
    } catch {
      setError(t("admin.create_error"));
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <div className="rounded-2xl border border-teal-800 bg-teal-950/40 p-6">
          <h2 className="text-xl font-bold text-white">{t("admin.shop_created")}</h2>
          <p className="mt-2 text-sm text-teal-100">{t("admin.shop_created_sub")}</p>
          <dl className="mt-6 space-y-3 text-sm">
            <div>
              <dt className="text-slate-400">{t("admin.login_url")}</dt>
              <dd className="font-mono text-white">{window.location.origin}/login</dd>
            </div>
            <div>
              <dt className="text-slate-400">{t("admin.email")}</dt>
              <dd className="font-mono text-white">{created.email}</dd>
            </div>
            <div>
              <dt className="text-slate-400">{t("admin.password")}</dt>
              <dd className="font-mono text-white">{created.password}</dd>
            </div>
            <div>
              <dt className="text-slate-400">{t("admin.business_type")}</dt>
              <dd className="text-white">{adminSectorLabel(locale, created.sector)}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push("/admin/shops")}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white"
            >
              {t("admin.back_to_shops")}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setShopName("");
                setOwnerEmail("");
                setPassword("");
                setPhone("");
              }}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200"
            >
              {t("admin.create_another")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/admin/shops" className="text-sm text-teal-400 hover:underline">
        {t("admin.back_shops")}
      </Link>
      <h2 className="mt-4 text-2xl font-bold text-white">{t("admin.create_shop_title")}</h2>
      <p className="mt-2 text-slate-400">{t("admin.create_shop_sub")}</p>

      <form onSubmit={handleSubmit} noValidate aria-busy={loading} className="mt-8 space-y-6">
        {Object.keys(fieldErrors).length > 0 && (
          <div role="alert" className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-100">
            <p className="font-semibold">{t("admin.validation_summary")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {Object.values(fieldErrors).map((message) => <li key={message}>{message}</li>)}
            </ul>
          </div>
        )}
        <fieldset disabled={loading}>
          <legend className="mb-3 text-sm font-medium text-slate-200">
            {t("admin.business_template")}
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setTemplateId(template.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  templateId === template.id
                    ? "border-teal-500 bg-teal-950 ring-2 ring-teal-500"
                    : "border-slate-700 bg-slate-900 hover:border-slate-600"
                }`}
              >
                <SectorIcon sectorId={template.sectorId} className="h-5 w-5 text-teal-400" />
                <span className="mt-1 block text-xs font-semibold text-white">
                  {adminTemplateLabel(template, locale)}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm text-slate-200">
          {t("admin.shop_name")}
          <input
            ref={shopNameRef}
            required
            value={shopName}
            onChange={(e) => { setShopName(e.target.value); setFieldErrors((current) => ({ ...current, shopName: undefined })); }}
            aria-invalid={Boolean(fieldErrors.shopName)}
            aria-describedby={fieldErrors.shopName ? "shop-name-error" : undefined}
            disabled={loading}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white disabled:opacity-60"
          />
          {fieldErrors.shopName && <span id="shop-name-error" className="mt-1 block text-xs text-red-300">{fieldErrors.shopName}</span>}
        </label>

        <label className="block text-sm text-slate-200">
          {t("admin.owner_email")}
          <input
            ref={ownerEmailRef}
            type="email"
            required
            value={ownerEmail}
            onChange={(e) => { setOwnerEmail(e.target.value); setFieldErrors((current) => ({ ...current, ownerEmail: undefined })); }}
            aria-invalid={Boolean(fieldErrors.ownerEmail)}
            aria-describedby={fieldErrors.ownerEmail ? "owner-email-error" : undefined}
            disabled={loading}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white disabled:opacity-60"
          />
          {fieldErrors.ownerEmail && <span id="owner-email-error" className="mt-1 block text-xs text-red-300">{fieldErrors.ownerEmail}</span>}
        </label>

        <label className="block text-sm text-slate-200">
          {t("admin.password")}
          <input
            ref={passwordRef}
            type="text"
            required
            minLength={6}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); }}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            disabled={loading}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-white disabled:opacity-60"
          />
          {fieldErrors.password && <span id="password-error" className="mt-1 block text-xs text-red-300">{fieldErrors.password}</span>}
        </label>

        <label className="block text-sm text-slate-200">
          {t("admin.phone")}
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-200">
            {t("admin.plan")}
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value as PlanId)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {adminPlanLabel(t, p)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-200">
            {t("admin.trial_days")}
            <input
              ref={trialDaysRef}
              type="number"
              min={0}
              max={90}
              value={trialDays}
              onChange={(e) => { setTrialDays(Number(e.target.value)); setFieldErrors((current) => ({ ...current, trialDays: undefined })); }}
              aria-invalid={Boolean(fieldErrors.trialDays)}
              aria-describedby={fieldErrors.trialDays ? "trial-days-error" : undefined}
              disabled={loading}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white disabled:opacity-60"
            />
            {fieldErrors.trialDays && <span id="trial-days-error" className="mt-1 block text-xs text-red-300">{fieldErrors.trialDays}</span>}
          </label>
        </div>

        {templatesWarning && (
          <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
            {templatesWarning}
          </p>
        )}

        {error && (
          <p className="rounded-lg bg-red-950/50 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {loading ? t("admin.creating") : t("admin.create_submit")}
        </button>
      </form>
    </main>
  );
}
