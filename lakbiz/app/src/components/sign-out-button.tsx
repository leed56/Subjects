"use client";

import { useAuth } from "@/components/auth-provider";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const DEMO_ORG_KEY = "lakbiz-org-demo";
const DEMO_SUBSCRIPTION_KEY = "lakbiz-subscription-demo";

function clearLocalSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DEMO_ORG_KEY);
    localStorage.removeItem(DEMO_SUBSCRIPTION_KEY);
  } catch {
    /* ignore */
  }
}

type SignOutButtonProps = {
  redirectTo?: string;
  className?: string;
  label?: string;
};

export function SignOutButton({
  redirectTo = "/login",
  className = "",
  label,
}: SignOutButtonProps) {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const { offlinePendingSync, cloudSyncing } = useAppStore();
  const { org } = useSubscription();

  if (!user) return null;

  const handleClick = async () => {
    if (org.isAuthenticated && offlinePendingSync) {
      if (!window.confirm(t("offline.logout_confirm"))) return;
    }
    if (cloudSyncing) {
      if (!window.confirm(t("offline.logout_syncing_confirm"))) return;
    }
    clearLocalSession();
    await logout();
    window.location.href = redirectTo;
  };

  return (
    <button type="button" onClick={() => void handleClick()} className={className}>
      {label ?? t("sub.sign_out")}
    </button>
  );
}

export function SignedInBanner({
  redirectAfterSignOut = "/login",
  adminMode = false,
}: {
  redirectAfterSignOut?: string;
  adminMode?: boolean;
}) {
  const { user, loading } = useAuth();
  const { t } = useLocale();

  if (loading || !user) return null;

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        adminMode
          ? "border-amber-700/50 bg-amber-950/40 text-amber-100"
          : "border-amber-200 bg-amber-50 text-amber-950"
      }`}
    >
      <p>
        {t("admin.signed_in_as")} <span className="font-medium">{user.email}</span>
      </p>
      <p className={`mt-1 text-xs ${adminMode ? "text-amber-200/80" : "text-amber-800"}`}>
        {adminMode ? t("admin.sign_out_switch") : t("admin.sign_out_hint")}
      </p>
      <SignOutButton
        redirectTo={redirectAfterSignOut}
        label={t("admin.sign_out_switch_btn")}
        className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
          adminMode
            ? "bg-slate-800 text-teal-200 hover:bg-slate-700"
            : "bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50"
        }`}
      />
    </div>
  );
}
