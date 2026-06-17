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
import { serviceDueLabel } from "@/lib/ac-service";

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
  const [message, setMessage] = useState("");
  const [promptJob, setPromptJob] = useState<ACJob | null>(null);

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
  const [serviceIntervalMonths, setServiceIntervalMonths] = useState(6);
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
    setServiceIntervalMonths(6);
    setAmcContract(false);
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
    setServiceIntervalMonths(job.serviceIntervalMonths ?? 6);
    setAmcContract(job.amcContract ?? false);
    setNotes(job.notes ?? "");
    setShowForm(true);
  };

  const buildInput = () => ({
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
    serviceIntervalMonths,
    amcContract,
    installedDate:
      status === "installed" && !editing?.installedDate
        ? new Date().toISOString().slice(0, 10)
        : editing?.installedDate,
    notes,
  });

  const jobs =
    filter === "all"
      ? data.acJobs
      : data.acJobs.filter((j) => j.status === filter);

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
              {editing ? `${t("jobs.edit_job")} ${editing.jobNo}` : t("jobs.new_job")}
            </h2>
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
              <input
                type="number"
                min={1}
                max={24}
                placeholder={t("jobs.service_interval")}
                value={serviceIntervalMonths}
                onChange={(e) => setServiceIntervalMonths(Number(e.target.value))}
                className="rounded-lg border px-3 py-2 text-sm"
              />
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
                      </p>
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
                      <span className="font-medium text-cyan-800">
                        {t("jobs.service_due_label")}: {job.serviceDueDate} (
                        {serviceDueLabel(job.serviceDueDate, locale)})
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
                    {(job.status === "service_due" ||
                      job.status === "installed") &&
                      job.serviceDueDate && (
                        <button
                          type="button"
                          onClick={() => recordACService(job.id)}
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
    </div>
  );
}
