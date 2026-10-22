"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProLoadingState } from "@/components/ui/pro-shell";
import { PageHeader, MetricCard, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/overlay";
import { FormField, DateInput, SelectInput } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { ChevronRightIcon, CheckIcon } from "@/components/ui/icons";
import { MessageSendButton } from "@/components/messaging/message-send-button";
import { CallLink, NavigateLink } from "@/components/ui/field-links";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ACJob } from "@/lib/store/types";
import { jobStatusClass, jobStatusLabel, type ACJobStatus } from "@/lib/ac-jobs";
import { jobTypeLabel } from "@/lib/ac-job-types";

/** Monday-based week start, module-level so it isn't recomputed inline
 * during render (matches the codebase's existing Date.now()-outside-render
 * convention from Phases 4/5). */
function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // shift Sunday back to the prior Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Reported/found in the HVAC screen sweep: this used to be an allowlist
// of exactly two statuses ("quote", "deposit_received"). Status and
// scheduledDate are two independent fields on the New/Edit Job form --
// nothing stops a job from reaching "scheduled"/"installed"/
// "service_due" with scheduledDate left blank (e.g. a same-day job
// where staff set status without ever touching the date field, or a
// service_due job whose next visit genuinely hasn't been booked yet --
// arguably the single most important case to keep visible here). Any
// such job was invisible on this entire page: not in a day column
// (jobsByDay only matches an exact scheduledDate) and not in the
// Unscheduled bucket (its status wasn't one of the two allowed). Now
// expressed as an exclusion instead of an allowlist -- any active,
// non-terminal job with no date -- so a future status can't silently
// fall through the same gap again. "completed" is excluded on purpose:
// a finished job doesn't need scheduling attention.
function needsScheduling(status: ACJobStatus): boolean {
  return status !== "cancelled" && status !== "completed";
}

