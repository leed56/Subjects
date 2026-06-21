"use client";

import { type ReactNode, useState } from "react";
import { AcJobReminderTimeline } from "@/components/ac-job-reminder-timeline";
import { AcRemindersBanner } from "@/components/ac-reminders-banner";
import { AcServiceDoneDialog } from "@/components/ac-service-done-dialog";
import { MessageSendButton } from "@/components/messaging/message-send-button";
import { SiteHeader } from "@/components/site-header";
import {
  ProBadge,
  ProButton,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
  ProPageHeader,
  ProPageShell,
  ProStatCard,
} from "@/components/ui/pro-shell";
import {
  AC_BRANDS,
  AC_BTU_OPTIONS,
  AC_JOB_STATUSES,
  jobStatusClass,
  jobStatusLabel,
} from "@/lib/ac-jobs";
import type { ACJobStatus } from "@/lib/ac-jobs";
import {
  AC_JOB_TYPES,
  defaultStatusForJobType,
  jobTypeLabel,
  type ACJobType,
} from "@/lib/ac-job-types";
import {
  canMarkServiceDone,
  computeServiceDueFromDays,
  DEFAULT_SERVICE_INTERVAL_DAYS,
  resolveServiceIntervalDays,
  SERVICE_INTERVAL_DAY_PRESETS,
  serviceDueLabel,
  serviceDueUrgency,
  serviceDueUrgencyClass,
} from "@/lib/ac-service";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { Locale } from "@/lib/i18n/translations";
import type { BusinessInfo } from "@/lib/invoice";
import { defaultTemplateForJob, loadNotificationSettings } from "@/lib/messaging";
import { useNotificationLogs } from "@/lib/messaging/use-notification-logs";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ACJob } from "@/lib/store/types";
import { useSubscription } from "@/lib/subscription/subscription-provider";

const UNIT_TYPES = ["Wall mounted", "Cassette", "Ducted", "Ceiling suspended", "Portable", "Window"];

