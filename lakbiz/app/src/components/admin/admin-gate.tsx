"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
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
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchAdminMe()
      .then(async (res) => {
        const json = (await res.json()) as {
          ok?: boolean;
          admin?: { email: string };
          error?: string;
        };
        if (cancelled) return;
        if (res.ok && json.ok) {
          setEmail(json.admin?.email ?? null);
          setState("ok");
          return;
        }
        setState("denied");
        if (res.status === 401) router.replace("/login?next=/admin");
      })
      .catch(() => {
        if (!cancelled) setState("denied");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

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
