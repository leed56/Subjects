"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
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
import {
  PageHeader,
  MetricCard,
  EmptyState,
  SearchInput,
  Tabs,
  FormSection,
  ActionMenu,
  Button,
  type ActionMenuItem,
} from "@/components/ui/primitives";
import { Drawer, DrawerFooter, Dialog, ConfirmDialog } from "@/components/ui/overlay";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { FormField, TextInput, SelectInput, MoneyInput, DateInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { AssetIcon, PlusIcon, FilterIcon, CloseIcon } from "@/components/ui/icons";
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
  daysUntilDate,
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
import type { ACJob, ACJobInput, JobAssigneeType, JobItem, JobItemType, JobItemSource, JobItemInput, JobItemDisposition, JobItemWarrantyType, JobStatusEntry, Supplier, Technician } from "@/lib/store/types";
import type { Product } from "@/lib/types";
import { HVAC_COMPONENT_TYPES } from "@/lib/hvac-components";
import { createExpense } from "@/lib/supabase/expenses-client";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { canManageAcJobs, canOperateAcJobs } from "@/lib/org-role/permissions";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import { fetchAsset, fetchCustomerAssets, fetchJobAssetId, linkJobAsset, type AcAsset } from "@/lib/supabase/ac-assets-client";
import { computeJobProfitability, type JobLinkedExpense } from "@/lib/job-profitability";
import { fetchOrgExpenses } from "@/lib/supabase/expenses-client";

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
  const [complaint, setComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");

  // Cards|List toggle (Part 6) — remembered per browser like any other
  // display preference, not synced to the backend.
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  useEffect(() => {
    const stored = window.localStorage.getItem("lakbiz.jobs.view");
    if (stored === "cards" || stored === "list") setViewMode(stored);
  }, []);
  useEffect(() => {
    window.localStorage.setItem("lakbiz.jobs.view", viewMode);
  }, [viewMode]);

  const [teamFilter, setTeamFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"scheduled" | "newest" | "jobNo">("scheduled");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    markAllSeen();
  }, [markAllSeen]);

  // Unsaved-changes guard for the New/Edit drawer (Part 1) — snapshot the
  // form's values the moment it opens, then compare on every render; the
  // drawer only prompts before closing if something actually changed.
  const formSnapshotRef = useRef<string>("");
  const formSnapshot = JSON.stringify([
    customerId, customerName, phone, address, brand, btu, unitType, unitCount,
    quotedAmount, depositAmount, pipeMeters, status, scheduledDate, serviceIntervalDays,
    serviceDueManual, serviceDueDate, amcContract, notes, complaint, diagnosis, jobType,
    assigneeKey, subcontractCost,
  ]);
  useEffect(() => {
    if (formOpen) formSnapshotRef.current = formSnapshot;
    // Only re-snapshot on open/close transitions, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen]);
  const formDirty = formOpen && formSnapshot !== formSnapshotRef.current;

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
    setJobType("installation"); setAssigneeKey(""); setSubcontractCost(""); setNotes("");
    setComplaint(""); setDiagnosis(""); setEditing(null);
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
    setSubcontractCost(String(job.subcontractCost ?? "")); setNotes(job.notes ?? "");
    setComplaint(job.complaint ?? ""); setDiagnosis(job.diagnosis ?? ""); setFormOpen(true);
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
      complaint: complaint || undefined,
      diagnosis: diagnosis || undefined,
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
  const teamOptions = [
    { value: "all", label: t("jobs.all_types") },
    ...data.technicians.filter((x) => x.active).map((x) => ({ value: `team:${x.id}`, label: x.name })),
    ...data.contractors.filter((x) => x.active).map((x) => ({ value: `contractor:${x.id}`, label: x.name })),
  ];
  const jobs = data.acJobs
    .filter((j) => {
      const type = j.jobType ?? "installation";
      if (typeFilter !== "all" && type !== typeFilter) return false;
      if (filter !== "all" && j.status !== filter) return false;
      if (teamFilter !== "all" && `${j.assigneeType}:${j.assigneeId}` !== teamFilter) return false;
      if (!query) return true;
      return (
        j.jobNo.toLowerCase().includes(query) ||
        j.customerName.toLowerCase().includes(query) ||
        j.address.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (sortKey === "jobNo") return a.jobNo < b.jobNo ? -1 : a.jobNo > b.jobNo ? 1 : 0;
      if (sortKey === "newest") return a.id < b.id ? 1 : -1;
      // "scheduled": soonest scheduled date first, unscheduled jobs last.
      if (!a.scheduledDate && !b.scheduledDate) return 0;
      if (!a.scheduledDate) return 1;
      if (!b.scheduledDate) return -1;
      return a.scheduledDate < b.scheduledDate ? -1 : 1;
    });
  const activeFilterCount = [typeFilter !== "all", filter !== "all", teamFilter !== "all"].filter(Boolean).length;
  const pending = data.acJobs.filter((j) => ["quote", "deposit_received", "scheduled"].includes(j.status));
  const scheduled = data.acJobs.filter((j) => j.status === "scheduled");
  const serviceDue = data.acJobs.filter((j) => canMarkServiceDone(j));
  const quoteTotal = data.acJobs.reduce((sum, j) => sum + j.quotedAmount, 0);

  // List view (Part 6) — reuses the shared DataTable, which already
  // degrades to stacked mobile cards, so this view is responsive for free.
  const jobListColumns: DataTableColumn<ACJob>[] = [
    {
      key: "job",
      header: t("jobs.col_job"),
      render: (job) => (
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-teal-700">{job.jobNo}</p>
          <p className="truncate text-xs text-slate-500">{jobTypeLabel(job.jobType ?? "installation", locale)}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: t("jobs.col_customer"),
      render: (job) => <span className="font-medium text-slate-900">{job.customerName}</span>,
    },
    {
      key: "scheduled",
      header: t("jobs.install_label"),
      hideOnMobile: true,
      render: (job) => <span className="text-slate-600">{job.scheduledDate || "—"}</span>,
    },
    {
      key: "team",
      header: t("jobs.col_team"),
      hideOnMobile: true,
      render: (job) => <span className="text-slate-600">{job.assignedTechnician || "—"}</span>,
    },
    {
      key: "status",
      header: t("common.status"),
      render: (job) => (
        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${jobStatusClass(job.status)}`}>
          {jobStatusLabel(job.status, locale)}
        </span>
      ),
    },
    ...(canSeeFinancials
      ? ([
          {
            key: "quote",
            header: t("jobs.quote_label"),
            align: "right" as const,
            hideOnMobile: true,
            render: (job: ACJob) => formatLkr(job.quotedAmount),
          },
          {
            key: "balance",
            header: t("jobs.balance_label"),
            align: "right" as const,
            render: (job: ACJob) => formatLkr(job.quotedAmount - job.depositAmount),
          },
        ] satisfies DataTableColumn<ACJob>[])
      : []),
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (job) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {job.phone && <CallLink phone={job.phone} label={t("common.call")} variant="icon" />}
          {canOperateJobs && (
            <ActionMenu
              label={t("jobs.more_actions")}
              items={[
                { label: t("common.edit"), onSelect: () => loadJob(job), disabled: !canWrite },
                ...(canManageJobs
                  ? [{ label: t("common.delete"), onSelect: () => setDeleteTarget(job), tone: "danger" as const, disabled: !canWrite }]
                  : []),
              ]}
            />
          )}
        </div>
      ),
    },
  ];

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

        {/* Simplified toolbar (Part 5): search + one dropdown per filter
            instead of ~13 individual pill buttons. Dropdowns collapse into
            a "Filters" sheet below md so the bar itself stays to search +
            the view toggle on mobile. */}
        <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5">
          <SearchInput value={search} onChange={setSearch} placeholder={t("cust.search_placeholder")} className="min-w-[180px] flex-1" />

          <div className="hidden items-center gap-2 md:flex">
            <SelectInput
              ariaLabel={t("jobs.filter_type")}
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as ACJobType | "all")}
              className="w-auto"
              options={[
                { value: "all", label: t("jobs.all_types") },
                ...AC_JOB_TYPES.map((tpe) => ({ value: tpe.value, label: locale === "si" ? tpe.labelSi : tpe.labelEn })),
              ]}
            />
            <SelectInput
              ariaLabel={t("jobs.filter_status")}
              value={filter}
              onChange={(v) => setFilter(v as ACJobStatus | "all")}
              className="w-auto"
              options={[
                { value: "all", label: `${t("jobs.all")} (${data.acJobs.length})` },
                ...AC_JOB_STATUSES.map((s) => ({ value: s.value, label: locale === "si" ? s.labelSi : s.labelEn })),
              ]}
            />
            <SelectInput
              ariaLabel={t("jobs.filter_team")}
              value={teamFilter}
              onChange={setTeamFilter}
              className="w-auto"
              options={[{ value: "all", label: t("jobs.filter_all_teams") }, ...teamOptions.slice(1)]}
            />
            <SelectInput
              ariaLabel={t("jobs.sort")}
              value={sortKey}
              onChange={(v) => setSortKey(v as typeof sortKey)}
              className="w-auto"
              options={[
                { value: "scheduled", label: t("jobs.sort_scheduled") },
                { value: "newest", label: t("jobs.sort_newest") },
                { value: "jobNo", label: t("jobs.sort_job_no") },
              ]}
            />
          </div>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 md:hidden"
          >
            <FilterIcon className="h-4 w-4" />
            {t("jobs.filters")}
            {activeFilterCount > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              aria-pressed={viewMode === "cards"}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${viewMode === "cards" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {t("jobs.view_cards")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {t("jobs.view_list")}
            </button>
          </div>
        </div>

        {/* Mobile filters sheet — the same three dropdowns, full-width. */}
        <Drawer
          open={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          title={t("jobs.filters")}
          size="sm"
          footer={
            <DrawerFooter
              onCancel={() => setMobileFiltersOpen(false)}
              cancelLabel={t("common.close")}
              primaryLabel={t("common.done")}
              onPrimary={() => setMobileFiltersOpen(false)}
            />
          }
        >
          <div className="space-y-4">
            <FormField label={t("jobs.filter_type")}>
              <SelectInput
                value={typeFilter}
                onChange={(v) => setTypeFilter(v as ACJobType | "all")}
                options={[{ value: "all", label: t("jobs.all_types") }, ...AC_JOB_TYPES.map((tpe) => ({ value: tpe.value, label: locale === "si" ? tpe.labelSi : tpe.labelEn }))]}
              />
            </FormField>
            <FormField label={t("jobs.filter_status")}>
              <SelectInput
                value={filter}
                onChange={(v) => setFilter(v as ACJobStatus | "all")}
                options={[{ value: "all", label: `${t("jobs.all")} (${data.acJobs.length})` }, ...AC_JOB_STATUSES.map((s) => ({ value: s.value, label: locale === "si" ? s.labelSi : s.labelEn }))]}
              />
            </FormField>
            <FormField label={t("jobs.filter_team")}>
              <SelectInput value={teamFilter} onChange={setTeamFilter} options={[{ value: "all", label: t("jobs.filter_all_teams") }, ...teamOptions.slice(1)]} />
            </FormField>
            <FormField label={t("jobs.sort")}>
              <SelectInput
                value={sortKey}
                onChange={(v) => setSortKey(v as typeof sortKey)}
                options={[
                  { value: "scheduled", label: t("jobs.sort_scheduled") },
                  { value: "newest", label: t("jobs.sort_newest") },
                  { value: "jobNo", label: t("jobs.sort_job_no") },
                ]}
              />
            </FormField>
          </div>
        </Drawer>

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
        ) : viewMode === "list" ? (
          <DataTable<ACJob>
            columns={jobListColumns}
            rows={jobs}
            onRowClick={(job) => setSheetJob(job)}
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

      {/* Create / edit drawer — grouped into named sections (Part 2) instead
          of one flat ~20-field list; Advanced collapses service-interval/
          service-due/AMC since those are touched far less often than the
          fields above. Cancel/Save live in a DrawerFooter outside the
          scrollable body, so Save is never scrolled out of view. */}
      <Drawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `${t("jobs.edit_job")} ${editing.jobNo}` : t("jobs.new_job")}
        size="lg"
        unsavedChanges={formDirty}
        footer={
          <DrawerFooter
            onCancel={() => setFormOpen(false)}
            primaryLabel={savingJob ? t("common.saving") : editing ? t("jobs.update_job") : t("jobs.create")}
            primaryType="submit"
            primaryForm="job-form"
            primaryDisabled={!canWrite || savingJob}
            primaryLoading={savingJob}
          />
        }
      >
        <form id="job-form" onSubmit={handleJobSubmit} className="space-y-5">
          <FormSection title={t("jobs.section_job_type")}>
            <div className="flex flex-wrap gap-2">
              {AC_JOB_TYPES.map((tpe) => (
                <button key={tpe.value} type="button" onClick={() => { setJobType(tpe.value); if (!editing) setStatus(defaultStatusForJobType(tpe.value)); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${jobType === tpe.value ? "bg-teal-600 text-white" : "border border-slate-300 bg-white text-slate-600"}`}>
                  {locale === "si" ? tpe.labelSi : tpe.labelEn}
                </button>
              ))}
            </div>
          </FormSection>

          <FormSection title={t("jobs.section_customer_site")}>
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
          </FormSection>

          <FormSection title={t("jobs.section_equipment")}>
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
            {jobType === "installation" && (
              <FormField label={t("jobs.pipe_est")}>
                <TextInput type="number" value={String(pipeMeters)} onChange={(e) => setPipeMeters(Number(e.target.value))} />
              </FormField>
            )}
          </FormSection>

          <FormSection title={t("jobs.section_commercial")}>
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
          </FormSection>

          <FormSection title={t("jobs.section_schedule")}>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("common.status")}>
                <SelectInput value={status} onChange={(v) => setStatus(v as ACJobStatus)} options={AC_JOB_STATUSES.map((s) => ({ value: s.value, label: locale === "si" ? s.labelSi : s.labelEn }))} />
              </FormField>
              <FormField label={t("jobs.install_label")}>
                <DateInput value={scheduledDate} onChange={setScheduledDate} />
              </FormField>
            </div>
          </FormSection>

          <FormSection title={t("jobs.section_work_details")}>
            <FormField label={t("jobs.complaint")} hint={t("jobs.complaint_hint")}>
              <TextInput value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder={t("jobs.complaint_ph")} />
            </FormField>
            <FormField label={t("jobs.diagnosis")} hint={t("jobs.diagnosis_hint")}>
              <TextInput value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder={t("jobs.diagnosis_ph")} />
            </FormField>
            <FormField label={t("jobs.job_notes")}>
              <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
            </FormField>
          </FormSection>

          <FormSection
            title={t("jobs.section_advanced")}
            hint={t("jobs.section_advanced_hint")}
            collapsible
            defaultOpen={false}
          >
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
          </FormSection>
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
          business={data.business}
          items={data.jobItems.filter((i) => i.jobId === sheetJob.id)}
          history={data.jobStatusHistory.filter((h) => h.jobId === sheetJob.id)}
          products={data.products}
          suppliers={data.suppliers}
          technicians={data.technicians}
          orgId={org.isAuthenticated ? org.id : null}
          canSeeFinancials={canSeeFinancials}
          canOperateJobs={canOperateJobs}
          canManageJobs={canManageJobs}
          canWrite={canWrite}
          onAddItem={addJobItemToCloud}
          onDeleteItem={deleteJobItemToCloud}
          onEdit={() => { setSheetJob(null); loadJob(sheetJob); }}
          onDelete={() => { setSheetJob(null); setDeleteTarget(sheetJob); }}
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

/** Redesigned per docs/UI_POLISH_AUDIT.md Part 4/3: the previous version's
 * heavy dark header and up to 7-8 equal-weight action buttons are replaced
 * with a light card (a thin teal marker instead of a full dark block) and
 * a single primary action + Call + a "More" menu for everything else.
 * Only one primary action per context: the status-workflow action
 * (Schedule/Mark installed/Complete) when one applies, otherwise "Open"
 * is promoted to primary so the card never has zero primary actions. */
function JobCard({ job, assigneePhone, locale, business, notificationLogs, notifySettings, canManageJobs, canOperateJobs, canSeeFinancials, canWrite, disabledHint, onServiceDone, onJobSheet, onEdit, onSchedule, onInstalled, onComplete, onDelete, deleting }: { job: ACJob; assigneePhone?: string; locale: Locale; business: BusinessInfo; notificationLogs: ReturnType<typeof useNotificationLogs>; notifySettings: ReturnType<typeof loadNotificationSettings>; canManageJobs: boolean; canOperateJobs: boolean; canSeeFinancials: boolean; canWrite: boolean; disabledHint: string | null; onServiceDone: () => void; onJobSheet: () => void; onEdit: () => void; onSchedule: () => void; onInstalled: () => void; onComplete: () => void; onDelete: () => void; deleting?: boolean }) {
  const { t } = useLocale();
  const balance = job.quotedAmount - job.depositAmount;
  const isContractor = job.assigneeType === "contractor";
  const margin =
    isContractor && job.subcontractCost != null
      ? job.quotedAmount - job.subcontractCost
      : null;
  const [messageTarget, setMessageTarget] = useState<"customer" | "assignee" | null>(null);

  const statusAction =
    job.status === "deposit_received"
      ? { label: t("jobs.schedule"), onClick: onSchedule }
      : job.status === "scheduled"
        ? { label: t("jobs.mark_installed"), onClick: onInstalled }
        : job.status === "installed"
          ? { label: t("jobs.complete"), onClick: onComplete }
          : null;

  const menuItems: ActionMenuItem[] = [
    ...(job.phone ? [{ label: t("msg.send_message"), onSelect: () => setMessageTarget("customer") }] : []),
    ...(canOperateJobs && assigneePhone && job.assignedTechnician
      ? [{ label: t("jobs.notify_assignee"), onSelect: () => setMessageTarget("assignee") }]
      : []),
    ...(canMarkServiceDone(job)
      ? [{ label: t("jobs.service_done"), onSelect: onServiceDone, disabled: !canWrite }]
      : []),
    ...(statusAction ? [{ label: t("jobs.open"), onSelect: onJobSheet }] : []),
    ...(canOperateJobs ? [{ label: t("common.edit"), onSelect: onEdit, disabled: !canWrite }] : []),
    ...(canManageJobs
      ? [{ label: deleting ? t("common.saving") : t("common.delete"), onSelect: onDelete, tone: "danger" as const, disabled: !canWrite || deleting }]
      : []),
  ];

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="h-1 bg-teal-500" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-teal-700">{job.jobNo}</p>
            <h2 className="mt-1 truncate text-base font-semibold text-slate-900">{job.customerName}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{jobTypeLabel(job.jobType ?? "installation", locale)}</p>
          </div>
          <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${jobStatusClass(job.status)}`}>
            {jobStatusLabel(job.status, locale)}
            {job.amcContract && " · AMC"}
          </span>
        </div>

        {job.assignedTechnician && (
          <p className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-600">
            {t("jobs.assignee")}: {job.assignedTechnician}
            {job.assigneeType === "contractor" && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-amber-800">{t("work.contractors")}</span>}
            {job.assigneeType === "team" && <span className="rounded-md bg-teal-100 px-1.5 py-0.5 text-teal-800">{t("work.team")}</span>}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-slate-500">{job.address}</p>
          <NavigateLink address={job.address} label={t("common.navigate")} variant="icon" />
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-slate-700">
          {job.description}
          {job.btu && ` · ${job.btu} BTU`}
          {job.pipeMeters != null && ` · ${job.pipeMeters}m pipe`}
        </p>
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

        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          {statusAction ? (
            <Button variant="primary" size="sm" onClick={statusAction.onClick} disabled={!canWrite} title={!canWrite ? (disabledHint ?? undefined) : undefined}>
              {statusAction.label}
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={onJobSheet}>
              {t("jobs.open")}
            </Button>
          )}
          {statusAction && (
            <Button variant="secondary" size="sm" onClick={onJobSheet}>
              {t("jobs.open")}
            </Button>
          )}
          {job.phone && <CallLink phone={job.phone} label={t("common.call")} variant="icon" />}
          {menuItems.length > 0 && (
            <div className="ml-auto">
              <ActionMenu items={menuItems} label={t("jobs.more_actions")} />
            </div>
          )}
        </div>

        {job.phone && (
          <MessageSendButton
            renderTrigger={false}
            open={messageTarget === "customer"}
            onOpenChange={(v) => setMessageTarget(v ? "customer" : null)}
            phone={job.phone}
            recipientName={job.customerName}
            context={{ type: "ac_job", job, business }}
            defaultTemplate={defaultTemplateForJob(job.status)}
            contextId={job.id}
          />
        )}
        {assigneePhone && job.assignedTechnician && (
          <MessageSendButton
            renderTrigger={false}
            open={messageTarget === "assignee"}
            onOpenChange={(v) => setMessageTarget(v ? "assignee" : null)}
            phone={assigneePhone}
            recipientName={job.assignedTechnician}
            context={{ type: "ac_job", job, business }}
            defaultTemplate="job_assignee_dispatch"
            contextId={job.id}
            label={t("jobs.notify_assignee")}
          />
        )}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-2.5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">{value}</p></div>;
}

/** job-parts-materials phase — one of the 3 primary "+ From Stock /
 * + Manual Part / + External Purchase" actions, plus the secondary
 * "+ Service / Charge", each Part 2 of the brief asks for as its own
 * compact form rather than one dropdown-driven catch-all. One shared
 * component parameterized by `mode` (not 4 near-duplicate ones) — each
 * mode only renders the fields relevant to it, so no user ever sees
 * every field at once. Keyed by mode at the call site so switching modes
 * remounts with fresh state instead of needing manual reset wiring. */
type AddPartMode = "stock" | "manual" | "purchased" | "charge";
type ExternalPurchaseOutcome = "expense" | "inventory";

function AddJobItemDialog({
  mode,
  open,
  onClose,
  products,
  suppliers,
  technicians,
  canSeeFinancials,
  canWrite,
  saving,
  onSubmit,
}: {
  mode: AddPartMode;
  open: boolean;
  onClose: () => void;
  products: Product[];
  suppliers: Supplier[];
  technicians: Technician[];
  canSeeFinancials: boolean;
  canWrite: boolean;
  saving: boolean;
  onSubmit: (input: JobItemInput, outcome: ExternalPurchaseOutcome) => void;
}) {
  const { t } = useLocale();
  const isPart = mode !== "charge";

  const [itemType, setItemType] = useState<JobItemType>(mode === "charge" ? "service" : "part");
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState(mode === "manual" ? "pcs" : "");
  const [unitPrice, setUnitPrice] = useState("");
  const [customerPrice, setCustomerPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");

  const [productQuery, setProductQuery] = useState("");
  const [productId, setProductId] = useState("");
  const activeProducts = products.filter((p) => p.active !== false);
  const filteredProducts = activeProducts.filter((p) => {
    if (mode === "stock" && p.stockQty <= 0) return false;
    if (!productQuery.trim()) return true;
    const q = productQuery.trim().toLowerCase();
    const brand = String(p.customFields?.brand ?? "");
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      brand.toLowerCase().includes(q)
    );
  });
  const selectedProduct = productId ? products.find((p) => p.id === productId) : undefined;

  const [supplierId, setSupplierId] = useState("");
  const [purchaseRef, setPurchaseRef] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));

  const [technicianId, setTechnicianId] = useState("");
  const activeTechnicians = technicians.filter((tc) => tc.active);

  const [outcome, setOutcome] = useState<ExternalPurchaseOutcome>("expense");
  const [receiveQty, setReceiveQty] = useState(1);
  const [newProductName, setNewProductName] = useState("");

  const [isReplacement, setIsReplacement] = useState(false);
  const [oldComponentName, setOldComponentName] = useState("");
  const [oldComponentSerial, setOldComponentSerial] = useState("");
  const [disposition, setDisposition] = useState<JobItemDisposition>("unknown");
  const [newComponentSerial, setNewComponentSerial] = useState("");
  const [warrantyType, setWarrantyType] = useState<JobItemWarrantyType>("none");
  const [warrantyDays, setWarrantyDays] = useState(365);
  const [warrantyStartDate, setWarrantyStartDate] = useState(new Date().toISOString().slice(0, 10));

  const titleKey =
    mode === "stock" ? "jobs.dialog.from_stock_title"
    : mode === "manual" ? "jobs.dialog.manual_title"
    : mode === "purchased" ? "jobs.dialog.external_purchase_title"
    : "jobs.dialog.charge_title";

  const canSubmit = mode === "stock" ? Boolean(selectedProduct) : name.trim().length > 0;

  const handleSubmit = () => {
    if (!canWrite || saving || !canSubmit) return;
    const finalItemType: JobItemType = mode === "charge" ? itemType : "part";
    const finalName = mode === "stock" ? selectedProduct?.name ?? "" : name.trim();
    const input: JobItemInput = {
      jobId: "", // filled in by the caller (JobSheetDrawer already knows job.id)
      itemType: finalItemType,
      name: finalName,
      qty,
      unitPrice: canSeeFinancials ? Number(unitPrice) || 0 : 0,
      source: mode === "stock" ? "stock" : mode === "manual" ? "manual" : mode === "purchased" ? "purchased" : undefined,
      productId: mode === "stock" ? productId : mode === "purchased" && outcome === "inventory" ? productId || undefined : undefined,
      supplierId: isPart && mode !== "stock" ? supplierId || undefined : undefined,
      purchaseRef: isPart && mode !== "stock" ? purchaseRef.trim() || undefined : undefined,
      purchaseDate: isPart && mode !== "stock" ? purchaseDate : undefined,
      customerPrice: canSeeFinancials && customerPrice !== "" ? Number(customerPrice) || 0 : undefined,
      discount: canSeeFinancials && discount !== "" ? Number(discount) || 0 : undefined,
      unit: unit.trim() || undefined,
      notes: notes.trim() || undefined,
      technicianId: mode === "charge" && itemType === "labour" ? technicianId || undefined : undefined,
      isReplacement: isPart ? isReplacement : undefined,
      oldComponentName: isPart && isReplacement ? oldComponentName.trim() || undefined : undefined,
      oldComponentSerial: isPart && isReplacement ? oldComponentSerial.trim() || undefined : undefined,
      oldComponentDisposition: isPart && isReplacement ? disposition : undefined,
      newComponentSerial: isPart && isReplacement ? newComponentSerial.trim() || undefined : undefined,
      warrantyType: isPart && isReplacement ? warrantyType : undefined,
      warrantyDays: isPart && isReplacement && warrantyType !== "none" ? warrantyDays : undefined,
      warrantyStartDate: isPart && isReplacement && warrantyType !== "none" ? warrantyStartDate : undefined,
      receiveQty: mode === "purchased" && outcome === "inventory" ? receiveQty : undefined,
      newProductName: mode === "purchased" && outcome === "inventory" && !productId ? newProductName.trim() || undefined : undefined,
    };
    onSubmit(input, outcome);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(titleKey)}
      size="lg"
      footer={
        <DrawerFooter
          onCancel={onClose}
          primaryLabel={saving ? t("common.saving") : t("jobs.add_item")}
          primaryDisabled={!canWrite || saving || !canSubmit}
          primaryLoading={saving}
          onPrimary={handleSubmit}
        />
      }
    >
      <div className="space-y-5">
        {mode === "charge" && (
          <FormField label={t("jobs.charge_item_type")}>
            <SelectInput
              value={itemType}
              onChange={(v) => setItemType(v as JobItemType)}
              options={(["labour", "service", "transport", "other"] as JobItemType[]).map((ty) => ({
                value: ty,
                label: t(`jobs.item.${ty}`),
              }))}
            />
          </FormField>
        )}

        {mode === "stock" ? (
          <FormSection title={t("jobs.pick_product")}>
            <SearchInput value={productQuery} onChange={setProductQuery} placeholder={t("jobs.search_products")} />
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
              {filteredProducts.length === 0 ? (
                <p className="p-3 text-center text-sm text-slate-400">{t("jobs.no_items")}</p>
              ) : (
                filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProductId(p.id);
                      setUnitPrice(String(p.buyPrice));
                      if (!unit) setUnit("pcs");
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      productId === p.id ? "border-teal-400 bg-teal-50" : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">{p.name}</span>
                      <span className="block text-xs text-slate-500">
                        {p.sku && `${p.sku} · `}{p.category}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs font-semibold text-slate-700">{t("jobs.available_qty")}: {p.stockQty}</span>
                      {canSeeFinancials && <span className="block text-xs text-slate-500">{formatLkr(p.buyPrice)} → {formatLkr(p.sellPrice)}</span>}
                    </span>
                  </button>
                ))
              )}
            </div>
            {selectedProduct && (
              <div className="grid grid-cols-2 gap-3">
                <FormField label={t("jobs.qty")}>
                  <TextInput type="number" min={1} max={selectedProduct.stockQty} value={String(qty)} onChange={(e) => setQty(Number(e.target.value))} />
                </FormField>
                {canSeeFinancials && (
                  <FormField label={t("jobs.unit_cost")} hint={t("jobs.stock_cost_hint")}>
                    <MoneyInput value={String(selectedProduct.buyPrice)} onChange={() => {}} disabled />
                  </FormField>
                )}
              </div>
            )}
          </FormSection>
        ) : (
          <FormSection title={t("jobs.item_name")}>
            <FormField label={t("jobs.item_name")} required>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={mode === "manual" ? t("jobs.manual_name_ph") : undefined} />
            </FormField>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <FormField label={t("jobs.qty")}>
                <TextInput type="number" min={1} value={String(qty)} onChange={(e) => setQty(Number(e.target.value))} />
              </FormField>
              <FormField label={t("jobs.field.unit")}>
                <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs, m, hrs…" />
              </FormField>
              {canSeeFinancials && (
                <FormField label={t("jobs.field.internal_cost")}>
                  <MoneyInput value={unitPrice} onChange={setUnitPrice} />
                </FormField>
              )}
            </div>
          </FormSection>
        )}

        {mode === "charge" && itemType === "labour" && (
          <FormField label={t("jobs.assignee")}>
            <SelectInput
              value={technicianId}
              onChange={(v) => {
                setTechnicianId(v);
                const tc = activeTechnicians.find((row) => row.id === v);
                if (tc?.hourlyRate) setUnitPrice(String(tc.hourlyRate));
              }}
              options={[{ value: "", label: t("jobs.no_technician") }, ...activeTechnicians.map((tc) => ({ value: tc.id, label: tc.name }))]}
            />
          </FormField>
        )}

        {canSeeFinancials && (
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("jobs.field.customer_price")}>
              <MoneyInput value={customerPrice} onChange={setCustomerPrice} />
            </FormField>
            <FormField label={t("jobs.field.discount")}>
              <MoneyInput value={discount} onChange={setDiscount} />
            </FormField>
          </div>
        )}

        {isPart && mode !== "stock" && (
          <FormSection title={t("jobs.field.supplier")} collapsible defaultOpen={mode === "purchased"}>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("jobs.field.supplier")}>
                <SelectInput value={supplierId} onChange={setSupplierId} options={[{ value: "", label: t("jobs.no_supplier") }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
              </FormField>
              <FormField label={t("jobs.field.purchase_date")}>
                <DateInput value={purchaseDate} onChange={setPurchaseDate} />
              </FormField>
            </div>
            <FormField label={t("jobs.field.purchase_ref")}>
              <TextInput value={purchaseRef} onChange={(e) => setPurchaseRef(e.target.value)} />
            </FormField>
          </FormSection>
        )}

        {mode === "purchased" && (
          <FormSection title={t("jobs.external_purchase_outcome")}>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setOutcome("expense")}
                className={`rounded-lg border p-3 text-left text-sm ${outcome === "expense" ? "border-teal-400 bg-teal-50" : "border-slate-200"}`}
              >
                <span className="block font-semibold text-slate-900">{t("jobs.outcome_expense")}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{t("jobs.outcome_expense_hint")}</span>
              </button>
              <button
                type="button"
                onClick={() => setOutcome("inventory")}
                className={`rounded-lg border p-3 text-left text-sm ${outcome === "inventory" ? "border-teal-400 bg-teal-50" : "border-slate-200"}`}
              >
                <span className="block font-semibold text-slate-900">{t("jobs.outcome_inventory")}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{t("jobs.outcome_inventory_hint")}</span>
              </button>
            </div>
            {outcome === "inventory" && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <FormField label={t("jobs.pick_existing_product")}>
                  <SelectInput
                    value={productId}
                    onChange={setProductId}
                    options={[{ value: "", label: t("jobs.new_product_name") }, ...activeProducts.map((p) => ({ value: p.id, label: p.name }))]}
                  />
                </FormField>
                {!productId && (
                  <FormField label={t("jobs.new_product_name")}>
                    <TextInput value={newProductName} onChange={(e) => setNewProductName(e.target.value)} />
                  </FormField>
                )}
                <FormField label={t("jobs.field.qty_purchased")} hint={t("jobs.receive_qty_hint")}>
                  <TextInput type="number" min={qty} value={String(receiveQty)} onChange={(e) => setReceiveQty(Math.max(qty, Number(e.target.value)))} />
                </FormField>
              </div>
            )}
          </FormSection>
        )}

        {isPart && (
          <FormSection title={t("jobs.is_replacement")} collapsible defaultOpen={false}>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={isReplacement} onChange={(e) => setIsReplacement(e.target.checked)} />
              {t("jobs.is_replacement")}
            </label>
            {isReplacement && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={t("jobs.old_component")}>
                    <TextInput list="hvac-component-types" value={oldComponentName} onChange={(e) => setOldComponentName(e.target.value)} />
                  </FormField>
                  <FormField label={t("jobs.old_component_serial")}>
                    <TextInput value={oldComponentSerial} onChange={(e) => setOldComponentSerial(e.target.value)} />
                  </FormField>
                </div>
                <FormField label={t("jobs.disposition")}>
                  <SelectInput
                    value={disposition}
                    onChange={(v) => setDisposition(v as JobItemDisposition)}
                    options={(["returned_to_customer", "retained_by_company", "sent_for_warranty", "disposed", "repairable_core_return", "unknown"] as JobItemDisposition[]).map((d) => ({
                      value: d,
                      label: t(`jobs.disposition.${d}`),
                    }))}
                  />
                </FormField>
                <FormField label={t("jobs.new_component_serial")}>
                  <TextInput value={newComponentSerial} onChange={(e) => setNewComponentSerial(e.target.value)} />
                </FormField>
                <FormField label={t("jobs.warranty_type")}>
                  <SelectInput
                    value={warrantyType}
                    onChange={(v) => setWarrantyType(v as JobItemWarrantyType)}
                    options={(["none", "company", "supplier", "manufacturer"] as JobItemWarrantyType[]).map((w) => ({ value: w, label: t(`jobs.warranty_type.${w}`) }))}
                  />
                </FormField>
                {warrantyType !== "none" && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label={t("jobs.warranty_duration")}>
                      <div className="flex flex-wrap gap-1.5">
                        {[30, 90, 180, 365, 730].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setWarrantyDays(d)}
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${warrantyDays === d ? "bg-teal-600 text-white" : "border border-slate-300 bg-white text-slate-600"}`}
                          >
                            {d < 365 ? `${d} ${t("jobs.days")}` : `${Math.round(d / 365)} ${t("jobs.years")}`}
                          </button>
                        ))}
                      </div>
                    </FormField>
                    <FormField label={t("jobs.warranty_start")}>
                      <DateInput value={warrantyStartDate} onChange={setWarrantyStartDate} />
                    </FormField>
                  </div>
                )}
              </>
            )}
          </FormSection>
        )}

        <FormField label={t("jobs.field.notes")}>
          <TextInput value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>

        <datalist id="hvac-component-types">
          {HVAC_COMPONENT_TYPES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
    </Dialog>
  );
}

