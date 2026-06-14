import type { AppData } from "./types";

const STORAGE_KEY = "lakbiz-app-data-v1";

export const emptyAppData = (): AppData => ({
  products: [],
  sales: [],
  stockLogs: [],
});

export function loadAppData(): AppData {
  if (typeof window === "undefined") return emptyAppData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyAppData();
    return { ...emptyAppData(), ...JSON.parse(raw) } as AppData;
  } catch {
    return emptyAppData();
  }
}

export function saveAppData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearAppData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
