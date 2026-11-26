"use client";

import { useEffect, useRef, useState } from "react";
import { formatLkr } from "@/lib/format";
import {
  deleteSaleDraft,
  listSaleDrafts,
  saleDraftErrorMessage,
  type SaleDraft,
} from "@/lib/supabase/sale-drafts";

type HeldSaleDraftsDialogProps = {
  organizationId: string;
  locale: string;
  onClose: () => void;
  onResume: (draft: SaleDraft) => void;
};

function copy(locale: string) {
  if (locale === "si") {
    return {
      title: "රඳවාගත් බිල්පත්",
      subtitle: "ගෙවීමට පෙර සුරැකූ කෙටුම්පත්. නැවත විවෘත කර සංස්කරණය කරන්න.",
      close: "වසන්න",
      emptyTitle: "රඳවාගත් බිල්පත් නැහැ",
      empty: "වත්මන් බිල්පත ගෙවීමට පෙර සුරැකීමට “බිල්පත රඳවන්න” තෝරන්න.",
      resume: "නැවත විවෘත කරන්න",
      remove: "මකන්න",
      confirm: "මෙම නොගෙවූ කෙටුම්පත පමණක් මැකෙනු ඇත. සම්පූර්ණ කළ බිල්පත් හෝ තොගය වෙනස් නොවේ.",
      cancel: "අවලංගු කරන්න",
      delete: "කෙටුම්පත මකන්න",
      items: "භාණ්ඩ",
      held: "රඳවාගත්",
      noStock: "තොගය හෝ ගෙවීම වෙනස් කර නැහැ",
      loading: "රඳවාගත් බිල්පත් පූරණය කරමින්…",
      refresh: "නැවත පූරණය",
      saved: "අවසන් වරට සුරැකුවේ",
    };
  }
  if (locale === "ta") {
    return {
      title: "சேமித்த பில்கள்",
      subtitle: "பணம் செலுத்துவதற்கு முன் சேமித்தவை. மீண்டும் திறந்து திருத்தலாம்.",
      close: "மூடு",
      emptyTitle: "சேமித்த பில்கள் இல்லை",
      empty: "தற்போதைய பில்லை பணம் செலுத்துவதற்கு முன் சேமிக்க “பில்லை சேமி” என்பதைத் தேர்ந்தெடுக்கவும்.",
      resume: "மீண்டும் திற",
      remove: "நீக்கு",
      confirm: "செலுத்தப்படாத வரைவு மட்டும் நீக்கப்படும். முடிக்கப்பட்ட பில்களும் இருப்பும் மாறாது.",
      cancel: "ரத்து செய்",
      delete: "வரைவை நீக்கு",
      items: "பொருட்கள்",
      held: "சேமிக்கப்பட்டது",
      noStock: "இருப்பு அல்லது கட்டணம் மாற்றப்படவில்லை",
      loading: "சேமித்த பில்கள் ஏற்றப்படுகின்றன…",
      refresh: "மீண்டும் ஏற்று",
      saved: "கடைசியாக சேமித்தது",
    };
  }
  return {
    title: "Held bills",
    subtitle: "Unpaid drafts saved before checkout. Reopen one to review and edit it.",
    close: "Close",
    emptyTitle: "No held bills",
    empty: "Choose Hold bill to save the current bill before payment.",
    resume: "Reopen & edit",
    remove: "Delete",
    confirm: "This removes only the unpaid draft. Completed bills and stock are unchanged.",
    cancel: "Keep bill",
    delete: "Delete draft",
    items: "items",
    held: "Held",
    noStock: "No stock or payment has been changed",
    loading: "Loading held bills…",
    refresh: "Refresh",
    saved: "Last saved",
  };
}

