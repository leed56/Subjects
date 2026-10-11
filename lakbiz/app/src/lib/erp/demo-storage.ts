import { createDemoState } from "./demo-data";
import type { SectorId } from "@/lib/types";
import type { DemoState } from "./demo-types";
import { balanced } from "./demo-engine";
const PREFIX = "lakbiz:client-showcase:v1:";
export const demoStorageKey = (industry: SectorId) => `${PREFIX}${industry}`;
export function readDemoState(industry: SectorId): DemoState {
  try {
    const raw = localStorage.getItem(demoStorageKey(industry));
    if (raw) {
      const s = JSON.parse(raw) as DemoState;
      if (
        s.schemaVersion === 1 &&
        s.industry === industry &&
        Array.isArray(s.products) &&
        Array.isArray(s.audit) &&
        s.journals.every((j) => balanced(j.lines))
      )
        return s;
    }
  } catch {
    /* Corrupt or unavailable sample storage: recover from deterministic seed. */
  }
  return createDemoState(industry);
}
export function saveDemoState(state: DemoState) {
  localStorage.setItem(demoStorageKey(state.industry), JSON.stringify(state));
}
export function demoSessionKey(industry: SectorId) {
  return `${PREFIX}session:${industry}`;
}
/** The sample session is a presentation convenience, never a production authorization token. */
export function hasDemoSession(industry: SectorId) {
  try {
    const expiry = Number(sessionStorage.getItem(demoSessionKey(industry)));
    return Number.isFinite(expiry) && expiry > Date.now();
  } catch {
    return false;
  }
}
export function startDemoSession(industry: SectorId) {
  sessionStorage.setItem(
    demoSessionKey(industry),
    String(Date.now() + 8 * 60 * 60 * 1000),
  );
}
export function endDemoSession(industry: SectorId) {
  sessionStorage.removeItem(demoSessionKey(industry));
}
