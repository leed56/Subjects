"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { MessageContext, MessageTemplateId } from "@/lib/messaging";
import { MessageComposer } from "./message-composer";

type MessageSendButtonProps = {
  phone?: string;
  recipientName: string;
  context: MessageContext;
  defaultTemplate?: MessageTemplateId;
  contextId?: string;
  variant?: "primary" | "compact" | "icon";
  disabled?: boolean;
};

export function MessageSendButton({
  phone,
  recipientName,
  context,
  defaultTemplate,
  contextId,
  variant = "compact",
  disabled,
}: MessageSendButtonProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

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
        onClick={() => setOpen(true)}
        className={`${baseClass} disabled:opacity-40`}
        title={t("msg.send_message")}
      >
        {variant === "icon" ? "💬" : t("msg.send_message")}
      </button>
      <MessageComposer
        open={open}
        onClose={() => setOpen(false)}
        phone={phone}
        recipientName={recipientName}
        context={context}
        defaultTemplate={defaultTemplate}
        contextId={contextId}
      />
    </>
  );
}