export function HeldSaleDraftsDialog({
  organizationId,
  locale,
  onClose,
  onResume,
}: HeldSaleDraftsDialogProps) {
  const text = copy(locale);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [drafts, setDrafts] = useState<SaleDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<"not_configured" | "unavailable" | "not_found" | "failed" | null>(null);

  const reload = async () => {
    setLoading(true);
    setErrorCode(null);
    try {
      const result = await listSaleDrafts(organizationId);
      if (result.ok) setDrafts(result.data);
      else setErrorCode(result.code);
    } catch {
      setErrorCode("failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let current = true;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const load = async () => {
      try {
        const result = await listSaleDrafts(organizationId);
        if (!current) return;
        if (result.ok) setDrafts(result.data);
        else setErrorCode(result.code);
      } catch {
        if (current) setErrorCode("failed");
      } finally {
        if (current) setLoading(false);
      }
    };
    void load();
    const close = () => onClose();
    dialog?.addEventListener("close", close);
    return () => {
      current = false;
      dialog?.removeEventListener("close", close);
      if (dialog?.open) dialog.close();
    };
  }, [onClose, organizationId]);

  const removeDraft = async (draftId: string) => {
    if (busyId) return;
    setBusyId(draftId);
    setErrorCode(null);
    try {
      const result = await deleteSaleDraft(organizationId, draftId);
      if (result.ok) {
        setDrafts((current) => current.filter((draft) => draft.id !== draftId));
        setConfirmDeleteId(null);
      } else {
        setErrorCode(result.code);
      }
    } catch {
      setErrorCode("failed");
    } finally {
      setBusyId(null);
    }
  };

  const dateLocale = locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK";
  const errorText = errorCode ? saleDraftErrorMessage(locale, errorCode) : "";

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-x-0 bottom-0 m-0 w-full max-w-none border-0 bg-transparent p-0 text-slate-900 backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm sm:inset-0 sm:m-auto sm:w-full sm:max-w-2xl"
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      aria-labelledby="held-sale-drafts-title"
    >
      <section className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-white/70 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.3)] sm:rounded-[28px]">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700">LakBiz · Grocery</p>
            <h2 id="held-sale-drafts-title" className="mt-1 text-xl font-black tracking-tight text-slate-950">{text.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{text.subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 shrink-0 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">{text.close}</button>
        </header>

        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/75 px-5 py-3 sm:px-7">
          <span className="text-xs font-semibold text-slate-500">{text.noStock}</span>
          <button type="button" onClick={() => void reload()} disabled={loading || Boolean(busyId)} className="min-h-10 rounded-xl px-3 text-xs font-bold text-teal-700 hover:bg-teal-50 disabled:opacity-50">{text.refresh}</button>
        </div>

        {errorText ? <p role="alert" className="mx-5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 sm:mx-7">{errorText}</p> : null}

        <div className="min-h-40 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm font-semibold text-slate-500">{text.loading}</div>
          ) : drafts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-12 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl text-teal-700 shadow-sm" aria-hidden="true">▤</div>
              <h3 className="mt-3 text-base font-bold text-slate-900">{text.emptyTitle}</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">{text.empty}</p>
            </div>
          ) : drafts.map((draft) => {
            const count = Object.values(draft.payload.cart).reduce((sum, qty) => sum + qty, 0);
            const updated = draft.updatedAt
              ? new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(draft.updatedAt))
              : "—";
            const deleting = confirmDeleteId === draft.id;
            return (
              <article key={draft.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-bold text-slate-950">{draft.title}</h3>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">{text.held}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{count} {text.items} · {text.saved} {updated}</p>
                  </div>
                  <p className="font-mono text-lg font-black text-slate-950">{formatLkr(draft.payload.snapshotTotal)}</p>
                </div>
                {deleting ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs leading-5 text-amber-950">{text.confirm}</p>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => setConfirmDeleteId(null)} disabled={Boolean(busyId)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50">{text.cancel}</button>
                      <button type="button" onClick={() => void removeDraft(draft.id)} disabled={Boolean(busyId)} className="min-h-10 rounded-xl bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50">{busyId === draft.id ? "…" : text.delete}</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => setConfirmDeleteId(draft.id)} disabled={Boolean(busyId)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{text.remove}</button>
                    <button type="button" onClick={() => onResume(draft)} disabled={Boolean(busyId)} className="min-h-11 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50">{text.resume}</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <footer className="border-t border-slate-100 px-5 py-4 safe-area-pb sm:px-7">
          <p className="text-[11px] leading-5 text-slate-400">{text.noStock}</p>
        </footer>
      </section>
    </dialog>
  );
}
