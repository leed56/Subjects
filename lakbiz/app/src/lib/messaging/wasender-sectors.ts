import type { SectorId } from "@/lib/types";

// Sectors currently allowed to send WhatsApp via the real API (WasenderAPI).
// This is a business/rollout gate, not a technical one -- WasenderAPI ties
// one WhatsApp Business number to one connected account, and there's only
// one number connected today ("Google Mpt", the pharmacy pilot's number).
// Every sector listed here sends under that same shared number until more
// numbers get connected or the app grows per-org WhatsApp credentials, so
// widen this list deliberately, not by accident.
//
// Single source of truth: both the client gate (message-composer.tsx) and
// the server gate (api/messages/send-whatsapp/route.ts) read this list, so
// they can never drift out of sync the way two hardcoded `=== "pharmacy"`
// checks eventually would.
const API_WHATSAPP_SECTORS: readonly SectorId[] = ["pharmacy", "ac_hvac", "textile"];

export function sectorAllowsApiWhatsApp(
  sector: SectorId | string | null | undefined,
): boolean {
  return sector != null && (API_WHATSAPP_SECTORS as readonly string[]).includes(sector);
}