export default function JobsPage() {
  const { data, ready, addACJob, updateACJob, deleteACJob, recordACService } = useAppStore();
  const { t, locale } = useLocale();
  const { org } = useSubscription();
  const notificationLogs = useNotificationLogs(org.id);
  const notifySettings = loadNotificationSettings();
  const [showForm, setShowForm] = useState(true);
  const [editing, setEditing] = useState<ACJob | null>(null);
  const [filter, setFilter] = useState<ACJobStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ACJobType | "all">("all");
  const [jobType, setJobType] = useState<ACJobType>("installation");
  const [assignedTechnician, setAssignedTechnician] = useState("");
  const [message, setMessage] = useState("");
  const [serviceDoneJob, setServiceDoneJob] = useState<ACJob | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [brand, setBrand] = useState(AC_BRANDS[0]);
  const [btu, setBtu] = useState(18000);
  const [unitType, setUnitType] = useState(UNIT_TYPES[0]);
  const [unitCount, setUnitCount] = useState(1);
  const [description, setDescription] = useState("");
  const [quotedAmount, setQuotedAmount] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [pipeMeters, setPipeMeters] = useState(4);
  const [status, setStatus] = useState<ACJobStatus>("quote");
  const [scheduledDate, setScheduledDate] = useState("");
  const [serviceIntervalDays, setServiceIntervalDays] = useState(180);
  const [serviceDueManual, setServiceDueManual] = useState(false);
  const [serviceDueDate, setServiceDueDate] = useState("");
  const [amcContract, setAmcContract] = useState(false);
  const [notes, setNotes] = useState("");

  if (!ready || !data) {
    return (
      <ProPageShell>
        <SiteHeader />
        <ProMain><ProLoadingState label={t("common.loading")} /></ProMain>
      </ProPageShell>
    );
  }

  const resetForm = () => {
    setCustomerId(""); setCustomerName(""); setPhone(""); setAddress(""); setBrand(AC_BRANDS[0]);
    setBtu(18000); setUnitType(UNIT_TYPES[0]); setUnitCount(1); setDescription("");
    setQuotedAmount(0); setDepositAmount(0); setPipeMeters(4); setStatus("quote"); setScheduledDate("");
    setServiceIntervalDays(180); setServiceDueManual(false); setServiceDueDate(""); setAmcContract(false);
    setJobType("installation"); setAssignedTechnician(""); setNotes(""); setEditing(null);
  };

  const loadJob = (job: ACJob) => {
    setEditing(job); setCustomerId(job.customerId ?? ""); setCustomerName(job.customerName); setPhone(job.phone ?? "");
    setAddress(job.address); setBrand(job.brand ?? AC_BRANDS[0]); setBtu(job.btu ?? 18000);
    setUnitType(job.unitType ?? UNIT_TYPES[0]); setUnitCount(job.unitCount); setDescription(job.description);
    setQuotedAmount(job.quotedAmount); setDepositAmount(job.depositAmount); setPipeMeters(job.pipeMeters ?? 4);
    setStatus(job.status); setScheduledDate(job.scheduledDate ?? ""); setServiceIntervalDays(resolveServiceIntervalDays(job));
    setServiceDueManual(job.serviceDueManual ?? false); setServiceDueDate(job.serviceDueDate ?? "");
    setAmcContract(job.amcContract ?? false); setJobType(job.jobType ?? "installation");
    setAssignedTechnician(job.assignedTechnician ?? ""); setNotes(job.notes ?? ""); setShowForm(true);
  };

  const autoServiceDuePreview = (): string | undefined => {
    const interval = serviceIntervalDays || DEFAULT_SERVICE_INTERVAL_DAYS;
    const today = new Date().toISOString().slice(0, 10);
    const base = jobType === "installation" ? editing?.installedDate ?? (status === "installed" ? today : scheduledDate || today) : scheduledDate || today;
    if (jobType === "installation" && status !== "installed" && !scheduledDate) return undefined;
    return computeServiceDueFromDays(base, interval);
  };

  const buildInput = () => ({
    jobType,
    assignedTechnician: assignedTechnician || undefined,
    serviceDueManual,
    serviceDueDate: serviceDueManual ? serviceDueDate || undefined : autoServiceDuePreview(),
    serviceIntervalDays,
    customerId: customerId || undefined,
    customerName: customerName || "Customer",
    phone,
    address,
    brand,
    btu,
    unitType,
    unitCount,
    description: description || `${brand} ${btu} BTU ${unitType} × ${unitCount}`,
    quotedAmount,
    depositAmount,
    pipeMeters,
    status,
    scheduledDate: scheduledDate || undefined,
    amcContract,
    installedDate: status === "installed" && !editing?.installedDate ? new Date().toISOString().slice(0, 10) : editing?.installedDate,
    notes,
  });

  const jobs = data.acJobs.filter((j) => {
    const type = j.jobType ?? "installation";
    if (typeFilter !== "all" && type !== typeFilter) return false;
    if (filter === "all") return true;
    return j.status === filter;
  });
  const pending = data.acJobs.filter((j) => ["quote", "deposit_received", "scheduled"].includes(j.status));
  const scheduled = data.acJobs.filter((j) => j.status === "scheduled");
  const serviceDue = data.acJobs.filter((j) => canMarkServiceDone(j));
  const quoteTotal = data.acJobs.reduce((sum, j) => sum + j.quotedAmount, 0);

  return (
    <ProPageShell>
      <SiteHeader />
      <ProMain>
        <ProPageHeader
          eyebrow="AC service operations"
          title={t("jobs.title")}
          description={`${t("jobs.subtitle")} — ${pending.length} ${t("jobs.pending")}`}
          actions={<><ProButton href="/customers" variant="secondary">{t("nav.customers")}</ProButton><button onClick={() => { resetForm(); setShowForm((v) => !v); }} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700">{showForm ? t("common.hide_form") : t("jobs.new")}</button></>}
        />
        {message && <div className="mb-5 rounded-[1.25rem] border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900 shadow-sm">{message}</div>}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProStatCard label={t("jobs.pending")} value={String(pending.length)} hint="Quotes, deposits and scheduled" icon="🛠️" tone="amber" />
          <ProStatCard label={t("jobs.schedule")} value={String(scheduled.length)} hint="Scheduled work" icon="📅" tone="blue" />
          <ProStatCard label={t("jobs.service_due_section")} value={String(serviceDue.length)} hint="Ready to mark done" icon="❄️" tone={serviceDue.length ? "amber" : "slate"} />
          <ProStatCard label={t("jobs.quote_label")} value={formatLkr(quoteTotal)} hint="Total quoted value" icon="💸" tone="emerald" />
        </section>
        <section className="mt-6"><AcRemindersBanner /></section>
        {showForm && (
          <section className="mt-6">
            <ProCard eyebrow={editing ? "Edit AC job" : "Create AC job"} title={editing ? `${t("jobs.edit_job")} ${editing.jobNo}` : t("jobs.new_job")} action={<ProBadge tone="teal">{formatLkr(quotedAmount)}</ProBadge>}>
              <form onSubmit={(e) => { e.preventDefault(); if (!address.trim()) { setMessage(t("jobs.address_required")); return; } const input = buildInput(); if (editing) { updateACJob(editing.id, input); setMessage(t("jobs.updated")); } else { addACJob(input); setMessage(t("jobs.created")); resetForm(); setShowForm(false); } setTimeout(() => setMessage(""), 2500); }}>
                <div className="flex flex-wrap gap-2">
                  {AC_JOB_TYPES.map((tpe) => <button key={tpe.value} type="button" onClick={() => { setJobType(tpe.value); if (!editing) setStatus(defaultStatusForJobType(tpe.value)); }} className={`rounded-full px-3 py-2 text-xs font-black ${jobType === tpe.value ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{locale === "si" ? tpe.labelSi : tpe.labelEn}</button>)}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <select value={customerId} onChange={(e) => { setCustomerId(e.target.value); const c = data.customers.find((x) => x.id === e.target.value); if (c) { setCustomerName(c.name); setPhone(c.phone ?? ""); setAddress(c.address ?? ""); } }} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100"><option value="">{t("jobs.customer_opt")}</option>{data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  <input placeholder={t("jobs.customer_name")} value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-teal-300" />
                  <input placeholder={t("common.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-teal-300" />
                  <input required placeholder={t("jobs.site_address")} value={address} onChange={(e) => setAddress(e.target.value)} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-teal-300 sm:col-span-2" />
                  <select value={brand} onChange={(e) => setBrand(e.target.value)} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-teal-300">{AC_BRANDS.map((b) => <option key={b}>{b}</option>)}</select>
                  <select value={btu} onChange={(e) => setBtu(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-teal-300">{AC_BTU_OPTIONS.map((b) => <option key={b} value={b}>{b} BTU</option>)}</select>
                  <select value={unitType} onChange={(e) => setUnitType(e.target.value)} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-teal-300">{UNIT_TYPES.map((item) => <option key={item}>{item}</option>)}</select>
                  <input type="number" min={1} placeholder={t("jobs.units")} value={unitCount} onChange={(e) => setUnitCount(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-teal-300" />
                  <input type="number" placeholder={t("jobs.quote")} value={quotedAmount || ""} onChange={(e) => setQuotedAmount(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-teal-300" />
                  <input placeholder={t("jobs.technician")} value={assignedTechnician} onChange={(e) => setAssignedTechnician(e.target.value)} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-teal-300" />
                  {jobType === "installation" && <><input type="number" placeholder={t("jobs.deposit")} value={depositAmount || ""} onChange={(e) => setDepositAmount(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-teal-300" /><input type="number" placeholder={t("jobs.pipe_est")} value={pipeMeters || ""} onChange={(e) => setPipeMeters(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-teal-300" /></>}
                  <select value={status} onChange={(e) => setStatus(e.target.value as ACJobStatus)} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-teal-300">{AC_JOB_STATUSES.map((s) => <option key={s.value} value={s.value}>{locale === "si" ? s.labelSi : s.labelEn}</option>)}</select>
                  <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-teal-300" />
                  <input placeholder={t("jobs.job_notes")} value={notes} onChange={(e) => setNotes(e.target.value)} className="h-12 rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-teal-300 lg:col-span-2" />
                </div>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{t("jobs.service_interval_days")}</p><div className="mt-3 flex flex-wrap gap-2">{SERVICE_INTERVAL_DAY_PRESETS.map((d) => <button key={d} type="button" onClick={() => setServiceIntervalDays(d)} className={`rounded-full px-3 py-1.5 text-xs font-black ${serviceIntervalDays === d ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{d} {t("jobs.days")}</button>)}<input type="number" min={14} max={730} value={serviceIntervalDays} onChange={(e) => setServiceIntervalDays(Number(e.target.value) || 180)} className="h-9 w-24 rounded-xl border border-slate-200 bg-white px-2 text-sm font-black outline-none" /></div></div>
                  <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{t("jobs.service_due_section")}</p><div className="mt-3 flex flex-wrap gap-3"><label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="radio" checked={!serviceDueManual} onChange={() => { setServiceDueManual(false); setServiceDueDate(""); }} />{t("jobs.service_due_auto")}</label><label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="radio" checked={serviceDueManual} onChange={() => { setServiceDueManual(true); setServiceDueDate(serviceDueDate || autoServiceDuePreview() || ""); }} />{t("jobs.service_due_manual")}</label></div>{serviceDueManual ? <input type="date" value={serviceDueDate} onChange={(e) => setServiceDueDate(e.target.value)} className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none" /> : <p className="mt-3 text-sm font-bold text-teal-800">{autoServiceDuePreview() ? `${t("jobs.service_due_label")}: ${autoServiceDuePreview()}` : t("jobs.service_due_auto_hint")}</p>}</div>
                </div>
                <label className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={amcContract} onChange={(e) => setAmcContract(e.target.checked)} />{t("jobs.amc")}</label>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row"><button type="submit" className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700">{editing ? t("jobs.update_job") : t("jobs.create")}</button>{editing && <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">{t("common.cancel")}</button>}</div>
              </form>
            </ProCard>
          </section>
        )}
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <ProCard title={t("jobs.all_types")} eyebrow="Type filter"><div className="flex flex-wrap gap-2"><button onClick={() => setTypeFilter("all")} className={`rounded-full px-3 py-2 text-xs font-black ${typeFilter === "all" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{t("jobs.all_types")}</button>{AC_JOB_TYPES.map((tpe) => <button key={tpe.value} onClick={() => setTypeFilter(tpe.value)} className={`rounded-full px-3 py-2 text-xs font-black ${typeFilter === tpe.value ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{locale === "si" ? tpe.labelSi : tpe.labelEn}</button>)}</div></ProCard>
          <ProCard title={t("jobs.all")} eyebrow="Status filter" action={<ProBadge tone="teal">{jobs.length} shown</ProBadge>}><div className="flex flex-wrap gap-2"><button onClick={() => setFilter("all")} className={`rounded-full px-3 py-2 text-xs font-black ${filter === "all" ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{t("jobs.all")} ({data.acJobs.length})</button>{AC_JOB_STATUSES.map((s) => <button key={s.value} onClick={() => setFilter(s.value)} className={`rounded-full px-3 py-2 text-xs font-black ${filter === s.value ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{locale === "si" ? s.labelSi : s.labelEn}</button>)}</div></ProCard>
        </section>
        <section className="mt-6">
          {jobs.length === 0 ? <ProCard><ProEmptyState title={t("jobs.no_jobs")} description={t("jobs.no_jobs_hint")} /></ProCard> : <div className="grid gap-4 xl:grid-cols-2">{jobs.map((job) => <JobCard key={job.id} job={job} locale={locale} business={data.business} notificationLogs={notificationLogs} notifySettings={notifySettings} onServiceDone={() => setServiceDoneJob(job)} onEdit={() => loadJob(job)} onSchedule={() => updateACJob(job.id, { status: "scheduled" })} onInstalled={() => updateACJob(job.id, { status: "installed", installedDate: new Date().toISOString().slice(0, 10) })} onComplete={() => updateACJob(job.id, { status: "completed" })} onDelete={() => { if (confirm(`${t("jobs.delete_confirm")} ${job.jobNo}?`)) deleteACJob(job.id); }} />)}</div>}
        </section>
      </ProMain>
      <AcServiceDoneDialog job={serviceDoneJob} business={data.business} open={!!serviceDoneJob} onClose={() => setServiceDoneJob(null)} onConfirm={(input) => { if (serviceDoneJob) { recordACService(serviceDoneJob.id, input); setMessage(t("jobs.service_done_saved")); setTimeout(() => setMessage(""), 2500); } }} />
    </ProPageShell>
  );
}

function JobCard({ job, locale, business, notificationLogs, notifySettings, onServiceDone, onEdit, onSchedule, onInstalled, onComplete, onDelete }: { job: ACJob; locale: Locale; business: BusinessInfo; notificationLogs: ReturnType<typeof useNotificationLogs>; notifySettings: ReturnType<typeof loadNotificationSettings>; onServiceDone: () => void; onEdit: () => void; onSchedule: () => void; onInstalled: () => void; onComplete: () => void; onDelete: () => void }) {
  const { t } = useLocale();
  const balance = job.quotedAmount - job.depositAmount;
  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-white bg-white shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/60">
      <div className="bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs font-black uppercase tracking-wide text-teal-300">{job.jobNo}</p><h2 className="mt-2 truncate text-xl font-black tracking-tight">{job.customerName}</h2><p className="mt-1 text-sm font-semibold text-slate-400">{jobTypeLabel(job.jobType ?? "installation", locale)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black ${jobStatusClass(job.status)}`}>{jobStatusLabel(job.status, locale)}{job.amcContract && " · AMC"}</span></div></div>
      <div className="p-5">
        {job.assignedTechnician && <p className="text-xs font-black text-violet-700">{t("jobs.technician")}: {job.assignedTechnician}</p>}
        <p className="mt-2 text-sm font-semibold text-slate-500">{job.address}</p>
        <p className="mt-2 text-sm font-semibold text-slate-700">{job.description}{job.btu && ` · ${job.btu} BTU`}{job.pipeMeters != null && ` · ${job.pipeMeters}m pipe`}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><Metric label={t("jobs.quote_label")} value={formatLkr(job.quotedAmount)} /><Metric label={t("jobs.deposit_label")} value={formatLkr(job.depositAmount)} /><Metric label={t("jobs.balance_label")} value={formatLkr(balance)} /></div>
        {(job.scheduledDate || job.serviceDueDate) && <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">{job.scheduledDate && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{t("jobs.install_label")}: {job.scheduledDate}</span>}{job.serviceDueDate && <span className={`rounded-full border px-2.5 py-1 ${serviceDueUrgencyClass(serviceDueUrgency(job.serviceDueDate))}`}>{t("jobs.service_due_label")}: {job.serviceDueDate} ({serviceDueLabel(job.serviceDueDate, locale)}){job.serviceDueManual && ` · ${t("jobs.service_due_manual_short")}`}</span>}</div>}
        <div className="mt-4"><AcJobReminderTimeline job={job} logs={notificationLogs} settings={notifySettings} /></div>
        <div className="mt-4 flex flex-wrap gap-2">
          {job.phone && <MessageSendButton phone={job.phone} recipientName={job.customerName} context={{ type: "ac_job", job, business }} defaultTemplate={defaultTemplateForJob(job.status)} contextId={job.id} />}
          {canMarkServiceDone(job) && <ActionButton onClick={onServiceDone}>{t("jobs.service_done")}</ActionButton>}
          <ActionButton onClick={onEdit}>{t("common.edit")}</ActionButton>
          {job.status === "deposit_received" && <ActionButton onClick={onSchedule}>{t("jobs.schedule")}</ActionButton>}
          {job.status === "scheduled" && <ActionButton onClick={onInstalled}>{t("jobs.mark_installed")}</ActionButton>}
          {job.status === "installed" && <ActionButton onClick={onComplete}>{t("jobs.complete")}</ActionButton>}
          <button onClick={onDelete} className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100">{t("common.delete")}</button>
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-mono text-sm font-black text-slate-950">{value}</p></div>;
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-black text-teal-700 hover:bg-teal-100">{children}</button>;
}