/** job-parts-materials phase, Part 8 — the polished Materials/Labor
 * table: Item / Source / Type / Qty / Cost / Sell / Customer Total /
 * Warranty / Actions, with an internal-cost/customer-value/margin totals
 * row gated behind canSeeFinancials (never shown to a role that
 * shouldn't see profit). Shared by both the Parts and Labor & Other
 * Costs tabs — same column shape either way, just a different item set. */
function MaterialsTable({
  items,
  itemTypeLabels,
  sourceLabels,
  technicians,
  canSeeFinancials,
  canOperateJobs,
  deletingItemId,
  onDelete,
}: {
  items: JobItem[];
  itemTypeLabels: Record<JobItemType, string>;
  sourceLabels: Record<JobItemSource, string>;
  technicians: Technician[];
  canSeeFinancials: boolean;
  canOperateJobs: boolean;
  deletingItemId: string | null;
  onDelete: (id: string) => void;
}) {
  const { t } = useLocale();

  const lineCustomerTotal = (i: JobItem) =>
    i.customerPrice != null ? Math.max(0, i.qty * i.customerPrice - (i.discount ?? 0)) : null;

  const warrantyLabel = (i: JobItem) => {
    if (!i.isReplacement || !i.warrantyExpiryDate) return "—";
    const daysLeft = daysUntilDate(i.warrantyExpiryDate);
    if (daysLeft < 0) return <span className="text-rose-600">{t("jobs.warranty_expired")}</span>;
    return `${i.warrantyExpiryDate} (${daysLeft}${t("jobs.days_short")})`;
  };

  if (items.length === 0) {
    return (
      <EmptyState size="compact" title={t("jobs.no_items")} />
    );
  }

  const totalInternalCost = items.reduce((s, i) => s + i.lineTotal, 0);
  const totalCustomerValue = items.reduce((s, i) => s + (lineCustomerTotal(i) ?? 0), 0);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">{t("jobs.item_name")}</th>
              <th className="px-3 py-2">{t("bank.type")}</th>
              <th className="px-3 py-2 text-right">{t("jobs.qty")}</th>
              {canSeeFinancials && <th className="px-3 py-2 text-right">{t("jobs.cost_label")}</th>}
              {canSeeFinancials && <th className="px-3 py-2 text-right">{t("jobs.field.customer_price")}</th>}
              {canSeeFinancials && <th className="px-3 py-2 text-right">{t("jobs.customer_total")}</th>}
              <th className="px-3 py-2">{t("jobs.warranty_type")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2 font-medium text-slate-900">
                  {i.name}
                  {i.isReplacement && (
                    <span className="ml-1.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      {t("jobs.item.replacement")}
                    </span>
                  )}
                  {i.source && (
                    <p className="mt-0.5 text-xs font-normal text-slate-400">
                      {sourceLabels[i.source]}
                      {i.purchasedForJob && ` · ${t("jobs.purchased_for_job")}`}
                    </p>
                  )}
                  {i.technicianId && (
                    <p className="mt-0.5 text-xs font-normal text-slate-400">
                      {technicians.find((tc) => tc.id === i.technicianId)?.name ?? t("jobs.no_technician")}
                    </p>
                  )}
                  {i.purchaseRef && <p className="mt-0.5 text-xs font-normal text-slate-400">{i.purchaseRef}</p>}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {itemTypeLabels[i.itemType]}
                  {i.unit && <span className="text-slate-400"> · {i.unit}</span>}
                </td>
                <td className="px-3 py-2 text-right font-mono">{i.qty}</td>
                {canSeeFinancials && <td className="px-3 py-2 text-right font-mono">{formatLkr(i.unitPrice)}</td>}
                {canSeeFinancials && (
                  <td className="px-3 py-2 text-right font-mono">{i.customerPrice != null ? formatLkr(i.customerPrice) : "—"}</td>
                )}
                {canSeeFinancials && (
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {lineCustomerTotal(i) != null ? formatLkr(lineCustomerTotal(i)!) : "—"}
                  </td>
                )}
                <td className="px-3 py-2 text-xs text-slate-600">{warrantyLabel(i)}</td>
                <td className="px-3 py-2 text-right">
                  {canOperateJobs && (
                    <button
                      disabled={deletingItemId === i.id}
                      onClick={() => onDelete(i.id)}
                      aria-label={t("common.delete")}
                      className="rounded-md bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                      <CloseIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {canSeeFinancials && (
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900">
              <tr>
                <td className="px-3 py-2" colSpan={3}>{t("jobs.materials_totals")}</td>
                <td className="px-3 py-2 text-right font-mono">{formatLkr(totalInternalCost)}</td>
                <td />
                <td className="px-3 py-2 text-right font-mono">{formatLkr(totalCustomerValue)}</td>
                <td colSpan={2} className="px-3 py-2 text-right font-mono text-emerald-700">
                  {t("jobs.parts_gross_profit")}: {formatLkr(totalCustomerValue - totalInternalCost)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/** Job detail as a work order: financials, parts/labour, equipment, status history —
 * now a Drawer instead of a fixed-overlay dialog. Equipment section (Phase 5) is new:
 * a direct-cloud read/write against ac_jobs.asset_id, bypassing the local-first ACJob
 * type which doesn't carry that column yet — see ac-assets-client.ts. */
type JobDetailTab = "overview" | "parts" | "labor" | "economics" | "invoice";

/** Job Detail as progressive disclosure (HVAC platform Phase 9) — was one
 * long scroll of every section at once; now tabbed so Parts/Labor entry
 * (the frequent, quick actions) don't compete for space with Job
 * Economics or Invoice & Payment (checked rarely, in one sitting). */
function JobSheetDrawer({ job, locale, business, items, history, products, suppliers, technicians, orgId, canSeeFinancials, canOperateJobs, canManageJobs, canWrite, onAddItem, onDeleteItem, onEdit, onDelete, onClose }: { job: ACJob; locale: Locale; business: BusinessInfo; items: JobItem[]; history: JobStatusEntry[]; products: Product[]; suppliers: Supplier[]; technicians: Technician[]; orgId: string | null; canSeeFinancials: boolean; canOperateJobs: boolean; canManageJobs: boolean; canWrite: boolean; onAddItem: (input: JobItemInput) => Promise<{ ok: boolean; error?: string }>; onDeleteItem: (id: string) => Promise<{ ok: boolean; error?: string }>; onEdit: () => void; onDelete: () => void; onClose: () => void }) {
  const { t } = useLocale();
  const { toast } = useToast();
  const [messageOpen, setMessageOpen] = useState(false);
  const [tab, setTab] = useState<JobDetailTab>("overview");
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  // job-parts-materials phase: which of the 3 primary + 1 secondary "Add
  // part" dialogs is open, if any — replaces the old single dropdown-
  // driven form (see AddJobItemDialog above).
  const [addDialogMode, setAddDialogMode] = useState<AddPartMode | null>(null);
  // Part 16 — Purchased-for-Job filter on the Materials table.
  const [partsFilter, setPartsFilter] = useState<"all" | "stock" | "purchased" | "manual">("all");

  const partItems = items.filter((i) => i.itemType === "part");
  const filteredPartItems = partItems.filter((i) => {
    if (partsFilter === "all") return true;
    if (partsFilter === "purchased") return i.source === "purchased" || i.purchasedForJob;
    if (partsFilter === "stock") return i.source === "stock" && !i.purchasedForJob;
    return i.source === "manual";
  });
  const laborItems = items.filter((i) => i.itemType === "labour" || i.itemType === "service" || i.itemType === "transport" || i.itemType === "other");

  // Job-linked Expenses (Phase 7) — fetched here now so Job Economics is
  // complete in this view, closing the gap Phases 7/8 explicitly deferred
  // to "Phase 9's Job Detail redesign potentially changing that."
  const [jobExpenses, setJobExpenses] = useState<JobLinkedExpense[] | null>(null);
  useEffect(() => {
    if (!orgId || !canSeeFinancials) {
      setJobExpenses([]);
      return;
    }
    let cancelled = false;
    void fetchOrgExpenses(orgId).then((result) => {
      if (cancelled) return;
      const linked = result.data
        .filter((e) => e.jobId === job.id)
        .map((e) => ({ category: e.category, amount: e.amount }));
      setJobExpenses(linked);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId, canSeeFinancials, job.id]);

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
    transport: t("jobs.item.transport"),
    other: t("jobs.item.other"),
  };

  const sourceLabels: Record<JobItemSource, string> = {
    stock: t("jobs.source.stock"),
    purchased: t("jobs.source.purchased"),
    manual: t("jobs.source.manual"),
    customer_supplied: t("jobs.source.customer_supplied"),
  };

  // Shared with /job-costing (HVAC platform Phase 8 — one authoritative
  // formula, not a second one duplicated here). Now fed a real
  // linkedExpenseTotal (fetched above), so this drawer's numbers match
  // /job-costing's exactly.
  const profit = computeJobProfitability(job, items, jobExpenses ?? []);
  // Raw sum for the "Linked expenses" info line below — deliberately not
  // the same figure profit.otherCost uses: this is "how much you've
  // logged against this job," profit.otherCost is "how much counts
  // toward cost without double-counting subcontractCost." Both are
  // correct; they answer different questions.
  const jobExpenseTotal = (jobExpenses ?? []).reduce((s, e) => s + e.amount, 0);
  const sortedHistory = [...history].sort((a, b) => (a.date < b.date ? 1 : -1));
  const balance = job.quotedAmount - job.depositAmount;

  // job-parts-materials phase — Part 5's "External Purchase, Expense
  // only" bridge (docs/JOB_PARTS_ARCHITECTURE.md §2.2): after the
  // job_items line itself saves (the actual Material-cost record), also
  // create a linked Expense purely so the purchase shows up in shop-wide
  // expense totals/VAT input figures. computeJobProfitability excludes
  // this category from its own sum unconditionally (see job-
  // profitability.ts), so this can never double-count against the line
  // that was just saved. Payment method defaults to "cash" — no
  // dedicated field on this form (the spec calls it optional/"if
  // useful"); the owner can correct it on /expenses afterward if it
  // wasn't actually cash.
  const handleAddItem = async (input: JobItemInput, outcome: ExternalPurchaseOutcome) => {
    if (!canWrite || savingItem) return;
    setSavingItem(true);
    const finalInput: JobItemInput = { ...input, jobId: job.id };
    const result = await onAddItem(finalInput);
    if (!result.ok) {
      setSavingItem(false);
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    if (finalInput.source === "purchased" && outcome === "expense" && orgId && canSeeFinancials) {
      const amount = finalInput.qty * (finalInput.unitPrice || 0);
      if (amount > 0) {
        const expenseResult = await createExpense(orgId, {
          category: "parts_purchase",
          amount,
          expenseDate: finalInput.purchaseDate || new Date().toISOString().slice(0, 10),
          paymentMethod: "cash",
          vendor: finalInput.supplierId ? suppliers.find((s) => s.id === finalInput.supplierId)?.name : undefined,
          notes: finalInput.purchaseRef ? `${job.jobNo} — ${finalInput.purchaseRef}` : job.jobNo,
          jobId: job.id,
        });
        if (expenseResult.error) {
          toast({ tone: "error", title: t("jobs.expense_link_failed"), description: expenseResult.error });
        }
      }
    }
    setSavingItem(false);
    setAddDialogMode(null);
  };

  const menuItems: ActionMenuItem[] = [
    ...(job.phone ? [{ label: t("msg.send_message"), onSelect: () => setMessageOpen(true) }] : []),
    ...(canOperateJobs ? [{ label: t("common.edit"), onSelect: onEdit, disabled: !canWrite }] : []),
    ...(canManageJobs
      ? [{ label: t("common.delete"), onSelect: onDelete, tone: "danger" as const, disabled: !canWrite }]
      : []),
  ];

  return (
    <Drawer
      open
      onClose={onClose}
      title={job.customerName}
      description={`${job.jobNo} · ${jobTypeLabel(job.jobType ?? "installation", locale)} · ${job.address}`}
      size="xl"
      statusBadge={
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${jobStatusClass(job.status)}`}>
          {jobStatusLabel(job.status, locale)}
          {job.amcContract && " · AMC"}
        </span>
      }
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
        {menuItems.length > 0 && (
          <div className="ml-auto">
            <ActionMenu items={menuItems} label={t("jobs.more_actions")} />
          </div>
        )}
      </div>

      {job.phone && (
        <MessageSendButton
          renderTrigger={false}
          open={messageOpen}
          onOpenChange={setMessageOpen}
          phone={job.phone}
          recipientName={job.customerName}
          context={{ type: "ac_job", job, business }}
          defaultTemplate={defaultTemplateForJob(job.status)}
          contextId={job.id}
        />
      )}

      {canSeeFinancials && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric label={t("jobs.quote_label")} value={formatLkr(job.quotedAmount)} />
          <Metric label={t("jobs.collected_label")} value={formatLkr(job.depositAmount)} />
          <Metric label={t("jobs.cost_label")} value={formatLkr(profit.totalCost)} />
          <Metric label={t("jobs.net_profit")} value={formatLkr(profit.grossProfit)} />
          <Metric label={t("jobs.balance_label")} value={formatLkr(balance)} />
        </div>
      )}

      <Tabs
        value={tab}
        onChange={(v) => setTab(v as JobDetailTab)}
        tabs={[
          { value: "overview", label: t("jobs.tab_overview") },
          { value: "parts", label: t("jobs.tab_parts") },
          { value: "labor", label: t("jobs.tab_labor") },
          ...(canSeeFinancials ? [{ value: "economics", label: t("jobs.tab_economics") }] : []),
          { value: "invoice", label: t("jobs.tab_invoice") },
        ]}
      />

      {tab === "overview" && (
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
      {/* Left column: who/where/when + the complaint/diagnosis narrative. */}
      <div className="space-y-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("jobs.section_customer_site")}</p>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">{t("jobs.customer_name")}</dt><dd className="text-right font-medium text-slate-900">{job.customerName}</dd></div>
            {job.phone && <div className="flex justify-between gap-3"><dt className="text-slate-500">{t("common.phone")}</dt><dd className="text-right font-medium text-slate-900">{job.phone}</dd></div>}
            <div className="flex justify-between gap-3"><dt className="shrink-0 text-slate-500">{t("jobs.site_address")}</dt><dd className="text-right font-medium text-slate-900">{job.address}</dd></div>
            {job.assignedTechnician && <div className="flex justify-between gap-3"><dt className="text-slate-500">{t("jobs.assignee")}</dt><dd className="text-right font-medium text-slate-900">{job.assignedTechnician}</dd></div>}
            {job.scheduledDate && <div className="flex justify-between gap-3"><dt className="text-slate-500">{t("jobs.install_label")}</dt><dd className="text-right font-medium text-slate-900">{job.scheduledDate}</dd></div>}
            {job.serviceDueDate && <div className="flex justify-between gap-3"><dt className="text-slate-500">{t("jobs.service_due_label")}</dt><dd className="text-right font-medium text-slate-900">{job.serviceDueDate}</dd></div>}
          </dl>
        </div>

        {(job.complaint || job.diagnosis) && (
          <div className="space-y-3">
            {job.complaint && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("jobs.complaint")}</p>
                <p className="mt-1 text-sm text-slate-800">{job.complaint}</p>
              </div>
            )}
            {job.diagnosis && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("jobs.diagnosis")}</p>
                <p className="mt-1 text-sm text-slate-800">{job.diagnosis}</p>
              </div>
            )}
          </div>
        )}
        {job.notes && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("jobs.job_notes")}</p>
            <p className="mt-1 text-sm text-slate-800">{job.notes}</p>
          </div>
        )}
      </div>

      {/* Right column: equipment, attachments (disclosed as unavailable —
          no photo/document architecture exists anywhere in this codebase
          yet, confirmed in the Phase 1 audit), status history. */}
      <div className="space-y-5">
        <div>
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

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("jobs.attachments")}</p>
          <p className="text-sm text-slate-400">{t("jobs.attachments_unavailable")}</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("jobs.status_history")}</p>
          {sortedHistory.length === 0 ? (
            <p className="text-sm text-slate-400">—</p>
          ) : (
            <ol className="space-y-1.5">
              {sortedHistory.map((h) => (
                <li key={h.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-slate-500">{h.date.slice(0, 10)}</span>
                  <span className="font-medium text-slate-900">{h.oldStatus ? `${jobStatusLabel(h.oldStatus as ACJobStatus, locale)} → ` : ""}{jobStatusLabel(h.newStatus as ACJobStatus, locale)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      </div>
      )}

      {(tab === "parts" || tab === "labor") && (
      <div className="mt-4 space-y-3">
        {canOperateJobs && (
          <div className="flex flex-wrap gap-2">
            {tab === "parts" ? (
              <>
                <Button variant="primary" size="sm" onClick={() => setAddDialogMode("stock")} disabled={!canWrite}>
                  {t("jobs.add_part_menu.from_stock")}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setAddDialogMode("manual")} disabled={!canWrite}>
                  {t("jobs.add_part_menu.manual")}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setAddDialogMode("purchased")} disabled={!canWrite}>
                  {t("jobs.add_part_menu.external_purchase")}
                </Button>
              </>
            ) : (
              <Button variant="primary" size="sm" onClick={() => setAddDialogMode("charge")} disabled={!canWrite}>
                {t("jobs.add_part_menu.charge")}
              </Button>
            )}
          </div>
        )}

        {tab === "parts" && partItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(["all", "stock", "purchased", "manual"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setPartsFilter(f)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  partsFilter === f ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {t(`jobs.parts_filter.${f}`)}
              </button>
            ))}
          </div>
        )}

        <MaterialsTable
          items={tab === "parts" ? filteredPartItems : laborItems}
          itemTypeLabels={itemTypeLabels}
          sourceLabels={sourceLabels}
          technicians={technicians}
          canSeeFinancials={canSeeFinancials}
          canOperateJobs={canOperateJobs}
          deletingItemId={deletingItemId}
          onDelete={async (id) => {
            if (deletingItemId) return;
            setDeletingItemId(id);
            const result = await onDeleteItem(id);
            setDeletingItemId(null);
            if (!result.ok) toast({ tone: "error", title: t("common.save_failed"), description: result.error });
          }}
        />
      </div>
      )}

      {addDialogMode && (
        <AddJobItemDialog
          key={addDialogMode}
          mode={addDialogMode}
          open
          onClose={() => setAddDialogMode(null)}
          products={products}
          suppliers={suppliers}
          technicians={technicians}
          canSeeFinancials={canSeeFinancials}
          canWrite={canWrite}
          saving={savingItem}
          onSubmit={handleAddItem}
        />
      )}

      {tab === "economics" && canSeeFinancials && (
      <div className="mt-4 space-y-4">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-3 py-2 text-slate-600">{t("jobs.economics_material")}</td>
                <td className="px-3 py-2 text-right font-mono">{formatLkr(profit.materialCost)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-slate-600">{t("jobs.economics_labor")}</td>
                <td className="px-3 py-2 text-right font-mono">{formatLkr(profit.laborCost)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-slate-600">{t("jobs.economics_other")}</td>
                <td className="px-3 py-2 text-right font-mono">{formatLkr(profit.otherCost)}</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="px-3 py-2 font-semibold text-slate-900">{t("jobs.economics_total_cost")}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{formatLkr(profit.totalCost)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-slate-600">{t("jobs.economics_revenue")}</td>
                <td className="px-3 py-2 text-right font-mono">{formatLkr(profit.revenue)}</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="px-3 py-2 font-semibold text-slate-900">{t("jobs.economics_gross_profit")}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${profit.grossProfit < 0 ? "text-rose-700" : "text-emerald-700"}`}>{formatLkr(profit.grossProfit)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-slate-600">{t("jobs.economics_margin")}</td>
                <td className="px-3 py-2 text-right font-mono">{profit.grossMarginPct !== null ? `${profit.grossMarginPct.toFixed(1)}%` : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {jobExpenseTotal > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("jobs.linked_expenses")}</p>
            <p className="text-sm text-slate-600">{formatLkr(jobExpenseTotal)}</p>
          </div>
        )}
      </div>
      )}

      {tab === "invoice" && (
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric label={t("jobs.quote_label")} value={formatLkr(job.quotedAmount)} />
          <Metric label={t("jobs.deposit_label")} value={formatLkr(job.depositAmount)} />
          <Metric label={t("common.balance")} value={formatLkr(balance)} />
        </div>
        <Link
          href={`/jobs/${job.id}/invoice`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t("jinv.view_invoice")}
        </Link>
      </div>
      )}
    </Drawer>
  );
}
