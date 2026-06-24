"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";
import {
  dismissPwaInstallPrompt,
  isIosSafari,
  isPwaInstallDismissed,
  isPwaStandalone,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa/install-prompt";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export function PwaInstallPrompt() {
  const { t } = useLocale();
  const { org, isPlatformAdmin } = useSubscription();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isPlatformAdmin || !org.isAuthenticated) return;
    if (isPwaStandalone() || isPwaInstallDismissed()) return;

    if (isIosSafari()) {
      setShowIosHint(true);
      setHidden(false);
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setHidden(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, [org.isAuthenticated, isPlatformAdmin]);

  const dismiss = useCallback(() => {
    dismissPwaInstallPrompt();
    setHidden(true);
    setDeferred(null);
    setShowIosHint(false);
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }, [deferred, dismiss]);

  if (hidden || isPlatformAdmin || !org.isAuthenticated) return null;

  return (
    <div className="border-b border-teal-200 bg-teal-50 px-4 py-2 text-center text-sm text-teal-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3">
        <span className="font-semibold">
          {showIosHint ? t("pwa.ios_hint") : t("pwa.install_body")}
        </span>
        {!showIosHint && deferred && (
          <button
            type="button"
            onClick={() => void install()}
            className="rounded-full bg-teal-700 px-3 py-1 text-xs font-black text-white hover:bg-teal-800"
          >
            {t("pwa.install_button")}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-200 hover:bg-white"
        >
          {t("common.dismiss")}
        </button>
      </div>
    </div>
  );
}
