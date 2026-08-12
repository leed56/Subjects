"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { AcJobReminderTimeline } from "@/components/ac-job-reminder-timeline";
import { AcRemindersBanner } from "@/components/ac-reminders-banner";
import { AcInAppAlertSettings } from "@/components/ac-in-app-alert-settings";
import { AcServiceDoneDialog } from "@/components/ac-service-done-dialog";
import { useAcInAppAlerts } from "@/hooks/use-ac-in-app-alerts";
import { MessageSendButton } from "@/components/messaging/message-send-button";
import { CallLink, NavigateLink } from "@/components/ui/field-links";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProLoadingState } from "@/components/ui/pro-shell";
import { PageHeader, MetricCard, EmptyState, SearchInput, FilterBar } from "@/components/ui/primitives";
import { Drawer, ConfirmDialog } from "@/components/ui/overlay";
import { FormField, TextInput, SelectInput, MoneyInput, DateInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { AssetIcon, PlusIcon } from "@/components/ui/icons";
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
import type { ACJob, ACJobInput, JobAssigneeType, JobItem, JobItemType, JobItemSource, JobItemInput, JobStatusEntry, Supplier, Technician } from "@/lib/store/types";
import type { Product } from "@/lib/types";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { canManageAcJobs, canOperateAcJobs } from "@/lib/org-role/permissions";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import { fetchAsset, fetchCustomerAssets, fetchJobAssetId, linkJobAsset, type AcAsset } from "@/lib/supabase/ac-assets-client";

const UNIT_TYPES = ["Wall mounted", "Cassette", "Ducted", "Ceiling suspended", "Portable", "Window"];

export default function JobsPage() {
  const { data, ready, saveACJobToCloud, updateACJobToCloud, deleteACJobToCloud, recordACServiceToCloud, addJobItemToCloud, deleteJobItemToCloud } = useAppStore();
  const { t, locale } = useLocale();
  const { org, orgRole, canSeeFinancials } = useSubscription();
  const canManageJobs = canManageAcJobs(orgRole);
  const canOperateJobs = canOperateAcJobs(orgRole);
  const { canWrite, disabledHint } = useWriteAccess();
  const notificationLogs = useNotificationLogs(org.id);
  const { markAllSeen } = useAcInAppAlerts();
  const notifySettings = loadNotificationSettings();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ACJob | null>(null);
  const [filter, setFilter] = useState<ACJobStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ACJobType | "all">("all");
  const [search, setSearch] = useState("");
  const [jobType, setJobType] = useState<ACJobType>("installation");
  const [assigneeKey, setAssigneeKey] = useState("");
  const [subcontractCost, setSubcontractCost] = useState("");
  const [savingJob, setSavingJob] = useState(false);
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ACJob | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
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
  const [quotedAmount, setQuotedAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
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
      <AppShell>
        <ProMain><ProLoadingState label={t("common.loading")} /></ProMain>
      </AppShell>
    );
  }

  const resetForm = () => {
    setCustomerId(""); setCustomerName(""); setPhone(""); setAddress(""); setBrand(AC_BRANDS[0]);
    setBtu(18000); setUnitType(UNIT_TYPES[0]); setUnitCount(1); setDescription("");
    setQuotedAmount(""); setDepositAmount(""); setPipeMeters(4); setStatus("quote"); setScheduledDate("");
    setServiceIntervalDays(180); setServiceDueManual(false); setServiceDueDate(""); setAmcContract(false);
    setJobType("installation"); setAssigneeKey(""); setSubcontractCost(""); setNotes(""); setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const loadJob = (job: ACJob) => {
    setEditing(job); setCustomerId(job.customerId ?? ""); setCustomerName(job.customerName); setPhone(job.phone ?? "");
    setAddress(job.address); setBrand(job.brand ?? AC_BRANDS[0]); setBtu(job.btu ?? 18000);
    setUnitType(job.unitType ?? UNIT_TYPES[0]); setUnitCount(job.unitCount); setDescription(job.description);
    setQuotedAmount(String(job.quotedAmount || "")); setDepositAmount(String(job.depositAmount || "")); setPipeMeters(job.pipeMeters ?? 4);
    setStatus(job.status); setScheduledDate(job.scheduledDate ?? ""); setServiceIntervalDays(resolveServiceIntervalDays(job));
    setServiceDueManual(job.serviceDueManual ?? false); setServiceDueDate(job.serviceDueDate ?? "");
    setAmcContract(job.amcContract ?? false); setJobType(job.jobType ?? "installation");
    setAssigneeKey(job.assigneeId ? `${job.assigneeType}:${job.assigneeId}` : "");
    setSubcontractCost(String(job.subcontractCost ?? "")); setNotes(job.notes ?? ""); setFormOpen(true);
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
      subcontractCost: canManageJobs && aType === "contractor" ? Number(subcontractCost) || 0 : undefined,
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
      quotedAmount: Number(quotedAmount) || 0,
      depositAmount: Number(depositAmount) || 0,
      pipeMeters,
      status,
      scheduledDate: scheduledDate || undefined,
      amcContract,
      installedDate: status === "installed" && !editing?.installedDate ? new Date().toISOString().slice(0, 10) : editing?.installedDate,
      notes,
    };
  };

  const handleJobSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!address.trim() || savingJob) return;
    const input = buildInput();
    setSavingJob(true);
    const result = await saveACJobToCloud(input, editing?.id);
    setSavingJob(false);
    if (!result.ok) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    toast({ tone: "success", title: editing ? t("jobs.updated") : t("jobs.created") });
    setFormOpen(false);
    resetForm();
  };

  const handleJobStatusUpdate = async (jobId: string, input: Partial<ACJobInput>) => {
    if (updatingJobId) return;
    setUpdatingJobId(jobId);
    const result = await updateACJobToCloud(jobId, input);
    setUpdatingJobId(null);
    if (!result.ok) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
    }
  };

  const confirmDeleteJob = async () => {
    if (!deleteTarget || deletingJobId) return;
    setDeletingJobId(deleteTarget.id);
    const result = await deleteACJobToCloud(deleteTarget.id);
    setDeletingJobId(null);
    if (!result.ok) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    if (editing?.id === deleteTarget.id) { resetForm(); setFormOpen(false); }
    if (serviceDoneJob?.id === deleteTarget.id) setServiceDoneJob(null);
    if (sheetJob?.id === deleteTarget.id) setSheetJob(null);
    toast({ tone: "success", title: t("common.delete"), description: deleteTarget.jobNo });
    setDeleteTarget(null);
  };

  const query = search.trim().toLowerCase();
  const jobs = data.acJobs.filter((j) => {
    const type = j.jobType ?? "installation";
    if (typeFilter !== "all" && type !== typeFilter) return false;
    if (filter !== "all" && j.status !== filter) return false;
    if (!query) return true;
    return (
      j.jobNo.toLowerCase().includes(query) ||
      j.customerName.toLowerCase().includes(query) ||
      j.address.toLowerCase().includes(query)
    );
  });
  const pending = data.acJobs.filter((j) => ["quote", "deposit_received", "scheduled"].includes(j.status));
  const scheduled = data.acJobs.filter((j) => j.status === "scheduled");
  const serviceDue = data.acJobs.filter((j) => canMarkServiceDone(j));
  const quoteTotal = data.acJobs.reduce((sum, j) => sum + j.quotedAmount, 0);

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={t("jobs.title")}
          description={`${t("jobs.subtitle")} — ${pending.length} ${t("jobs.pending")}`}
          actions={
            canOperateJobs ? (
              <button
                type="button"
                disabled={!canWrite}
                title={!canWrite ? disabledHint ?? undefined : undefined}
                onClick={openCreate}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlusIcon className="h-4 w-4" />
                {t("jobs.new")}
              </button>
            ) : undefined
          }
          metrics={
            <div className={`grid gap-3 sm:grid-cols-2 ${canOperateJobs ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
              <MetricCard label={t("jobs.pending")} value={String(pending.length)} hint={t("jobs.stat_pending_hint")} tone={pending.length ? "warning" : "default"} />
              <MetricCard label={t("jobs.schedule")} value={String(scheduled.length)} hint={t("jobs.stat_scheduled_hint")} />
              <MetricCard label={t("jobs.service_due_section")} value={String(serviceDue.length)} hint={t("jobs.stat_service_due_hint")} tone={serviceDue.length ? "warning" : "default"} />
              {canOperateJobs && <MetricCard label={t("jobs.quote_label")} value={formatLkr(quoteTotal)} hint={t("jobs.stat_quote_total_hint")} tone="positive" />}
            </div>
          }
        />
        <WriteDisabledHint className="mb-4" />

        {canOperateJobs && <div className="mb-4"><AcRemindersBanner /></div>}
        <div className="mb-4"><AcInAppAlertSettings /></div>

        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder={t("cust.search_placeholder")} className="min-w-[200px] flex-1" />
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setTypeFilter("all")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${typeFilter === "all" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{t("jobs.all_types")}</button>
            {AC_JOB_TYPES.map((tpe) => (
              <button key={tpe.value} onClick={() => setTypeFilter(tpe.value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${typeFilter === tpe.value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
                {locale === "si" ? tpe.labelSi : tpe.labelEn}
              </button>
            ))}
          </div>
        </FilterBar>
        <FilterBar>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFilter("all")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === "all" ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{t("jobs.all")} ({data.acJobs.length})</button>
            {AC_JOB_STATUSES.map((s) => (
              <button key={s.value} onClick={() => setFilter(s.value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === s.value ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
                {locale === "si" ? s.labelSi : s.labelEn}
              </button>
            ))}
          </div>
        </FilterBar>

        {jobs.length === 0 ? (
          <EmptyState
            title={t("jobs.no_jobs")}
            description={t("jobs.no_jobs_hint")}
            action={
              data.acJobs.length === 0 && canWrite && canOperateJobs ? (
                <button type="button" onClick={openCreate} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">{t("jobs.new")}</button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                assigneePhone={job.assigneeType === "team" ? data.technicians.find((x) => x.id === job.assigneeId)?.phone : job.assigneeType === "contractor" ? data.contractors.find((x) => x.id === job.assigneeId)?.phone : undefined}
                locale={locale}
                business={data.business}
                notificationLogs={notificationLogs}
                notifySettings={notifySettings}
                canManageJobs={canManageJobs}
                canOperateJobs={canOperateJobs}
                canSeeFinancials={canSeeFinancials}
                canWrite={canWrite}
                disabledHint={disabledHint}
                onServiceDone={() => setServiceDoneJob(job)}
                onJobSheet={() => setSheetJob(job)}
                onEdit={() => loadJob(job)}
                onSchedule={() => void handleJobStatusUpdate(job.id, { status: "scheduled" })}
                onInstalled={() => void handleJobStatusUpdate(job.id, { status: "installed", installedDate: new Date().toISOString().slice(0, 10) })}
                onComplete={() => void handleJobStatusUpdate(job.id, { status: "completed" })}
                onDelete={() => setDeleteTarget(job)}
                deleting={deletingJobId === job.id}
              />
            ))}
          </div>
        )}
      </ProMain>

      {/* Create / edit drawer — always opens immediately. */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `${t("jobs.edit_job")} ${editing.jobNo}` : t("jobs.new_job")}
        widthClassName="max-w-2xl"
        footer={
          <div className="flex items-center gap-2">
            {editing && (
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("common.cancel")}
              </button>
            )}
            <button
              type="submit"
              form="job-form"
              disabled={!canWrite || savingJob}
              className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingJob ? t("common.saving") : editing ? t("jobs.update_job") : t("jobs.create")}
            </button>
          </div>
        }
      >
        <form id="job-form" onSubmit={handleJobSubmit} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {AC_JOB_TYPES.map((tpe) => (
              <button key={tpe.value} type="button" onClick={() => { setJobType(tpe.value); if (!editing) setStatus(defaultStatusForJobType(tpe.value)); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${jobType === tpe.value ? "bg-teal-600 text-white" : "border border-slate-300 bg-white text-slate-600"}`}>
                {locale === "si" ? tpe.labelSi : tpe.labelEn}
              </button>
            ))}
          </div>

          <FormField label={t("jobs.customer_opt")}>
            <SelectInput
              value={customerId}
              onChange={(v) => {
                setCustomerId(v);
                const c = data.customers.find((x) => x.id === v);
                if (c) { setCustomerName(c.name); setPhone(c.phone ?? ""); setAddress(c.address ?? ""); }
              }}
              options={[{ value: "", label: t("jobs.customer_opt") }, ...data.customers.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("jobs.customer_name")}>
              <TextInput value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </FormField>
            <FormField label={t("common.phone")}>
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
            </FormField>
          </div>
          <FormField label={t("jobs.site_address")} required>
            <TextInput required value={address} onChange={(e) => setAddress(e.target.value)} />
          </FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Brand">
              <SelectInput value={brand} onChange={setBrand} options={AC_BRANDS.map((b) => ({ value: b, label: b }))} />
            </FormField>
            <FormField label="BTU">
              <SelectInput value={String(btu)} onChange={(v) => setBtu(Number(v))} options={AC_BTU_OPTIONS.map((b) => ({ value: String(b), label: `${b} BTU` }))} />
            </FormField>
            <FormField label={t("jobs.units")}>
              <TextInput type="number" min={1} value={String(unitCount)} onChange={(e) => setUnitCount(Number(e.target.value))} />
            </FormField>
          </div>
          <FormField label="Unit type">
            <SelectInput value={unitType} onChange={setUnitType} options={UNIT_TYPES.map((u) => ({ value: u, label: u }))} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("jobs.quote")}>
              <MoneyInput value={quotedAmount} onChange={setQuotedAmount} />
            </FormField>
            {jobType === "installation" && (
              <FormField label={t("jobs.deposit")}>
                <MoneyInput value={depositAmount} onChange={setDepositAmount} />
              </FormField>
            )}
          </div>
          {jobType === "installation" && (
            <FormField label={t("jobs.pipe_est")}>
              <TextInput type="number" value={String(pipeMeters)} onChange={(e) => setPipeMeters(Number(e.target.value))} />
            </FormField>
          )}
          <FormField label={t("jobs.assignee")}>
            <SelectInput
              value={assigneeKey}
              onChange={setAssigneeKey}
              options={[
                { value: "", label: t("jobs.assignee_unassigned") },
                ...data.technicians.filter((x) => x.active).map((x) => ({ value: `team:${x.id}`, label: `${x.name} (${t("work.team")})` })),
                ...data.contractors.filter((x) => x.active).map((x) => ({ value: `contractor:${x.id}`, label: `${x.name}${x.company ? ` (${x.company})` : ""} (${t("work.contractors")})` })),
              ]}
            />
          </FormField>
          {canManageJobs && assigneeKey.startsWith("contractor:") && (
            <FormField label={t("jobs.subcontract_cost")}>
              <MoneyInput value={subcontractCost} onChange={setSubcontractCost} />
            </FormField>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("common.status")}>
              <SelectInput value={status} onChange={(v) => setStatus(v as ACJobStatus)} options={AC_JOB_STATUSES.map((s) => ({ value: s.value, label: locale === "si" ? s.labelSi : s.labelEn }))} />
            </FormField>
            <FormField label={t("jobs.install_label")}>
              <DateInput value={scheduledDate} onChange={setScheduledDate} />
            </FormField>
          </div>
          <FormField label={t("jobs.job_notes")}>
            <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">{t("jobs.service_interval_days")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SERVICE_INTERVAL_DAY_PRESETS.map((d) => (
                <button key={d} type="button" onClick={() => setServiceIntervalDays(d)} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${serviceIntervalDays === d ? "bg-teal-600 text-white" : "border border-slate-300 bg-white text-slate-600"}`}>
                  {d} {t("jobs.days")}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-slate-500">{t("jobs.service_due_section")}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-1.5 font-medium text-slate-700">
                <input type="radio" checked={!serviceDueManual} onChange={() => { setServiceDueManual(false); setServiceDueDate(""); }} />
                {t("jobs.service_due_auto")}
              </label>
              <label className="flex items-center gap-1.5 font-medium text-slate-700">
                <input type="radio" checked={serviceDueManual} onChange={() => { setServiceDueManual(true); setServiceDueDate(serviceDueDate || autoServiceDuePreview() || ""); }} />
                {t("jobs.service_due_manual")}
              </label>
            </div>
            {serviceDueManual ? (
              <DateInput value={serviceDueDate} onChange={setServiceDueDate} className="mt-2" />
            ) : (
              <p className="mt-2 text-sm font-medium text-teal-800">{autoServiceDuePreview() ? `${t("jobs.service_due_label")}: ${autoServiceDuePreview()}` : t("jobs.service_due_auto_hint")}</p>
            )}
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={amcContract} onChange={(e) => setAmcContract(e.target.checked)} />
            {t("jobs.amc")}
          </label>
        </form>
      </Drawer>

      <AcServiceDoneDialog
        job={serviceDoneJob}
        business={data.business}
        open={!!serviceDoneJob}
        onClose={() => setServiceDoneJob(null)}
        onConfirm={async (input) => {
          if (!serviceDoneJob) return { ok: false, error: t("common.save_failed") };
          const result = await recordACServiceToCloud(serviceDoneJob.id, input);
          if (result.ok) toast({ tone: "success", title: t("jobs.service_done_saved") });
          return result;
        }}
      />

      {sheetJob && (
        <JobSheetDrawer
          job={sheetJob}
          locale={locale}
          items={data.jobItems.filter((i) => i.jobId === sheetJob.id)}
          history={data.jobStatusHistory.filter((h) => h.jobId === sheetJob.id)}
          products={data.products}
          suppliers={data.suppliers}
          technicians={data.technicians}
          canSeeFinancials={canSeeFinancials}
          canOperateJobs={canOperateJobs}
          canWrite={canWrite}
          onAddItem={addJobItemToCloud}
          onDeleteItem={deleteJobItemToCloud}
          onClose={() => setSheetJob(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("jobs.delete_confirm")}
        description={deleteTarget?.jobNo}
        tone="danger"
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        loading={!!deletingJobId}
        onConfirm={() => void confirmDeleteJob()}
        onClose={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}

function JobCard({ job, assigneePhone, locale, business, notificationLogs, notifySettings, canManageJobs, canOperateJobs, canSeeFinancials, canWrite, disabledHint, onServiceDone, onJobSheet, onEdit, onSchedule, onInstalled, onComplete, onDelete, deleting }: { job: ACJob; assigneePhone?: string; locale: Locale; business: BusinessInfo; notificationLogs: ReturnType<typeof useNotificationLogs>; notifySettings: ReturnType<typeof loadNotificationSettings>; canManageJobs: boolean; canOperateJobs: boolean; canSeeFinancials: boolean; canWrite: boolean; disabledHint: string | null; onServiceDone: () => void; onJobSheet: () => void; onEdit: () => void; onSchedule: () => void; onInstalled: () => void; onComplete: () => void; onDelete: () => void; deleting?: boolean }) {
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
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="bg-slate-900 p-4 text-white"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs font-semibold uppercase tracking-wide text-teal-300">{job.jobNo}</p><h2 className="mt-1.5 truncate text-lg font-bold tracking-tight">{job.customerName}</h2><p className="mt-0.5 text-sm text-slate-400">{jobTypeLabel(job.jobType ?? "installation", locale)}</p></div><span className={`rounded-md px-2 py-1 text-xs font-semibold ${jobStatusClass(job.status)}`}>{jobStatusLabel(job.status, locale)}{job.amcContract && " · AMC"}</span></div></div>
      <div className="p-4">
        {job.assignedTechnician && (
          <p className="flex items-center gap-2 text-xs font-semibold text-violet-700">
            {t("jobs.assignee")}: {job.assignedTechnician}
            {job.assigneeType === "contractor" && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-amber-800">{t("work.contractors")}</span>}
            {job.assigneeType === "team" && <span className="rounded-md bg-teal-100 px-1.5 py-0.5 text-teal-800">{t("work.team")}</span>}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-slate-500">{job.address}</p>
          <NavigateLink address={job.address} label={t("common.navigate")} variant="icon" />
        </div>
        <p className="mt-2 text-sm text-slate-700">{job.description}{job.btu && ` · ${job.btu} BTU`}{job.pipeMeters != null && ` · ${job.pipeMeters}m pipe`}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric label={t("jobs.quote_label")} value={formatLkr(job.quotedAmount)} />
          <Metric label={t("jobs.deposit_label")} value={formatLkr(job.depositAmount)} />
          <Metric label={t("jobs.balance_label")} value={formatLkr(balance)} />
          {canSeeFinancials && isContractor && job.subcontractCost != null && (
            <Metric label={t("jobs.subcontract_cost")} value={formatLkr(job.subcontractCost)} />
          )}
          {canSeeFinancials && margin != null && (
            <Metric label={t("jobs.margin")} value={formatLkr(margin)} />
          )}
        </div>
        {(job.scheduledDate || job.serviceDueDate) && <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">{job.scheduledDate && <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">{t("jobs.install_label")}: {job.scheduledDate}</span>}{job.serviceDueDate && <span className={`rounded-md border px-2 py-1 ${serviceDueUrgencyClass(serviceDueUrgency(job.serviceDueDate))}`}>{t("jobs.service_due_label")}: {job.serviceDueDate} ({serviceDueLabel(job.serviceDueDate, locale)}){job.serviceDueManual && ` · ${t("jobs.service_due_manual_short")}`}</span>}</div>}
        <div className="mt-3"><AcJobReminderTimeline job={job} logs={notificationLogs} settings={notifySettings} /></div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.phone && <CallLink phone={job.phone} label={t("common.call")} />}
          {job.phone && <MessageSendButton phone={job.phone} recipientName={job.customerName} context={{ type: "ac_job", job, business }} defaultTemplate={defaultTemplateForJob(job.status)} contextId={job.id} />}
          {canOperateJobs && assigneePhone && job.assignedTechnician && <MessageSendButton phone={assigneePhone} recipientName={job.assignedTechnician} context={{ type: "ac_job", job, business }} defaultTemplate="job_assignee_dispatch" contextId={job.id} label={t("jobs.notify_assignee")} />}
          {canMarkServiceDone(job) && (
            <ActionButton onClick={onServiceDone} {...statusActionProps}>{t("jobs.service_done")}</ActionButton>
          )}
          <ActionButton onClick={onJobSheet}>{t("jobs.job_sheet")}</ActionButton>
          {canOperateJobs && <ActionButton onClick={onEdit} {...statusActionProps}>{t("common.edit")}</ActionButton>}
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
              disabled={!canWrite || deleting}
              title={!canWrite ? (disabledHint ?? undefined) : undefined}
              className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? t("common.saving") : t("common.delete")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">{value}</p></div>;
}

function ActionButton({ children, onClick, disabled, title }: { children: ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

const JOB_ITEM_TYPES: JobItemType[] = ["part", "labour", "service"];

/** Job detail as a work order: financials, parts/labour, equipment, status history —
 * now a Drawer instead of a fixed-overlay dialog. Equipment section (Phase 5) is new:
 * a direct-cloud read/write against ac_jobs.asset_id, bypassing the local-first ACJob
 * type which doesn't carry that column yet — see ac-assets-client.ts. */
function JobSheetDrawer({ job, locale, items, history, products, suppliers, technicians, canSeeFinancials, canOperateJobs, canWrite, onAddItem, onDeleteItem, onClose }: { job: ACJob; locale: Locale; items: JobItem[]; history: JobStatusEntry[]; products: Product[]; suppliers: Supplier[]; technicians: Technician[]; canSeeFinancials: boolean; canOperateJobs: boolean; canWrite: boolean; onAddItem: (input: JobItemInput) => Promise<{ ok: boolean; error?: string }>; onDeleteItem: (id: string) => Promise<{ ok: boolean; error?: string }>; onClose: () => void }) {
  const { t } = useLocale();
  const { toast } = useToast();
  const [itemType, setItemType] = useState<JobItemType>("part");
  // Material source (HVAC platform Phase 4) — only meaningful when
  // itemType === "part"; labour/service keep the original free-text flow.
  const [source, setSource] = useState<JobItemSource>("stock");
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");
  const [productId, setProductId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [purchaseRef, setPurchaseRef] = useState("");
  const [customerPrice, setCustomerPrice] = useState("");
  // itemType === "labour" only (HVAC platform Phase 6).
  const [technicianId, setTechnicianId] = useState("");
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const inStockProducts = products.filter((p) => p.stockQty > 0);
  const selectedProduct = productId ? products.find((p) => p.id === productId) : undefined;
  const activeTechnicians = technicians.filter((tc) => tc.active);

  const resetItemForm = () => {
    setName("");
    setQty(1);
    setUnitPrice("");
    setProductId("");
    setSupplierId("");
    setPurchaseRef("");
    setTechnicianId("");
    setCustomerPrice("");
  };

  const [asset, setAsset] = useState<AcAsset | null | undefined>(undefined);
  const [customerAssets, setCustomerAssets] = useState<AcAsset[] | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAsset(undefined);
    void fetchJobAssetId(job.id).then(async (result) => {
      if (cancelled) return;
      if (!result.data) { setAsset(null); return; }
      const assetResult = await fetchAsset(result.data);
      if (!cancelled) setAsset(assetResult.data);
    });
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  const loadCustomerAssets = () => {
    if (!job.customerId) return;
    void fetchCustomerAssets(job.customerId).then((result) => setCustomerAssets(result.data));
  };

  const handleLinkAsset = async (assetId: string | null) => {
    if (linking) return;
    setLinking(true);
    const result = await linkJobAsset(job.id, assetId);
    setLinking(false);
    if (result.error) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    if (!assetId) { setAsset(null); setCustomerAssets(null); return; }
    const assetResult = await fetchAsset(assetId);
    setAsset(assetResult.data);
    setCustomerAssets(null);
  };

  const itemTypeLabels: Record<JobItemType, string> = {
    part: t("jobs.item.part"),
    labour: t("jobs.item.labour"),
    service: t("jobs.item.service"),
  };

  const sourceLabels: Record<JobItemSource, string> = {
    stock: t("jobs.source.stock"),
    purchased: t("jobs.source.purchased"),
    customer_supplied: t("jobs.source.customer_supplied"),
  };

  const itemsTotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const subcontract = job.assigneeType === "contractor" ? job.subcontractCost ?? 0 : 0;
  const profit = job.quotedAmount - itemsTotal - subcontract;
  const sortedHistory = [...history].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <Drawer
      open
      onClose={onClose}
      title={job.customerName}
      description={`${job.jobNo} · ${jobTypeLabel(job.jobType ?? "installation", locale)} · ${job.address}`}
      widthClassName="max-w-2xl"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/jobs/${job.id}/invoice`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t("jinv.view_invoice")}
        </Link>
        {job.phone && <CallLink phone={job.phone} label={t("common.call")} />}
        <NavigateLink address={job.address} label={t("common.navigate")} />
      </div>

      {canSeeFinancials && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label={t("jobs.quote_label")} value={formatLkr(job.quotedAmount)} />
          <Metric label={t("jobs.parts_labour")} value={formatLkr(itemsTotal)} />
          {subcontract > 0 && <Metric label={t("jobs.subcontract_cost")} value={formatLkr(subcontract)} />}
          <Metric label={t("jobs.net_profit")} value={formatLkr(profit)} />
        </div>
      )}

      {/* Equipment (Phase 4/5) */}
      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("assets.title")}</p>
        {asset === undefined ? (
          <ProLoadingState label={t("common.loading")} />
        ) : asset ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-2">
              <AssetIcon className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{[asset.brand, asset.model].filter(Boolean).join(" ") || t("assets.untitled")}</p>
                <p className="text-xs text-slate-500">{asset.serialNo ?? "—"}</p>
              </div>
            </div>
            {canOperateJobs && (
              <button type="button" onClick={() => void handleLinkAsset(null)} disabled={linking} className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50">
                {t("common.cancel")}
              </button>
            )}
          </div>
        ) : (
          <div>
            {customerAssets === null ? (
              canOperateJobs && job.customerId ? (
                <button type="button" onClick={loadCustomerAssets} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {t("assets.add")}
                </button>
              ) : (
                <p className="text-sm text-slate-400">{t("assets.no_assets")}</p>
              )
            ) : customerAssets.length === 0 ? (
              <p className="text-sm text-slate-400">{t("assets.no_assets")}</p>
            ) : (
              <div className="space-y-1.5">
                {customerAssets.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    disabled={linking}
                    onClick={() => void handleLinkAsset(a.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-teal-300 hover:bg-teal-50 disabled:opacity-50"
                  >
                    <span className="font-medium text-slate-900">{[a.brand, a.model].filter(Boolean).join(" ") || t("assets.untitled")}</span>
                    <span className="text-xs text-slate-500">{a.serialNo ?? "—"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {canSeeFinancials && (
        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">{t("jobs.item_name")}</th>
                <th className="px-3 py-2">{t("bank.type")}</th>
                <th className="px-3 py-2 text-right">{t("jobs.qty")}</th>
                <th className="px-3 py-2 text-right">{t("jobs.unit_price")}</th>
                <th className="px-3 py-2 text-right">{t("jobs.line_total")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-sm text-slate-400">{t("jobs.no_items")}</td></tr>
              ) : items.map((i) => (
                <tr key={i.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {i.name}
                    {i.source && <p className="mt-0.5 text-xs font-normal text-slate-400">{sourceLabels[i.source]}</p>}
                    {i.technicianId && (
                      <p className="mt-0.5 text-xs font-normal text-slate-400">
                        {technicians.find((tc) => tc.id === i.technicianId)?.name ?? t("jobs.no_technician")}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{itemTypeLabels[i.itemType]}</td>
                  <td className="px-3 py-2 text-right font-mono">{i.qty}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatLkr(i.unitPrice)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{formatLkr(i.lineTotal)}</td>
                  <td className="px-3 py-2 text-right">
                    {canOperateJobs && (
                      <button
                        disabled={deletingItemId === i.id}
                        onClick={async () => {
                          if (deletingItemId) return;
                          setDeletingItemId(i.id);
                          const result = await onDeleteItem(i.id);
                          setDeletingItemId(null);
                          if (!result.ok) toast({ tone: "error", title: t("common.save_failed"), description: result.error });
                        }}
                        className="rounded-md bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!canSeeFinancials && items.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">{t("jobs.item_name")}</th>
                <th className="px-3 py-2">{t("bank.type")}</th>
                <th className="px-3 py-2 text-right">{t("jobs.qty")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{i.name}</td>
                  <td className="px-3 py-2 text-slate-600">{itemTypeLabels[i.itemType]}</td>
                  <td className="px-3 py-2 text-right font-mono">{i.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canOperateJobs && (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!canWrite || savingItem) return;

            const isPart = itemType === "part";
            const isLabour = itemType === "labour";
            const isStock = isPart && source === "stock";
            const isPurchased = isPart && source === "purchased";

            const itemName = isStock ? selectedProduct?.name ?? "" : name.trim();
            if (!itemName) return;
            if (isStock && !selectedProduct) return;

            setSavingItem(true);
            const result = await onAddItem({
              jobId: job.id,
              itemType,
              name: itemName,
              qty,
              // Stock items: server (addJobItem) overwrites this with the
              // product's current buyPrice regardless — this value is only
              // a display placeholder before that snapshot is taken.
              unitPrice: canSeeFinancials ? Number(unitPrice) || 0 : 0,
              source: isPart ? source : undefined,
              productId: isStock ? productId : undefined,
              supplierId: isPurchased ? supplierId || undefined : undefined,
              purchaseRef: isPurchased ? purchaseRef || undefined : undefined,
              purchaseDate: isPurchased ? new Date().toISOString().slice(0, 10) : undefined,
              customerPrice: (isPart || isLabour) && customerPrice !== "" ? Number(customerPrice) || 0 : undefined,
              technicianId: isLabour ? technicianId || undefined : undefined,
            });
            setSavingItem(false);
            if (!result.ok) {
              toast({ tone: "error", title: t("common.save_failed"), description: result.error });
              return;
            }
            resetItemForm();
          }}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <SelectInput
              value={itemType}
              onChange={(v) => {
                setItemType(v as JobItemType);
                resetItemForm();
              }}
              options={JOB_ITEM_TYPES.map((ty) => ({ value: ty, label: itemTypeLabels[ty] }))}
            />
            {itemType === "part" && (
              <SelectInput
                value={source}
                onChange={(v) => {
                  setSource(v as JobItemSource);
                  resetItemForm();
                }}
                options={[
                  { value: "stock", label: t("jobs.source.stock") },
                  { value: "purchased", label: t("jobs.source.purchased") },
                  { value: "customer_supplied", label: t("jobs.source.customer_supplied") },
                ]}
                className="col-span-2 sm:col-span-1"
              />
            )}
          </div>

          {itemType === "part" && source === "stock" ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
              <SelectInput
                value={productId}
                onChange={(v) => {
                  setProductId(v);
                  const p = products.find((row) => row.id === v);
                  setUnitPrice(p ? String(p.buyPrice) : "");
                }}
                options={[
                  { value: "", label: t("jobs.pick_product") },
                  ...inStockProducts.map((p) => ({ value: p.id, label: `${p.name} (${p.stockQty})` })),
                ]}
                className="col-span-2 sm:col-span-1"
              />
              <TextInput
                type="number"
                min={1}
                max={selectedProduct?.stockQty}
                value={String(qty)}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-20"
              />
              <button type="submit" disabled={!canWrite || savingItem || !productId} className="rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                {savingItem ? t("common.saving") : t("jobs.add_item")}
              </button>
              {canSeeFinancials && selectedProduct && (
                <p className="col-span-2 text-xs text-slate-500 sm:col-span-3">{t("jobs.stock_cost_hint")} {formatLkr(selectedProduct.buyPrice)}</p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                <TextInput placeholder={t("jobs.item_name")} value={name} onChange={(e) => setName(e.target.value)} className="col-span-2 sm:col-span-1" />
                <TextInput type="number" min={1} value={String(qty)} onChange={(e) => setQty(Number(e.target.value))} className="w-20" />
                {canSeeFinancials && (
                  <MoneyInput
                    value={unitPrice}
                    onChange={setUnitPrice}
                    className="w-28"
                    placeholder={itemType === "part" && source === "customer_supplied" ? "0" : undefined}
                  />
                )}
                <button type="submit" disabled={!canWrite || savingItem} className="rounded-lg bg-teal-600 px-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {savingItem ? t("common.saving") : t("jobs.add_item")}
                </button>
              </div>
              {itemType === "part" && source === "purchased" && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <SelectInput
                    value={supplierId}
                    onChange={setSupplierId}
                    options={[{ value: "", label: t("jobs.no_supplier") }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
                  />
                  <TextInput placeholder={t("jobs.purchase_ref")} value={purchaseRef} onChange={(e) => setPurchaseRef(e.target.value)} />
                  {canSeeFinancials && (
                    <MoneyInput value={customerPrice} onChange={setCustomerPrice} placeholder={t("jobs.customer_price_ph")} />
                  )}
                </div>
              )}
              {itemType === "labour" && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                  <SelectInput
                    value={technicianId}
                    onChange={(v) => {
                      setTechnicianId(v);
                      const tc = activeTechnicians.find((row) => row.id === v);
                      if (tc?.hourlyRate) setUnitPrice(String(tc.hourlyRate));
                    }}
                    options={[
                      { value: "", label: t("jobs.no_technician") },
                      ...activeTechnicians.map((tc) => ({ value: tc.id, label: tc.name })),
                    ]}
                  />
                  {canSeeFinancials && (
                    <MoneyInput value={customerPrice} onChange={setCustomerPrice} placeholder={t("jobs.customer_price_ph")} />
                  )}
                </div>
              )}
            </>
          )}
        </form>
      )}

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("jobs.status_history")}</p>
        <ol className="mt-2 space-y-1.5">
          {sortedHistory.map((h) => (
            <li key={h.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-mono text-xs text-slate-500">{h.date.slice(0, 10)}</span>
              <span className="font-medium text-slate-900">{h.oldStatus ? `${jobStatusLabel(h.oldStatus as ACJobStatus, locale)} → ` : ""}{jobStatusLabel(h.newStatus as ACJobStatus, locale)}</span>
            </li>
          ))}
        </ol>
      </div>
    </Drawer>
  );
}
