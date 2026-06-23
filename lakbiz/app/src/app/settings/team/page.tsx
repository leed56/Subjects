"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import {
  ProButton,
  ProCard,
  ProLoadingState,
  ProMain,
  ProPageHeader,
  ProPageShell,
} from "@/components/ui/pro-shell";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import type { OrgRole } from "@/lib/subscription/types";

type MemberRow = {
  userId: string;
  email: string | null;
  role: OrgRole;
  createdAt: string;
};

export default function TeamSettingsPage() {
  const { t } = useLocale();
  const { canManageTeam } = useSubscription();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<OrgRole>("data_entry");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    void fetch("/api/settings/team")
      .then((r) => r.json())
      .then((json: { ok?: boolean; members?: MemberRow[]; error?: string }) => {
        if (json.ok && json.members) setMembers(json.members);
        else setMessage(json.error ?? t("team.load_error"));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (canManageTeam) load();
  }, [canManageTeam]);

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    const res = await fetch("/api/settings/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    setSubmitting(false);
    if (!json.ok) {
      setMessage(json.error ?? t("team.create_failed"));
      return;
    }
    setMessage(t("team.create_ok"));
    setEmail("");
    setPassword("");
    load();
  };

  if (!canManageTeam) {
    return (
      <ProPageShell>
        <SiteHeader />
        <ProMain>
          <p className="text-sm font-semibold text-slate-600">{t("team.owner_only")}</p>
        </ProMain>
      </ProPageShell>
    );
  }

  return (
    <ProPageShell>
      <SiteHeader />
      <ProMain>
        <ProPageHeader
          eyebrow={t("team.eyebrow")}
          title={t("team.title")}
          description={t("team.subtitle")}
          actions={
            <ProButton href="/settings/shop" variant="secondary">
              {t("team.back_shop")}
            </ProButton>
          }
        />

        {message && (
          <div className="mb-5 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900">
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <ProCard title={t("team.create_title")} eyebrow={t("team.create_eyebrow")}>
            <p className="mb-4 text-sm font-semibold text-slate-600">{t("team.create_hint")}</p>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <label className="block text-sm font-black text-slate-700">
                {t("team.email")}
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                />
              </label>
              <label className="block text-sm font-black text-slate-700">
                {t("team.password")}
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                />
              </label>
              <label className="block text-sm font-black text-slate-700">
                {t("team.role")}
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as OrgRole)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                >
                  <option value="data_entry">{t("team.role_data_entry")}</option>
                  <option value="cashier">{t("team.role_cashier")}</option>
                  <option value="technician">{t("team.role_technician")}</option>
                  <option value="manager">{t("team.role_manager")}</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-black text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {submitting ? t("common.saving") : t("team.create_btn")}
              </button>
            </form>
          </ProCard>

          <ProCard title={t("team.members_title")} eyebrow={t("team.members_eyebrow")}>
            {loading ? (
              <ProLoadingState label={t("common.loading")} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {members.map((m) => (
                  <li key={m.userId} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-black text-slate-900">{m.email ?? m.userId.slice(0, 8)}</p>
                      <p className="text-xs font-semibold text-slate-500">{m.role.replace("_", " ")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ProCard>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/dashboard" className="text-teal-700 underline">
            {t("team.back_dash")}
          </Link>
        </p>
      </ProMain>
    </ProPageShell>
  );
}
