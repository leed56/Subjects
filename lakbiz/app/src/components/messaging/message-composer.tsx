"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import {
  composeFromContext,
  defaultTemplateForContext,
  dispatchMessage,
  formatSlPhoneDisplay,
  isValidSlMobile,
  loadNotificationSettings,
  appendNotificationLog,
  smsSegmentInfo,
  templatesForContext,
  type MessageChannel,
  type MessageContext,
  type MessageTemplateId,
} from "@/lib/messaging";
import { useSmsApiConfigured, useWhatsAppApiConfigured } from "@/lib/messaging/use-sms-api-configured";
import { sectorAllowsApiWhatsApp } from "@/lib/messaging/wasender-sectors";

type MessageComposerProps = {
  open: boolean;
  onClose: () => void;
  phone?: string;
  recipientName: string;
  context: MessageContext;
  defaultTemplate?: MessageTemplateId;
  contextId?: string;
};

const CHANNELS: {
  id: MessageChannel;
  labelKey: string;
  icon: string;
  color: string;
}[] = [
  {
    id: "whatsapp",
    labelKey: "msg.whatsapp",
    icon: "💬",
    color: "from-green-500 to-emerald-600",
  },
  {
    id: "sms",
    labelKey: "msg.sms",
    icon: "📱",
    color: "from-sky-500 to-blue-600",
  },
  {
    id: "api_sms",
    labelKey: "msg.api_sms",
    icon: "⚡",
    color: "from-violet-500 to-purple-600",
  },
  {
    id: "api_whatsapp",
    labelKey: "msg.api_whatsapp",
    icon: "🚀",
    color: "from-green-600 to-teal-700",
  },
];

