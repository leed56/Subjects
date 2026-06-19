"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { MessageComposer } from "@/components/messaging/message-composer";
import { MessageSendButton } from "@/components/messaging/message-send-button";
import {
  AC_BRANDS,
  AC_BTU_OPTIONS,
  AC_JOB_STATUSES,
  jobStatusLabel,
} from "@/lib/ac-jobs";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ACJob } from "@/lib/store/types";
import type { ACJobStatus } from "@/lib/ac-jobs";
import {
  defaultTemplateForJob,
  loadNotificationSettings,
} from "@/lib/messaging";
import { AcServiceDoneDialog } from "@/components/ac-service-done-dialog";
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
import {
  AC_JOB_TYPES,
  defaultStatusForJobType,
  jobTypeLabel,
  type ACJobType,
} from "@/lib/ac-job-types";

const UNIT_TYPES = [
  "Wall mounted",
  "Cassette",
  "Ducted",
  "Ceiling suspended",
  "Portable",
  "Window",
];

export default function JobsPage() {
  const { data, ready, addACJob, updateACJob, deleteACJob, recordACService } =
    useAppStore();
  const { t, locale } = useLocale();
  const [showForm, setShowForm] = useState(true);
  const [editing, setEditing] = useState<ACJob | null>(null);
  const [filter, setFilter] = useState<ACJobStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ACJobType | "all">("all");
  const [jobType, setJobType] = useState<ACJobType>("installation");
  const [assignedTechnician, setAssignedTechnician] = useState("");
  const [message, setMessage] = useState("");
  const [promptJob, setPromptJob] = useState<ACJob | null>(null);
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
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10">{t("common.loading")}</main>
      </div>
    );
  }

  const resetForm = () => {
    setCustomerId("");
    setCustomerName("");
    setPhone("");
    setAddress("");
    setBrand(AC_BRANDS[0]);
    setBtu(18000);
    setUnitType(UNIT_TYPES[0]);
    setUnitCount(1);
    setDescription("");
    setQuotedAmount(0);
    setDepositAmount(0);
    setPipeMeters(4);
    setStatus("quote");
    setScheduledDate("");
    setServiceIntervalDays(180);
    setServiceDueManual(false);
    setServiceDueDate("");
    setAmcContract(false);
    setJobType("installation");
    setAssignedTechnician("");
    setNotes("");
    setEditing(null);
  };

  const loadJob = (job: ACJob) => {
    setEditing(job);
    setCustomerId(job.customerId ?? "");
    setCustomerName(job.customerName);
    setPhone(job.phone ?? "");
    setAddress(job.address);
    setBrand(job.brand ?? AC_BRANDS[0]);
    setBtu(job.btu ?? 18000);
    setUnitType(job.unitType ?? UNIT_TYPES[0]);
    setUnitCount(job.unitCount);
    setDescription(job.description);
    setQuotedAmount(job.quotedAmount);
    setDepositAmount(job.depositAmount);
    setPipeMeters(job.pipeMeters ?? 4);
    setStatus(job.status);
    setScheduledDate(job.scheduledDate ?? "");
    setServiceIntervalDays(resolveServiceIntervalDays(job));
    setServiceDueManual(job.serviceDueManual ?? false);
    setServiceDueDate(job.serviceDueDate ?? "");
    setAmcContract(job.amcContract ?? false);
    setJobType(job.jobType ?? "installation");
    setAssignedTechnician(job.assignedTechnician ?? "");
    setNotes(job.notes ?? "");
    setShowForm(true);
  };

  const autoServiceDuePreview = (): string | undefined => {
    const interval = serviceIntervalDays || DEFAULT_SERVICE_INTERVAL_DAYS;
    const today = new Date().toISOString().slice(0, 10);
    if (jobType === "installation") {
      const base =
        editing?.installedDate ??
        (status === "installed" ? today : scheduledDate || today);
      if (status === "installed" || scheduledDate) {
        return computeServiceDueFromDays(base, interval);
      }
      return undefined;
    }
    const base = scheduledDate || today;
    return computeServiceDueFromDays(base, interval);
  };

  const buildInput = () => {
    const resolvedDue = serviceDueManual
      ? serviceDueDate || undefined
      : autoServiceDuePreview();

    return {
    jobType,
    assignedTechnician: assignedTechnician || undefined,
    serviceDueManual,
    serviceDueDate: resolvedDue,
    serviceIntervalDays,
    customerId: customerId || undefined,
    customerName: customerName || "Customer",
    phone,
    address,
    brand,
    btu,
    unitType,
    unitCount,
    description:
      description ||
      `${brand} ${btu} BTU ${unitType} × ${unitCount}`,
    quotedAmount,
    depositAmount,
    pipeMeters,
    status,
    scheduledDate: scheduledDate || undefined,
    amcContract,
    installedDate:
      status === "installed" && !editing?.installedDate
        ? new Date().toISOString().slice(0, 10)
        : editing?.installedDate,
    notes,
  };
  };

  const jobs = data.acJobs.filter((j) => {
    const type = j.jobType ?? "installation";
    if (typeFilter !== "all" && type !== typeFilter) return false;
    if (filter === "all") return true;
    return j.status === filter;
  });

  const pending = data.acJobs.filter((j) =>
    ["quote", "deposit_received", "scheduled"].includes(j.status),
  );

  const maybePromptMessage = (job: ACJob, nextStatus: ACJobStatus) => {
    const settings = loadNotificationSettings();
    if (!settings.autoPromptOnJobStatus || !job.phone) return;
    setPromptJob({ ...job, status: nextStatus });
  };

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("jobs.title")}</h1>
            <p className="text-slate-600">
              {t("jobs.subtitle")} — {pending.length} {t("jobs.pending")}
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowForm((v) => !v);
            }}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
          >
            {showForm ? t("common.hide_form") : t("jobs.new")}
          </button>
        </div>

        {message && (
          <div className="mb-4 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {message}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!address.trim()) {
                setMessage(t("jobs.address_required"));
                return;
              }
              const input = buildInput();
              if (editing) {
                updateACJob(editing.id, input);
                setMessage(t("jobs.updated"));
              } else {
                addACJob(input);
                setMessage(t("jobs.created"));
                resetForm();
                setShowForm(false);
              }
              setTimeout(() => setMessage(""), 2500);
            }}
            className="mb-8 rounded-xl border bg-white p-5"
          >
            <h2 className="font-semibold">
              {editing
                ? `${t("jobs.edit_job")} ${editing.jobNo}`
                : t("jobs.new_job")}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {AC_JOB_TYPES.map((tpe) => (
                <button
                  key={tpe.value}
                  type="button"
                  onClick={() => {
                    setJobType(tpe.value);
                    if (!editing) {
                      setStatus(defaultStatusForJobType(tpe.value));
                    }
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    jobType === tpe.value
                      ? "bg-teal-700 text-white"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {locale === "si" ? tpe.labelSi : tpe.labelEn}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  const c = data.customers.find((x) => x.id === e.target.value);
                  if (c) {
                    setCustomerName(c.name);
                    setPhone(c.phone ?? "");
                    setAddress(c.address ?? "");
                  }
                }}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">{t("jobs.customer_opt")}</option>
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                placeholder={t("jobs.customer_name")}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder={t("common.phone")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                required
                placeholder={t("jobs.site_address")}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="sm:col-span-2 rounded-lg border px-3 py-2 text-sm"
              />
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {AC_BRANDS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
              <select
                value={btu}
                onChange={(e) => setBtu(Number(e.target.value))}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {AC_BTU_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b} BTU
                  </option>
                ))}
              </select>
              <select
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {UNIT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                placeholder={t("jobs.units")}
                value={unitCount}
                onChange={(e) => setUnitCount(Number(e.target.value))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder={t("jobs.quote")}
                value={quotedAmount || ""}
                onChange={(e) => setQuotedAmount(Number(e.target.value))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder={t("jobs.technician")}
                value={assignedTechnician}
                onChange={(e) => setAssignedTechnician(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              {jobType === "installation" && (
                <>
                  <input
                    type="number"
                    placeholder={t("jobs.deposit")}
                    value={depositAmount || ""}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder={t("jobs.pipe_est")}
                    value={pipeMeters || ""}
                    onChange={(e) => setPipeMeters(Number(e.target.value))}
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                </>
              )}
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ACJobStatus)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {AC_JOB_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {locale === "si" ? s.labelSi : s.labelEn}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
                placeholder="Install date"
              />
              <div className="sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("jobs.service_interval_days")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SERVICE_INTERVAL_DAY_PRESETS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setServiceIntervalDays(d)}
                      className={`rounded-full px-3 py-1 text-xs ${
                        serviceIntervalDays === d
                          ? "bg-teal-700 text-white"
                          : "border bg-white"
                      }`}
                    >
                      {d} {t("jobs.days")}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={14}
                    max={730}
                    value={serviceIntervalDays}
                    onChange={(e) =>
                      setServiceIntervalDays(Number(e.target.value) || 180)
                    }
                    className="w-24 rounded-lg border px-2 py-1 text-sm"
                  />
                </div>
              </div>
              <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t("jobs.service_due_section")}
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={!serviceDueManual}
                      onChange={() => {
                        setServiceDueManual(false);
                        setServiceDueDate("");
                      }}
                    />
                    {t("jobs.service_due_auto")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={serviceDueManual}
                      onChange={() => {
                        setServiceDueManual(true);
                        setServiceDueDate(
                          serviceDueDate || autoServiceDuePreview() || "",
                        );
                      }}
                    />
                    {t("jobs.service_due_manual")}
                  </label>
                </div>
                {serviceDueManual ? (
                  <input
                    type="date"
                    value={serviceDueDate}
                    onChange={(e) => setServiceDueDate(e.target.value)}
                    className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                  />
                ) : (
                  <p className="mt-2 text-sm text-teal-800">
                    {autoServiceDuePreview()
                      ? `${t("jobs.service_due_label")}: ${autoServiceDuePreview()}`
                      : t("jobs.service_due_auto_hint")}
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={amcContract}
                  onChange={(e) => setAmcContract(e.target.checked)}
                />
                {t("jobs.amc")}
              </label>
              <input
                placeholder={t("jobs.job_notes")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="sm:col-span-2 rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
              >
                {editing ? t("jobs.update_job") : t("jobs.create")}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  {t("common.cancel")}
                </button>
              )}
            </div>
          </form>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setTypeFilter("all")}
            className={`rounded-full px-3 py-1 text-xs ${typeFilter === "all" ? "bg-slate-800 text-white" : "bg-white border"}`}
          >
            {t("jobs.all_types")}
          </button>
          {AC_JOB_TYPES.map((tpe) => (
            <button
              key={tpe.value}
              onClick={() => setTypeFilter(tpe.value)}
              className={`rounded-full px-3 py-1 text-xs ${typeFilter === tpe.value ? "bg-slate-800 text-white" : "bg-white border"}`}
            >
              {locale === "si" ? tpe.labelSi : tpe.labelEn}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 text-xs ${filter === "all" ? "bg-teal-700 text-white" : "bg-white border"}`}
          >
            {t("jobs.all")} ({data.acJobs.length})
          </button>
          {AC_JOB_STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilter(s.value)}
              className={`rounded-full px-3 py-1 text-xs ${filter === s.value ? "bg-teal-700 text-white" : "bg-white border"}`}
            >
              {locale === "si" ? s.labelSi : s.labelEn}
            </button>
          ))}
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white p-10 text-center text-slate-500">
            {t("jobs.no_jobs")}. {t("jobs.no_jobs_hint")}
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const balance = job.quotedAmount - job.depositAmount;
              return (
                <div
                  key={job.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-slate-400">
                        {job.jobNo}
                      </p>
                      <p className="font-semibold text-slate-900">
                        {job.customerName}
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {jobTypeLabel(job.jobType ?? "installation", locale)}
                        </span>
                      </p>
                      {job.assignedTechnician && (
                        <p className="text-xs text-violet-700">
                          {t("jobs.technician")}: {job.assignedTechnician}
                        </p>
                      )}
                      <p className="text-sm text-slate-500">{job.address}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {job.description}
                        {job.btu && ` · ${job.btu} BTU`}
                        {job.pipeMeters != null && ` · ${job.pipeMeters}m pipe`}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">
                      {jobStatusLabel(job.status, locale)}
                      {job.amcContract && " · AMC"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                    <span>{t("jobs.quote_label")}: {formatLkr(job.quotedAmount)}</span>
                    <span>{t("jobs.deposit_label")}: {formatLkr(job.depositAmount)}</span>
                    <span className="font-medium text-slate-800">
                      {t("jobs.balance_label")}: {formatLkr(balance)}
                    </span>
                    {job.scheduledDate && (
                      <span>{t("jobs.install_label")}: {job.scheduledDate}</span>
                    )}
                    {job.serviceDueDate && (
                      <span
                        className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${serviceDueUrgencyClass(
                          serviceDueUrgency(job.serviceDueDate),
                        )}`}
                      >
                        {t("jobs.service_due_label")}: {job.serviceDueDate} (
                        {serviceDueLabel(job.serviceDueDate, locale)})
                        {job.serviceDueManual && (
                          <span className="ml-1 opacity-75">
                            · {t("jobs.service_due_manual_short")}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.phone && (
                      <MessageSendButton
                        phone={job.phone}
                        recipientName={job.customerName}
                        context={{ type: "ac_job", job, business: data.business }}
                        defaultTemplate={defaultTemplateForJob(job.status)}
                        contextId={job.id}
                      />
                    )}
                    {canMarkServiceDone(job) && (
                        <button
                          type="button"
                          onClick={() => setServiceDoneJob(job)}
                          className="rounded-lg border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800"
                        >
                          {t("jobs.service_done")}
                        </button>
                      )}
                    <button
                      onClick={() => loadJob(job)}
                      className="text-sm text-teal-700 hover:underline"
                    >
                      {t("common.edit")}
                    </button>
                    {job.status === "deposit_received" && (
                      <button
                        onClick={() => {
                          updateACJob(job.id, { status: "scheduled" });
                          maybePromptMessage(job, "scheduled");
                        }}
                        className="text-sm text-teal-700 hover:underline"
                      >
                        {t("jobs.schedule")}
                      </button>
                    )}
                    {job.status === "scheduled" && (
                      <button
                        onClick={() => {
                          updateACJob(job.id, {
                            status: "installed",
                            installedDate: new Date()
                              .toISOString()
                              .slice(0, 10),
                          });
                          maybePromptMessage(job, "installed");
                        }}
                        className="text-sm text-teal-700 hover:underline"
                      >
                        {t("jobs.mark_installed")}
                      </button>
                    )}
                    {job.status === "installed" && (
                      <button
                        onClick={() => {
                          updateACJob(job.id, { status: "completed" });
                          maybePromptMessage(job, "completed");
                        }}
                        className="text-sm text-teal-700 hover:underline"
                      >
                        {t("jobs.complete")}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`${t("jobs.delete_confirm")} ${job.jobNo}?`)) {
                          deleteACJob(job.id);
                        }
                      }}
                      className="text-sm text-red-600 hover:underline"
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {promptJob && (
        <MessageComposer
          open
          onClose={() => setPromptJob(null)}
          phone={promptJob.phone}
          recipientName={promptJob.customerName}
          context={{
            type: "ac_job",
            job: promptJob,
            business: data.business,
          }}
          defaultTemplate={defaultTemplateForJob(promptJob.status)}
          contextId={promptJob.id}
        />
      )}

      <AcServiceDoneDialog
        job={serviceDoneJob}
        business={data.business}
        open={!!serviceDoneJob}
        onClose={() => setServiceDoneJob(null)}
        onConfirm={(input) => {
          if (serviceDoneJob) {
            recordACService(serviceDoneJob.id, input);
            setMessage(t("jobs.service_done_saved"));
            setTimeout(() => setMessage(""), 2500);
          }
        }}
      />
    </div>
  );
}
