"use client";

import { useEffect, useMemo, useState } from "react";
import { ProBadge, ProEmptyState } from "@/components/ui/pro-shell";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { BusinessInfo } from "@/lib/invoice";
import {
  composeMessage,
  getTemplate,
  type MessageTemplateId,
} from "@/lib/messaging";
import {
  openWhatsAppShare,
  personalizeBulkMessage,
  type BulkWhatsAppRecipient,
} from "@/lib/messaging/bulk-whatsapp";

const BULK_TEMPLATES: MessageTemplateId[] = [
  "credit_reminder",
  "payment_thanks",
  "custom",
];

type BulkWhatsAppComposerProps = {
  open: boolean;
  onClose: () => void;
  recipients: BulkWhatsAppRecipient[];
  business: BusinessInfo;
};

export function BulkWhatsAppComposer({
  open,
  onClose,
  recipients,
  business,
}: BulkWhatsAppComposerProps) {
  const { t, locale } = useLocale();
  const [templateId, setTemplateId] =
    useState<MessageTemplateId>("credit_reminder");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stepIndex, setStepIndex] = useState(0);
  const [sending, setSending] = useState(false);

  const shopPhone = business.phone ? `Tel: ${business.phone}` : "";

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(recipients.map((r) => r.id)));
    setStepIndex(0);
    setSending(false);
    setTemplateId("credit_reminder");
  }, [open, recipients]);

  useEffect(() => {
    if (!open) return;
    const template = getTemplate(templateId);
    const sample = recipients[0];
    setBody(
      composeMessage(templateId, locale, {
        customerName: sample?.name ?? "{{customerName}}",
        shopName: business.name,
        shopPhone,
        creditBalance: formatLkr(sample?.creditBalance ?? 0),
        amount: "",
      }),
    );
  }, [open, templateId, locale, business.name, shopPhone, recipients]);

  const queue = useMemo(
    () => recipients.filter((r) => selected.has(r.id)),
    [recipients, selected],
  );

  const current = queue[stepIndex];

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenCurrent = () => {
    if (!current) return;
    const text = personalizeBulkMessage(body, current, formatLkr);
    openWhatsAppShare(text, current.phone);
    setSending(true);
  };

  const handleNext = () => {
    if (stepIndex + 1 >= queue.length) {
      onClose();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[2rem] border border-white/80 bg-white p-5 shadow-2xl shadow-slate-950/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-green-600">
              {t("msg.bulk_whatsapp")}
            </p>
            <h3 className="mt-2 text-xl font-black text-slate-950">
              {t("msg.bulk_whatsapp_hint")}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        {recipients.length === 0 ? (
          <div className="mt-6 p-4">
            <ProEmptyState title={t("msg.bulk_no_phones")} />
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {BULK_TEMPLATES.map((id) => {
                const template = getTemplate(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTemplateId(id)}
                    className={`rounded-2xl px-3 py-2 text-xs font-black transition ${
                      templateId === id
                        ? "bg-green-600 text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {locale === "si" ? template.labelSi : template.labelEn}
                  </button>
                );
              })}
            </div>

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-green-300 focus:bg-white focus:ring-4 focus:ring-green-100"
            />
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {t("msg.bulk_placeholder_hint")}
            </p>

            <div className="mt-4 flex-1 overflow-y-auto rounded-2xl border border-slate-200">
              <div className="sticky top-0 flex items-center justify-between border-b bg-slate-50 px-4 py-2">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  {t("msg.select_recipients")}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      selected.size === recipients.length
                        ? new Set()
                        : new Set(recipients.map((r) => r.id)),
                    )
                  }
                  className="text-xs font-black text-teal-700 hover:underline"
                >
                  {selected.size === recipients.length
                    ? t("msg.deselect_all")
                    : t("msg.select_all")}
                </button>
              </div>
              <ul className="divide-y divide-slate-100">
                {recipients.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black text-slate-950">{r.name}</p>
                      <p className="text-xs font-semibold text-slate-500">{r.phone}</p>
                    </div>
                    {r.creditBalance != null && r.creditBalance > 0 && (
                      <ProBadge tone="amber">{formatLkr(r.creditBalance)}</ProBadge>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {queue.length > 0 && (
              <div className="mt-4 rounded-2xl border border-green-100 bg-green-50/80 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-green-800">
                  {t("msg.bulk_progress")
                    .replace("{{current}}", String(stepIndex + 1))
                    .replace("{{total}}", String(queue.length))}
                </p>
                <p className="mt-1 text-sm font-black text-slate-950">
                  {current.name} · {current.phone}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-xs font-semibold text-slate-600">
                  {personalizeBulkMessage(body, current, formatLkr)}
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={queue.length === 0}
                onClick={handleOpenCurrent}
                className="flex-1 rounded-2xl bg-green-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-green-700/20 hover:bg-green-700 disabled:opacity-50"
              >
                {sending ? t("msg.bulk_resend") : t("msg.open_whatsapp")}
              </button>
              {sending && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
                  {stepIndex + 1 >= queue.length
                    ? t("msg.bulk_done")
                    : t("msg.bulk_send_next")}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
