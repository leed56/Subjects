"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { SignedInBanner } from "@/components/sign-out-button";
import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/lib/i18n/locale-provider";

async function fetchAdminMe(retry = 0): Promise<Response> {
  const res = await fetch("/api/admin/me", { credentials: "same-origin" });
  if (res.status === 401 && retry < 4) {
    await new Promise((r) => setTimeout(r, 200 * (retry + 1)));
    return fetchAdminMe(retry + 1);
  }
  return res;
}

export function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t } = useLocale();
  const { user } = useAuth();
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState("loading");
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void fetchAdminMe()
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          admin?: { email: string };
          error?: string;
        } | null;
        if (cancelled) return;
        if (res.ok && json?.ok) {
          setEmail(json.admin?.email ?? null);
          setState("ok");
          return;
        }
        if (res.status === 401) {
          router.replace("/login?next=/admin");
          return;
        }
        if (res.status === 403) {
          setState("denied");
          setEmail(json?.admin?.email ?? user?.email ?? null);
          return;
        }
        setState("error");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, router, user?.email]);

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <AdminNav />
        <main className="mx-auto max-w-6xl px-4 py-16">{t("admin.loading")}</main>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <AdminNav />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h2 className="text-xl font-bold text-white">{t("admin.access_denied")}</h2>
          <p className="mt-3 text-slate-400">{t("admin.not_platform_admin")}</p>
          <div className="mx-auto mt-6 max-w-sm text-left">
            <SignedInBanner adminMode redirectAfterSignOut="/login?next=/admin" />
          </div>
        </main>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <AdminNav />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h2 className="text-xl font-bold text-white">{t("admin.load_failed")}</h2>
          <p className="mt-3 text-slate-400">{t("admin.failed")}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-6 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-500"
          >
            {t("resilience.retry")}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      {email && (
        <p className="border-b border-slate-800 bg-slate-900 px-4 py-2 text-center text-xs text-slate-400">
          {t("admin.signed_in_as")} {email}
        </p>
      )}
      {children}
    </div>
  );
}
