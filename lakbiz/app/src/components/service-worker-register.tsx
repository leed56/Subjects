"use client";

import { useEffect } from "react";

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (process.env.NODE_ENV !== "production") return Promise.resolve(null);
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => null);
  }

  return registrationPromise;
}

/** Registers SW in production and activates updates safely. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    void registerServiceWorker().then((registration) => {
      if (!registration) return;

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (worker.state !== "installed") return;
          if (!navigator.serviceWorker.controller) return;
          worker.postMessage({ type: "SKIP_WAITING" });
        });
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  return null;
}