export function MessageComposer({
  open,
  onClose,
  phone,
  recipientName,
  context,
  defaultTemplate,
  contextId,
}: MessageComposerProps) {
  const { t } = useLocale();
  const { can, refreshOrg, org } = useSubscription();
  const canApiSms = can("bulk_messaging");
  // WhatsApp API sending is a rollout pilot, not yet every sector (see
  // wasender-sectors.ts for why — one connected number, shared by whichever
  // sectors are listed there). Same bulk_messaging plan gate as SMS API.
  const canApiWhatsApp = can("bulk_messaging") && sectorAllowsApiWhatsApp(org.sector);
  const settings = loadNotificationSettings();
  const [channel, setChannel] = useState<MessageChannel>(settings.defaultChannel);
  const [templateId, setTemplateId] = useState<MessageTemplateId>(
    defaultTemplate ?? defaultTemplateForContext(context),
  );
  const [messageLang, setMessageLang] = useState<"si" | "en">(
    settings.preferredLanguage,
  );
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const templates = templatesForContext(context.type);
  const smsApiConfigured = useSmsApiConfigured();
  const apiEnabled = smsApiConfigured === true;
  const whatsappApiConfigured = useWhatsAppApiConfigured();
  const whatsappApiEnabled = whatsappApiConfigured === true;

  // Reported live: picking a different template card (e.g. "Job
  // completed") while the composer was open kept snapping back to
  // whatever defaultTemplate opened it with. Root cause: `context` is a
  // fresh object literal built by every caller on every one of *their*
  // renders (e.g. job-invoice-view.tsx's `context={{ type: "ac_job", job,
  // business, items }}`) -- a new reference regardless of whether the
  // job/sale/customer it describes actually changed. This effect had
  // `context` in its dependency array, so any unrelated re-render of the
  // page this composer lives on (which happens on every state update
  // anywhere upstream, template selection included once it round-trips
  // through React) re-ran it and reset templateId back to defaultTemplate
  // -- overwriting the user's own pick before they could even send it.
  // `contextId` is the actual identity signal here: a plain string prop
  // that only changes when this composer is really being pointed at a
  // different record, unlike `context` itself.
  useEffect(() => {
    if (!open) return;
    void refreshOrg();
    setTemplateId(defaultTemplate ?? defaultTemplateForContext(context));
    setChannel(
      settings.defaultChannel === "api_sms" && !canApiSms
        ? "whatsapp"
        : settings.defaultChannel === "api_whatsapp" && !canApiWhatsApp
          ? "whatsapp"
          : settings.defaultChannel,
    );
    setMessageLang(settings.preferredLanguage);
    setFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contextId, defaultTemplate, settings.defaultChannel, settings.preferredLanguage, canApiSms, canApiWhatsApp, refreshOrg]);

  // Same unstable-`context`-reference issue as the effect above, and
  // arguably worse here: without this, a manually edited message body
  // could get silently overwritten back to the template text by an
  // unrelated re-render, not just a template switch getting reverted.
  useEffect(() => {
    if (!open) return;
    setBody(composeFromContext(context, templateId, messageLang));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contextId, templateId, messageLang]);

  const segment = useMemo(
    () => smsSegmentInfo(body, messageLang),
    [body, messageLang],
  );

  const phoneOk = isValidSlMobile(phone);

  if (!open) return null;

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    setFeedback(null);

    const result = await dispatchMessage(channel, body, phone, {
      templateId,
      contextType: context.type,
      contextId,
      recipientName,
    });

    appendNotificationLog({
      channel,
      templateId,
      recipientPhone: phone ?? "",
      recipientName,
      messageBody: body,
      contextType: context.type,
      contextId,
      delivery: result.ok
        ? channel === "api_sms" || channel === "api_whatsapp"
          ? "api_sent"
          : "opened"
        : "api_failed",
      providerRef: result.providerRef,
    });

    setSending(false);
    if (result.ok) {
      setFeedback(t("msg.sent_ok"));
      setTimeout(onClose, 1200);
    } else {
      setFeedback(result.error ?? t("msg.sent_fail"));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="border-b border-slate-100 bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-teal-100">
                {t("msg.compose_title")}
              </p>
              <h2 className="text-lg font-bold">{recipientName}</h2>
              <p className="text-sm text-teal-50">
                {formatSlPhoneDisplay(phone)}
                {!phoneOk && (
                  <span className="ml-2 rounded bg-amber-400/30 px-1.5 py-0.5 text-xs text-amber-100">
                    {t("msg.phone_invalid")}
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/20 px-3 py-1 text-sm hover:bg-white/30"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 sm:flex-row">
          <div className="flex-1 space-y-4">
            <div className="flex gap-2">
              {CHANNELS.filter((c) => {
                if (c.id === "api_sms") return apiEnabled && canApiSms;
                if (c.id === "api_whatsapp") return whatsappApiEnabled && canApiWhatsApp;
                return true;
              }).map(
                (c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChannel(c.id)}
                    className={`flex flex-1 flex-col items-center rounded-xl border-2 px-2 py-3 text-xs font-semibold transition ${
                      channel === c.id
                        ? `border-transparent bg-gradient-to-br ${c.color} text-white shadow-md`
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-lg">{c.icon}</span>
                    {t(c.labelKey)}
                  </button>
                ),
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMessageLang("si")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  messageLang === "si"
                    ? "bg-teal-700 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                සිංහල
              </button>
              <button
                type="button"
                onClick={() => setMessageLang("en")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  messageLang === "en"
                    ? "bg-teal-700 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                English
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setTemplateId(tmpl.id)}
                  className={`rounded-xl border p-2.5 text-left text-xs transition ${
                    templateId === tmpl.id
                      ? "border-teal-400 bg-teal-50 ring-2 ring-teal-200"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className="text-base">{tmpl.icon}</span>
                  <span className="mt-1 block font-semibold text-slate-800">
                    {messageLang === "si" ? tmpl.labelSi : tmpl.labelEn}
                  </span>
                </button>
              ))}
            </div>

            <label className="block">
              <span className="text-xs font-medium text-slate-500">
                {t("msg.message_body")}
              </span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
              <p className="mt-1 text-right text-xs text-slate-400">
                {segment.chars} {t("msg.chars")} · {segment.segments}{" "}
                {t("msg.segments")} ({segment.limit}/{t("msg.segment")})
              </p>
            </label>
          </div>

          <div className="hidden w-44 shrink-0 sm:block">
            <div className="rounded-[2rem] border-4 border-slate-800 bg-slate-900 p-2 shadow-xl">
              <div className="rounded-[1.5rem] bg-[#0b141a] p-3">
                <div className="mb-2 flex items-center gap-2 border-b border-white/10 pb-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500" />
                  <div>
                    <p className="text-[10px] font-semibold text-white">
                      {recipientName}
                    </p>
                    <p className="text-[9px] text-green-400">{t("msg.preview_online")}</p>
                  </div>
                </div>
                <div className="rounded-lg rounded-tl-none bg-[#005c4b] px-2 py-2 text-[10px] leading-snug text-white whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  {body || t("msg.preview_empty")}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
          {feedback && (
            <p
              className={`mb-3 text-center text-sm ${
                feedback.includes("fail") || feedback.includes("Invalid")
                  ? "text-red-600"
                  : "text-teal-700"
              }`}
            >
              {feedback}
            </p>
          )}
          <button
            type="button"
            disabled={sending || !body.trim()}
            onClick={handleSend}
            className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 transition hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50"
          >
            {sending
              ? t("msg.sending")
              : channel === "api_sms"
                ? t("msg.send_api")
                : channel === "api_whatsapp"
                  ? t("msg.send_api_whatsapp")
                  : channel === "whatsapp"
                    ? t("msg.send_whatsapp")
                    : t("msg.send_sms")}
          </button>
        </div>
      </div>
    </div>
  );
}