export default function SchedulePage() {
  const { t, locale } = useLocale();
  const { org, orgRole } = useSubscription();
  const { data: localData, ready: localReady, updateACJobToCloud } = useAppStore();
  const { toast } = useToast();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState<ACJob | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [saving, setSaving] = useState(false);
  /** Set once a reschedule save succeeds — the drawer switches to a
   * confirmation view offering to notify the customer, instead of
   * closing immediately, so "was it saved?" and "should I tell them?"
   * aren't two separate trips into the drawer. */
  const [justRescheduled, setJustRescheduled] = useState<ACJob | null>(null);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  if (!org.isAuthenticated || !localReady || !localData) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  const technicianName = (id?: string) => (id ? localData.technicians.find((x) => x.id === id)?.name : undefined);
  const contractorName = (id?: string) => (id ? localData.contractors.find((x) => x.id === id)?.name : undefined);
  const assigneeName = (job: ACJob) => {
    if (job.assigneeType === "team") return technicianName(job.assigneeId);
    if (job.assigneeType === "contractor") return contractorName(job.assigneeId);
    return undefined;
  };

  const assigneeOptions = [
    { value: "", label: t("schedule.all_assignees") },
    ...localData.technicians.filter((x) => x.active).map((x) => ({ value: `team:${x.id}`, label: x.name })),
    ...localData.contractors.filter((x) => x.active).map((x) => ({ value: `contractor:${x.id}`, label: x.name })),
  ];

  const matchesAssignee = (job: ACJob) => {
    if (!assigneeFilter) return true;
    const [aType, aId] = assigneeFilter.split(":");
    return job.assigneeType === aType && job.assigneeId === aId;
  };

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const jobsByDay = days.map((day) => {
    const iso = toIsoDate(day);
    return {
      date: day,
      iso,
      jobs: localData.acJobs
        .filter((j) => j.scheduledDate === iso && j.status !== "cancelled")
        .filter(matchesAssignee),
    };
  });

  const unscheduled = localData.acJobs
    .filter((j) => !j.scheduledDate && needsScheduling(j.status))
    .filter(matchesAssignee);

  const weekTotal = jobsByDay.reduce((sum, d) => sum + d.jobs.length, 0);
  const todayCount = localData.acJobs.filter((j) => j.scheduledDate === todayIso && j.status !== "cancelled").length;

  const openReschedule = (job: ACJob) => {
    setRescheduleTarget(job);
    setRescheduleDate(job.scheduledDate ?? todayIso);
    setJustRescheduled(null);
  };

  const closeRescheduleDrawer = () => {
    setRescheduleTarget(null);
    setJustRescheduled(null);
  };

  const handleReschedule = async () => {
    if (!rescheduleTarget || saving) return;
    setSaving(true);
    const result = await updateACJobToCloud(rescheduleTarget.id, { scheduledDate: rescheduleDate || undefined });
    setSaving(false);
    if (!result.ok) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    toast({ tone: "success", title: t("schedule.rescheduled") });
    setJustRescheduled({ ...rescheduleTarget, scheduledDate: rescheduleDate || undefined });
  };

  const dayLabel = (d: Date) => d.toLocaleDateString(locale === "si" ? "si-LK" : "en-LK", { weekday: "short", day: "numeric", month: "short" });

  const canReschedule = orgRole === "owner" || orgRole === "manager" || orgRole === "data_entry";

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={t("schedule.title")}
          description={`${dayLabel(days[0])} – ${dayLabel(days[6])}`}
          actions={
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label={t("schedule.prev_week")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <ChevronRightIcon className="h-4 w-4 rotate-180" />
              </button>
              <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("schedule.this_week")}
              </button>
              <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label={t("schedule.next_week")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          }
          metrics={
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label={t("schedule.jobs_this_week")} value={String(weekTotal)} />
              <MetricCard label={t("schedule.today_count")} value={String(todayCount)} tone={todayCount > 0 ? "positive" : "default"} />
              <MetricCard label={t("schedule.unscheduled")} value={String(unscheduled.length)} tone={unscheduled.length > 0 ? "warning" : "default"} />
            </div>
          }
        />

        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-medium text-slate-600">{t("schedule.filter_assignee")}</span>
          <SelectInput value={assigneeFilter} onChange={setAssigneeFilter} options={assigneeOptions} className="w-56" />
        </div>

        {unscheduled.length > 0 && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-2 text-sm font-semibold text-amber-900">{t("schedule.unscheduled")} ({unscheduled.length})</p>
            <p className="mb-3 text-xs text-amber-800">{t("schedule.unscheduled_hint")}</p>
            <div className="flex flex-wrap gap-2">
              {unscheduled.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => canReschedule && openReschedule(j)}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-left text-xs shadow-sm hover:border-amber-400"
                >
                  <p className="font-semibold text-slate-900">{j.customerName}</p>
                  <p className="text-slate-500">{jobTypeLabel(j.jobType, locale)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {weekTotal === 0 ? (
          <EmptyState title={t("schedule.no_jobs_this_week")} description={t("schedule.no_jobs_hint")} />
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="grid grid-flow-col auto-cols-[minmax(200px,1fr)] gap-3">
              {jobsByDay.map(({ date, iso, jobs }) => (
                <div key={iso} className={`rounded-xl border p-3 ${iso === todayIso ? "border-teal-300 bg-teal-50/40" : "border-slate-200 bg-white"}`}>
                  <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${iso === todayIso ? "text-teal-700" : "text-slate-500"}`}>
                    {dayLabel(date)}
                  </p>
                  {jobs.length === 0 ? (
                    <p className="text-xs text-slate-400">{t("schedule.no_jobs_day")}</p>
                  ) : (
                    <div className="space-y-2">
                      {jobs.map((j) => (
                        <button
                          key={j.id}
                          type="button"
                          onClick={() => canReschedule && openReschedule(j)}
                          className="block w-full rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-sm hover:border-teal-300"
                        >
                          <p className="text-sm font-semibold text-slate-900">{j.customerName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{jobTypeLabel(j.jobType, locale)}</p>
                          {assigneeName(j) && <p className="mt-0.5 text-xs text-slate-500">{assigneeName(j)}</p>}
                          <span className={`mt-1.5 inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold ${jobStatusClass(j.status)}`}>
                            {jobStatusLabel(j.status, locale)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Drawer
          open={!!rescheduleTarget}
          onClose={closeRescheduleDrawer}
          title={t("schedule.reschedule")}
          description={rescheduleTarget?.customerName}
          footer={
            justRescheduled ? (
              <button
                type="button"
                onClick={closeRescheduleDrawer}
                className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
              >
                {t("common.close")}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button type="button" onClick={closeRescheduleDrawer} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleReschedule()}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? t("common.saving") : t("schedule.set_date")}
                </button>
              </div>
            )
          }
        >
          {justRescheduled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                <CheckIcon className="h-4 w-4 shrink-0" />
                <span>
                  {t("schedule.rescheduled_to")}{" "}
                  <strong>{justRescheduled.scheduledDate ? new Date(justRescheduled.scheduledDate).toLocaleDateString(locale === "si" ? "si-LK" : "en-LK") : t("schedule.no_date")}</strong>
                </span>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-600">{t("schedule.notify_customer_hint")}</p>
                <MessageSendButton
                  phone={justRescheduled.phone}
                  recipientName={justRescheduled.customerName}
                  context={{ type: "ac_job", job: justRescheduled, business: localData.business }}
                  defaultTemplate="job_scheduled"
                  contextId={justRescheduled.id}
                  variant="primary"
                  label={t("schedule.notify_customer")}
                />
              </div>
            </div>
          ) : (
            rescheduleTarget && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <StatusBadge>{jobStatusLabel(rescheduleTarget.status, locale)}</StatusBadge>
                  <span className="text-sm text-slate-600">{jobTypeLabel(rescheduleTarget.jobType, locale)}</span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">{rescheduleTarget.address}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {rescheduleTarget.phone && <CallLink phone={rescheduleTarget.phone} label={t("common.call")} />}
                    <NavigateLink address={rescheduleTarget.address} label={t("common.navigate")} />
                  </div>
                </div>
                <FormField label={t("schedule.new_date")}>
                  <DateInput value={rescheduleDate} onChange={setRescheduleDate} />
                </FormField>
              </div>
            )
          )}
        </Drawer>
      </ProMain>
    </AppShell>
  );
}
