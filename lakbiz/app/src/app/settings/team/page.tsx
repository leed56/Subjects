"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import {
  ProButton,
  ProCard,
  ProLoadingState,
  ProMain,
  ProPageHeader,
} from "@/components/ui/pro-shell";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import type { OrgRole } from "@/lib/subscription/types";

const EDITABLE_ROLES: OrgRole[] = ["data_entry", "cashier", "technician", "manager"];

type MemberRow = {
  userId: string;
  email: string | null;
  role: OrgRole;
  createdAt: string;
};

export default function TeamSettingsPage() {
  const { t } = useLocale();
  const { canManageTeam } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<OrgRole>("data_entry");
  const [submitting, setSubmitting] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    void fetch("/api/settings/team")
      .then((r) => r.json())
      .then((json: { ok?: boolean; members?: MemberRow[]; error?: string }) => {
        if (json.ok && json.members) setMembers(json.members);
        else setMessage(json.error ?? t("team.load_error"));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (canManageTeam) load();
  }, [canManageTeam, load]);

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

  const handleRoleChange = async (memberUserId: string, nextRole: OrgRole) => {
    if (updatingUserId) return;
    setUpdatingUserId(memberUserId);
    const res = await fetch("/api/settings/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_role", userId: memberUserId, role: nextRole }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    setUpdatingUserId(null);
    if (!json.ok) {
      toast({ tone: "error", title: t("common.save_failed"), description: json.error });
      return;
    }
    setMembers((prev) => prev.map((m) => (m.userId === memberUserId ? { ...m, role: nextRole } : m)));
    toast({ tone: "success", title: t("common.update") });
  };

  const confirmRemove = async () => {
    if (!removeTarget || removing) return;
    setRemoving(true);
    const res = await fetch("/api/settings/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_member", userId: removeTarget.userId }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    setRemoving(false);
    if (!json.ok) {
      toast({ tone: "error", title: t("common.save_failed"), description: json.error });
      return;
    }
    setMembers((prev) => prev.filter((m) => m.userId !== removeTarget.userId));
    toast({ tone: "success", title: t("common.delete"), description: removeTarget.email ?? undefined });
    setRemoveTarget(null);
  };

  if (!canManageTeam) {
    return (
      <AppShell>
        <ProMain>
          <p className="text-sm font-semibold text-slate-600">{t("team.owner_only")}</p>
        </ProMain>
      </AppShell>
    );
  }

  return (
    <AppShell>
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
              <label className="block text-sm font-bold text-slate-700">
                {t("team.email")}
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold"
                />
              </label>
              <label className="block text-sm font-bold text-slate-700">
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
              <label className="block text-sm font-bold text-slate-700">
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
                className="w-full rounded-2xl bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
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
                {members.map((m) => {
                  const isSelf = m.userId === user?.id;
                  const isOwner = m.role === "owner";
                  return (
                    <li key={m.userId} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900">{m.email ?? m.userId.slice(0, 8)}</p>
                        {(isSelf || isOwner) && (
                          <p className="text-xs font-semibold text-slate-500">{m.role.replace("_", " ")}</p>
                        )}
                      </div>
                      {!isSelf && !isOwner && (
                        <div className="flex shrink-0 items-center gap-2">
                          <select
                            value={m.role}
                            disabled={updatingUserId === m.userId}
                            onChange={(e) => void handleRoleChange(m.userId, e.target.value as OrgRole)}
                            className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-semibold disabled:opacity-50"
                          >
                            {EDITABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {t(`team.role_${r}`)}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setRemoveTarget(m)}
                            className="text-xs font-semibold text-rose-600 hover:underline"
                          >
                            {t("team.remove")}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </ProCard>
        </div>

        <ConfirmDialog
          open={!!removeTarget}
          title={t("team.remove_confirm_title")}
          description={removeTarget?.email ?? undefined}
          tone="danger"
          confirmLabel={t("team.remove")}
          cancelLabel={t("common.cancel")}
          loading={removing}
          onConfirm={() => void confirmRemove()}
          onClose={() => setRemoveTarget(null)}
        />

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/dashboard" className="text-teal-700 underline">
            {t("team.back_dash")}
          </Link>
        </p>
      </ProMain>
    </AppShell>
  );
}
