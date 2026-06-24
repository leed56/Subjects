"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { AcJobReminderTimeline } from "@/components/ac-job-reminder-timeline";
import { AcRemindersBanner } from "@/components/ac-reminders-banner";
import { AcInAppAlertSettings } from "@/components/ac-in-app-alert-settings";
import { AcServiceDoneDialog } from "@/components/ac-service-done-dialog";
import { useAcInAppAlerts } from "@/hooks/use-ac-in-app-alerts";
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
import type { ACJob, JobAssigneeType, JobItem, JobItemType, JobItemInput, JobStatusEntry } from "@/lib/store/types";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { canManageAcJobs } from "@/lib/org-role/permissions";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { useWriteAccess } from "@/lib/subscription/use-can-write";

const UNIT_TYPES = ["Wall mounted", "Cassette", "Ducted", "Ceiling suspended", "Portable", "Window"];

export default function JobsPage() {
  const { data, ready, addACJob, updateACJob, deleteACJob, recordACService, addJobItem, deleteJobItem } = useAppStore();
  const { t, locale } = useLocale();
  const { org, orgRole, canSeeFinancials } = useSubscription();
  const canManageJobs = canManageAcJobs(orgRole);
  const { canWrite, disabledHint } = useWriteAccess();
  const notificationLogs = useNotificationLogs(org.id);
  const { markAllSeen } = useAcInAppAlerts();
  const notifySettings = loadNotificationSettings();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ACJob | null>(null);
  const [filter, setFilter] = useState<ACJobStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ACJobType | "all">("all");
  const [jobType, setJobType] = useState<ACJobType>("installation");
  const [assigneeKey, setAssigneeKey] = useState("");
  const [subcontractCost, setSubcontractCost] = useState(0);
  const [message, setMessage] = useState("");
  const [serviceDoneJob, setServiceDoneJob] = useState<ACJob | null>(null);
  const [sheetJob, setSheetJob] = useState<ACJob | null>(null);
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

  useEffect(() => {
    markAllSeen();
  }, [markAllSeen]);

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
    setJobType("installation"); setAssigneeKey(""); setSubcontractCost(0); setNotes(""); setEditing(null);
  };

  const loadJob = (job: ACJob) => {
    setEditing(job); setCustomerId(job.customerId ?? ""); setCustomerName(job.customerName); setPhone(job.phone ?? "");
    setAddress(job.address); setBrand(job.brand ?? AC_BRANDS[0]); setBtu(job.btu ?? 18000);
    setUnitType(job.unitType ?? UNIT_TYPES[0]); setUnitCount(job.unitCount); setDescription(job.description);
    setQuotedAmount(job.quotedAmount); setDepositAmount(job.depositAmount); setPipeMeters(job.pipeMeters ?? 4);
    setStatus(job.status); setScheduledDate(job.scheduledDate ?? ""); setServiceIntervalDays(resolveServiceIntervalDays(job));
    setServiceDueManual(job.serviceDueManual ?? false); setServiceDueDate(job.serviceDueDate ?? "");
    setAmcContract(job.amcContract ?? false); setJobType(job.jobType ?? "installation");
    setAssigneeKey(job.assigneeId ? `${job.assigneeType}:${job.assigneeId}` : "");
    setSubcontractCost(job.subcontractCost ?? 0); setNotes(job.notes ?? ""); setShowForm(true);
  };

  const autoServiceDuePreview = (): string | undefined => {
    const interval = serviceIntervalDays || DEFAULT_SERVICE_INTERVAL_DAYS;
    const today = new Date().toISOString().slice(0, 10);
    const base = jobType === "installation" ? editing?.installedDate ?? (status === "installed" ? today : scheduledDate || today) : scheduledDate || today;
    if (jobType === "installation" && status !== "installed" && !scheduledDate) return undefined;
    return computeServiceDueFromDays(base, interval);
  };

  const buildInput = () => {
    const [aType, aId] = assigneeKey
      ? (assigneeKey.split(":") as [JobAssigneeType, string])
      : [undefined, undefined];
    const assigneeName =
      aType === "team"
        ? data.technicians.find((x) => x.id === aId)?.name
        : aType === "contractor"
          ? data.contractors.find((x) => x.id === aId)?.name
          : undefined;
    return {
    jobType,
    assignedTechnician: assigneeName,
    assigneeType: aType,
    assigneeId: aId,
    subcontractCost: aType === "contractor" ? subcontractCost : undefined,
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
    };
  };

  const handleJobSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      setMessage(t("jobs.address_required"));
      setTimeout(() => setMessage(""), 2500);
      return;
    }
    const input = buildInput();
    const ok = editing ? updateACJob(editing.id, input) : addACJob(input);
    if (!ok) {
      setMessage(t("common.save_failed"));
      setTimeout(() => setMessage(""), 2500);
      return;
    }
    setMessage(editing ? t("jobs.updated") : t("jobs.created"));
    if (!editing) {
      resetForm();
      setShowForm(false);
    }
    setTimeout(() => setMessage(""), 2500);
  };

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
          eyebrow={t("jobs.eyebrow_ops")}
          title={t("jobs.title")}
          description={`${t("jobs.subtitle")} — ${pending.length} ${t("jobs.pending")}`}
          actions={
            <>
              <ProButton href="/customers" variant="secondary">{t("nav.customers")}</ProButton>
              {canManageJobs && (
                <button
                  type="button"
                  disabled={!canWrite}
                  title={!canWrite ? (disabledHint ?? undefined) : undefined}
                  onClick={() => {
                    resetForm();
                    setShowForm((v) => !v);
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {showForm ? t("common.hide_form") : t("jobs.new")}
                </button>
              )}
            </>
          }
        />
        <WriteDisabledHint className="mb-5" />
        {message && <div className="mb-5 rounded-[1.25rem] border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900 shadow-sm">{message}</div>}
        <section className={`grid gap-4 sm:grid-cols-2 ${canSeeFinancials ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
          <ProStatCard label={t("jobs.pending")} value={String(pending.length)} hint={t("jobs.stat_pending_hint")} icon="🛠️" tone="amber" />
          <ProStatCard label={t("jobs.schedule")} value={String(scheduled.length)} hint={t("jobs.stat_scheduled_hint")} icon="📅" tone="blue" />
          <ProStatCard label={t("jobs.service_due_section")} value={String(serviceDue.length)} hint={t("jobs.stat_service_due_hint")} icon="❄️" tone={serviceDue.length ? "amber" : "slate"} />
          {canSeeFinancials && (
            <ProStatCard label={t("jobs.quote_label")} value={formatLkr(quoteTotal)} hint={t("jobs.stat_quote_total_hint")} icon="💸" tone="emerald" />
          )}
        </section>
        {canManageJobs && (
          <section className="mt-6"><AcRemindersBanner /></section>
        )}
        <section className="mt-4"><AcInAppAlertSettings /></section>
        {canManageJobs && showForm && (
          <section className="mt-6">
            <ProCard eyebrow={editing ? t("jobs.eyebrow_edit_job") : t("jobs.eyebrow_create_job")} title={editing ? `${t("jobs.edit_job")} ${editing.jobNo}` : t("jobs.new_job")} action={<ProBadge tone="teal">{formatLkr(quotedAmount)}</ProBadge>}>
              <form onSubmit={handleJobSubmit}>
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
                  <select value={assigneeKey} onChange={(e) => setAssigneeKey(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300">
                    <option value="">{t("jobs.assignee_unassigned")}</option>
                    {data.technicians.filter((x) => x.active).length > 0 && (
                      <optgroup label={t("work.team")}>
                        {data.technicians.filter((x) => x.active).map((x) => <option key={x.id} value={`team:${x.id}`}>{x.name}</option>)}
                      </optgroup>
                    )}
                    {data.contractors.filter((x) => x.active).length > 0 && (
                      <optgroup label={t("work.contractors")}>
                        {data.contractors.filter((x) => x.active).map((x) => <option key={x.id} value={`contractor:${x.id}`}>{x.name}{x.company ? ` (${x.company})` : ""}</option>)}
                      </optgroup>
                    )}
                  </select>
                  {assigneeKey.startsWith("contractor:") && <input type="number" placeholder={t("jobs.subcontract_cost")} value={subcontractCost || ""} onChange={(e) => setSubcontractCost(Number(e.target.value))} className="h-12 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold outline-none focus:border-amber-300" />}
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
                <div className="mt-4 flex flex-col gap-2 sm:flex-row"><button type="submit" disabled={!canWrite} title={!canWrite ? (disabledHint ?? undefined) : undefined} className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">{editing ? t("jobs.update_job") : t("jobs.create")}</button>{editing && <button type="button" onClick={resetForm} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">{t("common.cancel")}</button>}</div>
              </form>
            </ProCard>
          </section>
        )}
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <ProCard title={t("jobs.all_types")} eyebrow={t("jobs.eyebrow_type_filter")}><div className="flex flex-wrap gap-2"><button onClick={() => setTypeFilter("all")} className={`rounded-full px-3 py-2 text-xs font-black ${typeFilter === "all" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{t("jobs.all_types")}</button>{AC_JOB_TYPES.map((tpe) => <button key={tpe.value} onClick={() => setTypeFilter(tpe.value)} className={`rounded-full px-3 py-2 text-xs font-black ${typeFilter === tpe.value ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{locale === "si" ? tpe.labelSi : tpe.labelEn}</button>)}</div></ProCard>
          <ProCard title={t("jobs.all")} eyebrow={t("jobs.eyebrow_status_filter")} action={<ProBadge tone="teal">{t("jobs.filter_shown").replace("{count}", String(jobs.length))}</ProBadge>}><div className="flex flex-wrap gap-2"><button onClick={() => setFilter("all")} className={`rounded-full px-3 py-2 text-xs font-black ${filter === "all" ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{t("jobs.all")} ({data.acJobs.length})</button>{AC_JOB_STATUSES.map((s) => <button key={s.value} onClick={() => setFilter(s.value)} className={`rounded-full px-3 py-2 text-xs font-black ${filter === s.value ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{locale === "si" ? s.labelSi : s.labelEn}</button>)}</div></ProCard>
        </section>
        <section className="mt-6">
          {jobs.length === 0 ? (
            <ProCard>
              <ProEmptyState
                title={t("jobs.no_jobs")}
                description={t("jobs.no_jobs_hint")}
                action={
                  data.acJobs.length === 0 && canWrite && canManageJobs ? (
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setShowForm(true);
                      }}
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-teal-700/20"
                    >
                      {t("jobs.new")}
                    </button>
                  ) : undefined
                }
              />
            </ProCard>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">{jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                assigneePhone={job.assigneeType === "team" ? data.technicians.find((x) => x.id === job.assigneeId)?.phone : job.assigneeType === "contractor" ? data.contractors.find((x) => x.id === job.assigneeId)?.phone : undefined}
                locale={locale}
                business={data.business}
                notificationLogs={notificationLogs}
                notifySettings={notifySettings}
                canManageJobs={canManageJobs}
                canSeeFinancials={canSeeFinancials}
                canWrite={canWrite}
                disabledHint={disabledHint}
                onServiceDone={() => setServiceDoneJob(job)}
                onJobSheet={() => setSheetJob(job)}
                onEdit={() => loadJob(job)}
                onSchedule={() => updateACJob(job.id, { status: "scheduled" })}
                onInstalled={() => updateACJob(job.id, { status: "installed", installedDate: new Date().toISOString().slice(0, 10) })}
                onComplete={() => updateACJob(job.id, { status: "completed" })}
                onDelete={() => { if (confirm(`${t("jobs.delete_confirm")} ${job.jobNo}?`)) deleteACJob(job.id); }}
              />
            ))}</div>
          )}
        </section>
      </ProMain>
      <AcServiceDoneDialog
        job={serviceDoneJob}
        business={data.business}
        open={!!serviceDoneJob}
        onClose={() => setServiceDoneJob(null)}
        onConfirm={(input) => {
          if (!serviceDoneJob) return;
          const ok = recordACService(serviceDoneJob.id, input);
          if (ok) {
            setMessage(t("jobs.service_done_saved"));
          } else {
            setMessage(t("common.save_failed"));
          }
          setTimeout(() => setMessage(""), 2500);
        }}
      />
      {sheetJob && (
        <JobSheetModal
          job={sheetJob}
          locale={locale}
          items={data.jobItems.filter((i) => i.jobId === sheetJob.id)}
          history={data.jobStatusHistory.filter((h) => h.jobId === sheetJob.id)}
          canSeeFinancials={canSeeFinancials}
          canManageJobs={canManageJobs}
          canWrite={canWrite}
          onAddItem={addJobItem}
          onDeleteItem={deleteJobItem}
          onClose={() => setSheetJob(null)}
        />
      )}
    </ProPageShell>
  );
}

function JobCard({ job, assigneePhone, locale, business, notificationLogs, notifySettings, canManageJobs, canSeeFinancials, canWrite, disabledHint, onServiceDone, onJobSheet, onEdit, onSchedule, onInstalled, onComplete, onDelete }: { job: ACJob; assigneePhone?: string; locale: Locale; business: BusinessInfo; notificationLogs: ReturnType<typeof useNotificationLogs>; notifySettings: ReturnType<typeof loadNotificationSettings>; canManageJobs: boolean; canSeeFinancials: boolean; canWrite: boolean; disabledHint: string | null; onServiceDone: () => void; onJobSheet: () => void; onEdit: () => void; onSchedule: () => void; onInstalled: () => void; onComplete: () => void; onDelete: () => void }) {
  const { t } = useLocale();
  const balance = job.quotedAmount - job.depositAmount;
  const isContractor = job.assigneeType === "contractor";
  const margin =
    isContractor && job.subcontractCost != null
      ? job.quotedAmount - job.subcontractCost
      : null;
  const statusActionProps = {
    disabled: !canWrite,
    title: !canWrite ? (disabledHint ?? undefined) : undefined,
  };
  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-white bg-white shadow-lg shadow-slate-950/5 ring-1 ring-slate-200/60">
      <div className="bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs font-black uppercase tracking-wide text-teal-300">{job.jobNo}</p><h2 className="mt-2 truncate text-xl font-black tracking-tight">{job.customerName}</h2><p className="mt-1 text-sm font-semibold text-slate-400">{jobTypeLabel(job.jobType ?? "installation", locale)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black ${jobStatusClass(job.status)}`}>{jobStatusLabel(job.status, locale)}{job.amcContract && " · AMC"}</span></div></div>
      <div className="p-5">
        {job.assignedTechnician && (
          <p className="flex items-center gap-2 text-xs font-black text-violet-700">
            {t("jobs.assignee")}: {job.assignedTechnician}
            {job.assigneeType === "contractor" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{t("work.contractors")}</span>}
            {job.assigneeType === "team" && <span className="rounded-full bg-teal-100 px-2 py-0.5 text-teal-800">{t("work.team")}</span>}
          </p>
        )}
        <p className="mt-2 text-sm font-semibold text-slate-500">{job.address}</p>
        <p className="mt-2 text-sm font-semibold text-slate-700">{job.description}{job.btu && ` · ${job.btu} BTU`}{job.pipeMeters != null && ` · ${job.pipeMeters}m pipe`}</p>
        {canSeeFinancials && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label={t("jobs.quote_label")} value={formatLkr(job.quotedAmount)} />
            <Metric label={t("jobs.deposit_label")} value={formatLkr(job.depositAmount)} />
            <Metric label={t("jobs.balance_label")} value={formatLkr(balance)} />
            {isContractor && job.subcontractCost != null && <Metric label={t("jobs.subcontract_cost")} value={formatLkr(job.subcontractCost)} />}
            {margin != null && <Metric label={t("jobs.margin")} value={formatLkr(margin)} />}
          </div>
        )}
        {(job.scheduledDate || job.serviceDueDate) && <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">{job.scheduledDate && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{t("jobs.install_label")}: {job.scheduledDate}</span>}{job.serviceDueDate && <span className={`rounded-full border px-2.5 py-1 ${serviceDueUrgencyClass(serviceDueUrgency(job.serviceDueDate))}`}>{t("jobs.service_due_label")}: {job.serviceDueDate} ({serviceDueLabel(job.serviceDueDate, locale)}){job.serviceDueManual && ` · ${t("jobs.service_due_manual_short")}`}</span>}</div>}
        <div className="mt-4"><AcJobReminderTimeline job={job} logs={notificationLogs} settings={notifySettings} /></div>
        <div className="mt-4 flex flex-wrap gap-2">
          {job.phone && <MessageSendButton phone={job.phone} recipientName={job.customerName} context={{ type: "ac_job", job, business }} defaultTemplate={defaultTemplateForJob(job.status)} contextId={job.id} />}
          {canManageJobs && assigneePhone && job.assignedTechnician && <MessageSendButton phone={assigneePhone} recipientName={job.assignedTechnician} context={{ type: "ac_job", job, business }} defaultTemplate="job_assignee_dispatch" contextId={job.id} label={t("jobs.notify_assignee")} />}
          {canMarkServiceDone(job) && (
            <ActionButton onClick={onServiceDone} {...statusActionProps}>{t("jobs.service_done")}</ActionButton>
          )}
          <ActionButton onClick={onJobSheet}>{t("jobs.job_sheet")}</ActionButton>
          {canManageJobs && <ActionButton onClick={onEdit} {...statusActionProps}>{t("common.edit")}</ActionButton>}
          {job.status === "deposit_received" && (
            <ActionButton onClick={onSchedule} {...statusActionProps}>{t("jobs.schedule")}</ActionButton>
          )}
          {job.status === "scheduled" && (
            <ActionButton onClick={onInstalled} {...statusActionProps}>{t("jobs.mark_installed")}</ActionButton>
          )}
          {job.status === "installed" && (
            <ActionButton onClick={onComplete} {...statusActionProps}>{t("jobs.complete")}</ActionButton>
          )}
          {canManageJobs && (
            <button
              onClick={onDelete}
              disabled={!canWrite}
              title={!canWrite ? (disabledHint ?? undefined) : undefined}
              className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("common.delete")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-mono text-sm font-black text-slate-950">{value}</p></div>;
}

function ActionButton({ children, onClick, disabled, title }: { children: ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-black text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

const JOB_ITEM_TYPES: JobItemType[] = ["part", "labour", "service"];

function JobSheetModal({ job, locale, items, history, canSeeFinancials, canManageJobs, canWrite, onAddItem, onDeleteItem, onClose }: { job: ACJob; locale: Locale; items: JobItem[]; history: JobStatusEntry[]; canSeeFinancials: boolean; canManageJobs: boolean; canWrite: boolean; onAddItem: (input: JobItemInput) => boolean; onDeleteItem: (id: string) => boolean; onClose: () => void }) {
  const { t } = useLocale();
  const [itemType, setItemType] = useState<JobItemType>("part");
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [itemMessage, setItemMessage] = useState("");

  const itemTypeLabels: Record<JobItemType, string> = {
    part: t("jobs.item.part"),
    labour: t("jobs.item.labour"),
    service: t("jobs.item.service"),
  };

  const itemsTotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const subcontract = job.assigneeType === "contractor" ? job.subcontractCost ?? 0 : 0;
  const profit = job.quotedAmount - itemsTotal - subcontract;
  const sortedHistory = [...history].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-2xl shadow-slate-950/20">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <p className="font-mono text-xs font-black uppercase tracking-wider text-teal-600">{job.jobNo} · {t("jobs.job_sheet")}</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">{job.customerName}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">{jobTypeLabel(job.jobType ?? "installation", locale)} · {job.address}</p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {canSeeFinancials && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label={t("jobs.quote_label")} value={formatLkr(job.quotedAmount)} />
              <Metric label={t("jobs.parts_labour")} value={formatLkr(itemsTotal)} />
              {subcontract > 0 && <Metric label={t("jobs.subcontract_cost")} value={formatLkr(subcontract)} />}
              <Metric label={t("jobs.net_profit")} value={formatLkr(profit)} />
            </div>
          )}

          {canSeeFinancials && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">{t("jobs.item_name")}</th>
                  <th className="px-3 py-2.5">{t("bank.type")}</th>
                  <th className="px-3 py-2.5 text-right">{t("jobs.qty")}</th>
                  <th className="px-3 py-2.5 text-right">{t("jobs.unit_price")}</th>
                  <th className="px-3 py-2.5 text-right">{t("jobs.line_total")}</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-sm font-semibold text-slate-400">{t("jobs.no_items")}</td></tr>
                ) : items.map((i) => (
                  <tr key={i.id} className="border-b last:border-0">
                    <td className="px-3 py-2.5 font-black text-slate-900">{i.name}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-600">{itemTypeLabels[i.itemType]}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{i.qty}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{formatLkr(i.unitPrice)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-black">{formatLkr(i.lineTotal)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {canManageJobs && (
                        <button onClick={() => { if (!onDeleteItem(i.id)) setItemMessage(t("common.save_failed")); }} className="rounded-full bg-rose-50 px-2 py-1 text-xs font-black text-rose-700 hover:bg-rose-100">✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {!canSeeFinancials && items.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5">{t("jobs.item_name")}</th>
                    <th className="px-3 py-2.5">{t("bank.type")}</th>
                    <th className="px-3 py-2.5 text-right">{t("jobs.qty")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-b last:border-0">
                      <td className="px-3 py-2.5 font-black text-slate-900">{i.name}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-600">{itemTypeLabels[i.itemType]}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{i.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canManageJobs && canSeeFinancials && (
          <form
            className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !canWrite) return;
              const ok = onAddItem({ jobId: job.id, itemType, name, qty, unitPrice });
              if (!ok) {
                setItemMessage(t("common.save_failed"));
                return;
              }
              setItemMessage("");
              setName("");
              setQty(1);
              setUnitPrice(0);
            }}
          >
            {itemMessage && <p className="col-span-full text-sm font-semibold text-amber-700">{itemMessage}</p>}
            <input placeholder={t("jobs.item_name")} value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-teal-300" />
            <select value={itemType} onChange={(e) => setItemType(e.target.value as JobItemType)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-teal-300">
              {JOB_ITEM_TYPES.map((ty) => <option key={ty} value={ty}>{itemTypeLabels[ty]}</option>)}
            </select>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="h-11 w-20 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-teal-300" />
            <input type="number" min={0} placeholder={t("jobs.unit_price")} value={unitPrice || ""} onChange={(e) => setUnitPrice(Number(e.target.value))} className="h-11 w-28 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-teal-300" />
            <button type="submit" disabled={!canWrite} className="h-11 rounded-xl bg-teal-600 px-4 text-sm font-black text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">{t("jobs.add_item")}</button>
          </form>
          )}

          <div className={canSeeFinancials ? "mt-6" : "mt-0"}>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">{t("jobs.status_history")}</p>
            <ol className="mt-3 space-y-2">
              {sortedHistory.map((h) => (
                <li key={h.id} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-mono text-xs font-semibold text-slate-500">{h.date.slice(0, 10)}</span>
                  <span className="font-black text-slate-900">{h.oldStatus ? `${jobStatusLabel(h.oldStatus as ACJobStatus, locale)} → ` : ""}{jobStatusLabel(h.newStatus as ACJobStatus, locale)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
