"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";

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
        <main className="mx-auto max-w-6xl px-4 py-16">Loading admin…</main>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200">
        <AdminNav />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h2 className="text-xl font-bold text-white">Access denied</h2>
          <p className="mt-3 text-slate-400">
            Your account is not a platform admin. Ask the system owner to add you
            to <code className="text-teal-300">platform_admins</code> in Supabase.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />
      {email && (
        <p className="border-b border-slate-800 bg-slate-900 px-4 py-2 text-center text-xs text-slate-400">
          Signed in as {email}
        </p>
      )}
      {children}
    </div>
  );
}
