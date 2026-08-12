"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { MessageContext, MessageTemplateId } from "@/lib/messaging";

/**
 * Lazy-loaded (Phase 16, performance) — MessageSendButton appears on Jobs,
 * Schedule, and Teams, but the composer itself (templates, WhatsApp/SMS
 * dispatch logic) is only needed once a user actually clicks to open it.
 * Loading it on demand keeps that weight out of every page's initial JS.
 */
const MessageComposer = dynamic(() => import("./message-composer").then((m) => m.MessageComposer), { ssr: false });

type MessageSendButtonProps = {
  phone?: string;
  recipientName: string;
  context: MessageContext;
  defaultTemplate?: MessageTemplateId;
  contextId?: string;
  variant?: "primary" | "compact" | "icon";
  disabled?: boolean;
  label?: string;
};

export function MessageSendButton({
  phone,
  recipientName,
  context,
  defaultTemplate,
  contextId,
  variant = "compact",
  disabled,
  label,
}: MessageSendButtonProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  const baseClass =
    variant === "primary"
      ? "rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-green-700 hover:to-emerald-700"
      : variant === "icon"
        ? "flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-base hover:bg-green-200"
        : "inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800 hover:bg-green-100";

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setEverOpened(true);
          setOpen(true);
        }}
        className={`${baseClass} disabled:opacity-40`}
        title={label ?? t("msg.send_message")}
        aria-label={variant === "icon" ? (label ?? t("msg.send_message")) : undefined}
      >
        {variant === "icon" ? "💬" : (label ?? t("msg.send_message"))}
      </button>
      {/* Mounted only after the first open, not just hidden by `open`, so the
          dynamic import above is deferred until a user actually clicks —
          rendering it unconditionally would fetch the chunk on page load
          regardless of this prop. */}
      {everOpened && (
        <MessageComposer
          open={open}
          onClose={() => setOpen(false)}
          phone={phone}
          recipientName={recipientName}
          context={context}
          defaultTemplate={defaultTemplate}
          contextId={contextId}
        />
      )}
    </>
  );
}
