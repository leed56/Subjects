"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSubscription } from "@/lib/subscription/subscription-provider";

/** Block settings pages for roles without access (e.g. data_entry). */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { canAccessSettingsPath, org } = useSubscription();

  useEffect(() => {
    if (!org.isAuthenticated) return;
    if (canAccessSettingsPath(pathname)) return;
    router.replace("/dashboard");
  }, [pathname, router, canAccessSettingsPath, org.isAuthenticated]);

  return children;
}
