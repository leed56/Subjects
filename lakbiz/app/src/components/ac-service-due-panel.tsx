"use client";

import Link from "next/link";
import { MessageSendButton } from "@/components/messaging/message-send-button";
import {
  serviceDueLabel,
  serviceDueUrgency,
  serviceDueUrgencyClass,
} from "@/lib/ac-service";
import type { BusinessInfo } from "@/lib/invoice";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { ACJob } from "@/lib/store/types";

type AcServiceDuePanelProps = {
  dueTodayJobs?: ACJob[];
  upcomingJobs: ACJob[];
  business: BusinessInfo;
  overdueCount: number;
  onServiceDone?: (job: ACJob) => void;
};

function JobRow({
  job,
  business,
  onServiceDone,
  highlight,
}: {
  job: ACJob;
  business: BusinessInfo;
  onServiceDone?: (job: ACJob) => void;
  highlight?: "today" | "default";
}) {
  const { t, locale } = useLocale();
  const urgency = serviceDueUrgency(job.serviceDueDate);
  const template =
    urgency === "today" ? "job_service_due_today" : "job_service_due";

  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
        highlight === "today"
          ? "border border-amber-300 bg-amber-50"
          : "bg-white/80"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900">{job.customerName}</p>
        <p className="truncate text-xs text-slate-500">
          {job.jobNo} · {job.address}
          {job.assignedTechnician && ` · ${job.assignedTechnician}`}
        </p>
        {job.serviceDueDate && (
          <p
            className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${serviceDueUrgencyClass(urgency)}`}
          >
            {job.serviceDueDate} — {serviceDueLabel(job.serviceDueDate, locale)}
            {job.amcContract && (
              <span className="ml-2 rounded bg-violet-100 px-1.5 text-violet-700">
                AMC
              </span>
            )}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {job.phone && (
          <MessageSendButton
            phone={job.phone}
            recipientName={job.customerName}
            context={{ type: "ac_job", job, business }}
            defaultTemplate={template}
            contextId={job.id}
          />
        )}
        {onServiceDone && (
          <button
            type="button"
            onClick={() => onServiceDone(job)}
            className="rounded-lg border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100"
          >
            {t("jobs.service_done")}
          </button>
        )}
      </div>
    </li>
  );
}

export function AcServiceDuePanel({
  dueTodayJobs = [],
  upcomingJobs,
  business,
  overdueCount,
  onServiceDone,
}: AcServiceDuePanelProps) {
  const { t } = useLocale();

  if (dueTodayJobs.length === 0 && upcomingJobs.length === 0) return null;

  return (
    <div className="mt-4 space-y-4">
      {dueTodayJobs.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-amber-950">
                {dueTodayJobs.length} {t("jobs.service_due_today_title")}
              </p>
              <p className="text-sm text-amber-800">
                {t("jobs.service_due_today_hint")}
              </p>
            </div>
            <Link
              href="/jobs"
              className="text-sm font-medium text-amber-900 underline"
            >
              {t("dash.view_jobs")}
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {dueTodayJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                business={business}
                onServiceDone={onServiceDone}
                highlight="today"
              />
            ))}
          </ul>
        </div>
      )}

      {upcomingJobs.length > 0 && (
        <div className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-teal-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-cyan-950">
                {upcomingJobs.length} {t("jobs.service_due_week")}
              </p>
              {overdueCount > 0 && (
                <p className="text-sm text-red-700">
                  {overdueCount} {t("jobs.service_overdue")}
                </p>
              )}
            </div>
            <Link
              href="/jobs"
              className="text-sm font-medium text-cyan-800 underline"
            >
              {t("dash.view_jobs")}
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {upcomingJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                business={business}
                onServiceDone={onServiceDone}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
