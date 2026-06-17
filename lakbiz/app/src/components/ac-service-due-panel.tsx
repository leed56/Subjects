"use client";

import Link from "next/link";
import { MessageSendButton } from "@/components/messaging/message-send-button";
import { serviceDueLabel } from "@/lib/ac-service";
import type { BusinessInfo } from "@/lib/invoice";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { ACJob } from "@/lib/store/types";

type AcServiceDuePanelProps = {
  jobs: ACJob[];
  business: BusinessInfo;
  overdueCount: number;
  onServiceDone?: (jobId: string) => void;
};

export function AcServiceDuePanel({
  jobs,
  business,
  overdueCount,
  onServiceDone,
}: AcServiceDuePanelProps) {
  const { t, locale } = useLocale();

  if (jobs.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-teal-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-cyan-950">
            {jobs.length} {t("jobs.service_due_week")}
          </p>
          {overdueCount > 0 && (
            <p className="text-sm text-red-700">
              {overdueCount} {t("jobs.service_overdue")}
            </p>
          )}
        </div>
        <Link href="/jobs" className="text-sm font-medium text-cyan-800 underline">
          {t("dash.view_jobs")}
        </Link>
      </div>
      <ul className="mt-3 space-y-2">
        {jobs.map((job) => (
          <li
            key={job.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{job.customerName}</p>
              <p className="truncate text-xs text-slate-500">
                {job.jobNo} · {job.address}
              </p>
              <p className="text-xs font-medium text-cyan-800">
                {job.serviceDueDate} —{" "}
                {serviceDueLabel(job.serviceDueDate, locale)}
                {job.amcContract && (
                  <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-violet-700">
                    AMC
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {job.phone && (
                <MessageSendButton
                  phone={job.phone}
                  recipientName={job.customerName}
                  context={{ type: "ac_job", job, business }}
                  defaultTemplate="job_service_due"
                  contextId={job.id}
                />
              )}
              {onServiceDone && (
                <button
                  type="button"
                  onClick={() => onServiceDone(job.id)}
                  className="rounded-lg border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100"
                >
                  {t("jobs.service_done")}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
