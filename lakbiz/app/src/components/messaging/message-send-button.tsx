"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { MessageContext, MessageTemplateId } from "@/lib/messaging";
import { ChatIcon } from "@/components/ui/icons";

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
  /** Set false to mount only the composer, not its own trigger button —
   * for use as a "Message" item inside an ActionMenu, where the menu item
   * itself is the trigger. Requires `open`/`onOpenChange` (controlled). */
  renderTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  renderTrigger = true,
  open: openProp,
  onOpenChange,
}: MessageSendButtonProps) {
  const { t } = useLocale();
  const [openState, setOpenState] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => (onOpenChange ? onOpenChange(next) : setOpenState(next));

  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  const baseClass =
    variant === "primary"
      ? "rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-green-700 hover:to-emerald-700"
      : variant === "icon"
        ? "flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-800 hover:bg-green-200"
        : "inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800 hover:bg-green-100";

  return (
    <>
      {renderTrigger && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={`${baseClass} disabled:opacity-40`}
          title={label ?? t("msg.send_message")}
          aria-label={variant === "icon" ? (label ?? t("msg.send_message")) : undefined}
        >
          {variant === "icon" ? <ChatIcon className="h-4 w-4" /> : (label ?? t("msg.send_message"))}
        </button>
      )}
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
