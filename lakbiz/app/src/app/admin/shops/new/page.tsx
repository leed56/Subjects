"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { BusinessTemplate } from "@/lib/admin/templates";
import { BUSINESS_TEMPLATES } from "@/lib/admin/templates";
import type { PlanId } from "@/lib/subscription/types";

const PLANS: PlanId[] = ["starter", "business", "pro"];

export default function AdminCreateShopPage() {
  const router = useRouter();
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
  const [created, setCreated] = useState<{
    email: string;
    password: string;
    organizationId: string;
    sector: string;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/admin/templates")
      .then((r) => r.json())
      .then((json: { ok?: boolean; templates?: BusinessTemplate[] }) => {
        if (json.ok && json.templates?.length) {
          setTemplates(json.templates);
        }
      });
  }, []);

  useEffect(() => {
    const t = templates.find((x) => x.id === templateId);
    if (t) setPlanId(t.defaultPlanId);
  }, [templateId, templates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCreated(null);

    const res = await fetch("/api/admin/shops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopName,
        ownerEmail,
        password,
        phone,
        templateId,
        planId,
        trialDays,
      }),
    });

    const json = (await res.json()) as {
      ok?: boolean;
      shop?: {
        email: string;
        organizationId: string;
        sector: string;
      };
      error?: string;
    };

    setLoading(false);

    if (!res.ok || !json.ok || !json.shop) {
      setError(json.error ?? "Could not create shop");
      return;
    }

    setCreated({
      email: json.shop.email,
      password,
      organizationId: json.shop.organizationId,
      sector: json.shop.sector,
    });
  };

  if (created) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <div className="rounded-2xl border border-teal-800 bg-teal-950/40 p-6">
          <h2 className="text-xl font-bold text-white">Shop created</h2>
          <p className="mt-2 text-sm text-teal-100">
            Give these login details to the customer. Each shop has its own isolated
            data.
          </p>
          <dl className="mt-6 space-y-3 text-sm">
            <div>
              <dt className="text-slate-400">Login URL</dt>
              <dd className="font-mono text-white">{window.location.origin}/login</dd>
            </div>
            <div>
              <dt className="text-slate-400">Email</dt>
              <dd className="font-mono text-white">{created.email}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Password</dt>
              <dd className="font-mono text-white">{created.password}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Business type</dt>
              <dd className="capitalize text-white">{created.sector.replace("_", " ")}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push("/admin/shops")}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white"
            >
              Back to shops
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
              Create another
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/admin/shops" className="text-sm text-teal-400 hover:underline">
        ← All shops
      </Link>
      <h2 className="mt-4 text-2xl font-bold text-white">Create shop</h2>
      <p className="mt-2 text-slate-400">
        Select a business template, set login details, and provision an isolated tenant.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <fieldset>
          <legend className="mb-3 text-sm font-medium text-slate-200">
            Business template *
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  templateId === t.id
                    ? "border-teal-500 bg-teal-950 ring-2 ring-teal-500"
                    : "border-slate-700 bg-slate-900 hover:border-slate-600"
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                <span className="mt-1 block text-xs font-semibold text-white">
                  {t.nameEn}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm text-slate-200">
          Shop name *
          <input
            required
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          />
        </label>

        <label className="block text-sm text-slate-200">
          Owner email (login) *
          <input
            type="email"
            required
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          />
        </label>

        <label className="block text-sm text-slate-200">
          Password *
          <input
            type="text"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-white"
          />
        </label>

        <label className="block text-sm text-slate-200">
          Phone
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-200">
            Plan
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value as PlanId)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-200">
            Trial days
            <input
              type="number"
              min={0}
              max={90}
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            />
          </label>
        </div>

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
          {loading ? "Creating…" : "Create shop & login"}
        </button>
      </form>
    </main>
  );
}
