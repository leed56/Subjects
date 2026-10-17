"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LocaleProvider } from "@/lib/i18n/locale-provider";
import { AuthProvider } from "@/components/auth-provider";
import { PlatformAdminRedirect } from "@/components/platform-admin-redirect";
import { ShopRouteGuard } from "@/components/shop-route-guard";
import { AppStoreProvider } from "@/lib/store/app-store-provider";
import { SubscriptionProvider } from "@/lib/subscription/subscription-provider";
import { ToastProvider } from "@/components/ui/toast";

/** Sample workspaces never mount live auth, sync, subscriptions or service workers. */
export function RuntimeProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/demo" || pathname.startsWith("/demo/"))
    return (
      <LocaleProvider>
        <ToastProvider>{children}</ToastProvider>
      </LocaleProvider>
    );
  return (
    <LocaleProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <ToastProvider>
            <PlatformAdminRedirect />
            <ShopRouteGuard />
            <AppStoreProvider>{children}</AppStoreProvider>
          </ToastProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </LocaleProvider>
  );
}
