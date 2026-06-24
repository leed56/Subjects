const DISMISS_KEY = "lakbiz-pwa-install-dismissed";
const DISMISS_DAYS = 14;

export function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isIos && isSafari;
}

export function isPwaInstallDismissed(): boolean {
  if (typeof localStorage === "undefined") return false;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) return false;
  const maxAgeMs = DISMISS_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - dismissedAt < maxAgeMs;
}

export function dismissPwaInstallPrompt(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
