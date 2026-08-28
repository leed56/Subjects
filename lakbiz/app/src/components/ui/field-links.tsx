"use client";

import { PhoneIcon, NavigateIcon } from "@/components/ui/icons";

/**
 * Tap-to-call and tap-to-navigate links (Phase 15, mobile field UX).
 *
 * A technician standing at a job site needs to call the customer or open
 * turn-by-turn directions in one tap — up to now phone/address only
 * rendered as plain text. `tel:` and a Google Maps search URL cover both
 * without a new dependency; `NavigateLink` deliberately uses the
 * `/maps/search` endpoint (not `/dir`) since only a destination address is
 * known, not the technician's live starting point.
 */

type FieldLinkVariant = "chip" | "icon";

const CHIP_CLASS =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100";
const ICON_CLASS =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:bg-slate-100";

export function CallLink({
  phone,
  label,
  variant = "chip",
}: {
  phone: string;
  label: string;
  variant?: FieldLinkVariant;
}) {
  return (
    <a
      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
      onClick={(e) => e.stopPropagation()}
      className={variant === "icon" ? ICON_CLASS : CHIP_CLASS}
      title={label}
      aria-label={label}
    >
      <PhoneIcon className="h-4 w-4 shrink-0" />
      {variant !== "icon" && <span>{label}</span>}
    </a>
  );
}

export function NavigateLink({
  address,
  label,
  variant = "chip",
}: {
  address: string;
  label: string;
  variant?: FieldLinkVariant;
}) {
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={variant === "icon" ? ICON_CLASS : CHIP_CLASS}
      title={label}
      aria-label={label}
    >
      <NavigateIcon className="h-4 w-4 shrink-0" />
      {variant !== "icon" && <span>{label}</span>}
    </a>
  );
}
