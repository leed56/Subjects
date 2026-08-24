"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProLoadingState, ProMain } from "@/components/ui/pro-shell";
import { Dialog, Drawer, DrawerFooter } from "@/components/ui/overlay";
import {
  ActionMenu,
  AlertRow,
  Button,
  EmptyState,
  MetricCard,
  PageHeader,
  StatusBadge,
  Tabs,
} from "@/components/ui/primitives";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { ExpenseIcon, SuppliersIcon, WorkforceIcon } from "@/components/ui/icons";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { WriteDisabledHint } from "@/components/write-disabled-hint";
import { useWriteAccess } from "@/lib/subscription/use-can-write";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import type {
  Contractor,
  ContractorPayment,
  ContractorRateType,
  Technician,
  WorkSpecialty,
} from "@/lib/store/types";
import type { PaymentMethod } from "@/lib/types";

const SPECIALTIES: WorkSpecialty[] = ["installation", "service", "repair"];
const RATE_TYPES: ContractorRateType[] = ["per_job", "per_unit", "per_meter", "fixed"];
const PAY_METHODS: PaymentMethod[] = ["cash", "bank_transfer", "cheque", "card"];

type WorkforceSection = "team" | "contractors" | "payouts";

function SpecialtyPicker({
  value,
  onChange,
  labels,
}: {
  value: WorkSpecialty[];
  onChange: (next: WorkSpecialty[]) => void;
  labels: Record<WorkSpecialty, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SPECIALTIES.map((specialty) => {
        const selected = value.includes(specialty);
        return (
          <button
            key={specialty}
            type="button"
            aria-pressed={selected}
            onClick={() =>
              onChange(
                selected
                  ? value.filter((item) => item !== specialty)
                  : [...value, specialty],
              )
            }
            className={`min-h-10 rounded-xl border px-3.5 py-2 text-sm font-medium transition focus:outline-none focus:ring-4 focus:ring-teal-100 ${
              selected
                ? "border-teal-600 bg-teal-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50/40"
            }`}
          >
            {labels[specialty]}
          </button>
        );
      })}
    </div>
  );
}

export default function WorkforcePageV2() {
  const {
    data,
    ready,
    saveTechnicianToCloud,
    updateTechnicianToCloud,
    deleteTechnicianToCloud,
    saveContractorToCloud,
    updateContractorToCloud,
    deleteContractorToCloud,
    recordContractorPaymentToCloud,
  } = useAppStore();
  const { t } = useLocale();
  const { canWrite, disabledHint } = useWriteAccess();
  const { canSeeFinancials } = useSubscription();

  const [activeSection, setActiveSection] = useState<WorkforceSection>("team");
  const [formMessage, setFormMessage] = useState("");

  const [showTechModal, setShowTechModal] = useState(false);
  const [techName, setTechName] = useState("");
  const [techPhone, setTechPhone] = useState("");
  const [techSpecs, setTechSpecs] = useState<WorkSpecialty[]>([]);
  const [techHourlyRate, setTechHourlyRate] = useState("");
  const [savingTech, setSavingTech] = useState(false);

  const [showConModal, setShowConModal] = useState(false);
  const [conName, setConName] = useState("");
  const [conCompany, setConCompany] = useState("");
  const [conPhone, setConPhone] = useState("");
  const [conSpecs, setConSpecs] = useState<WorkSpecialty[]>([]);
  const [conRateType, setConRateType] = useState<ContractorRateType>("per_job");
  const [conRate, setConRate] = useState(0);
  const [savingCon, setSavingCon] = useState(false);

  const [payContractor, setPayContractor] = useState<Contractor | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [payNote, setPayNote] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [payMessage, setPayMessage] = useState("");

  const [updatingTechId, setUpdatingTechId] = useState<string | null>(null);
  const [deletingTechId, setDeletingTechId] = useState<string | null>(null);
  const [updatingConId, setUpdatingConId] = useState<string | null>(null);
  const [deletingConId, setDeletingConId] = useState<string | null>(null);

  const specialtyLabels: Record<WorkSpecialty, string> = {
    installation: t("work.spec.installation"),
    service: t("work.spec.service"),
    repair: t("work.spec.repair"),
  };

  const rateLabels: Record<ContractorRateType, string> = {
    per_job: t("work.rate.per_job"),
    per_unit: t("work.rate.per_unit"),
    per_meter: t("work.rate.per_meter"),
    fixed: t("work.rate.fixed"),
  };

  if (!ready || !data) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  const activeContractors = data.contractors.filter((contractor) => contractor.active);
  const outstandingPayout = data.contractors.reduce(
    (sum, contractor) => sum + contractor.payableBalance,
    0,
  );

  const contractorJobStats = (id: string) => {
    const jobs = data.acJobs.filter(
      (job) =>
        job.assigneeType === "contractor" &&
        job.assigneeId === id &&
        job.status === "completed",
    );
    const revenue = jobs.reduce((sum, job) => sum + job.quotedAmount, 0);
    const cost = jobs.reduce((sum, job) => sum + (job.subcontractCost ?? 0), 0);
    return { count: jobs.length, margin: revenue - cost };
  };

  const resetTechForm = () => {
    setTechName("");
    setTechPhone("");
    setTechSpecs([]);
    setTechHourlyRate("");
    setFormMessage("");
  };

  const resetConForm = () => {
    setConName("");
    setConCompany("");
    setConPhone("");
    setConSpecs([]);
    setConRateType("per_job");
    setConRate(0);
    setFormMessage("");
  };

  const openTechModal = () => {
    if (!canWrite) {
      setFormMessage(t("sub.read_only"));
      return;
    }
    resetTechForm();
    setShowConModal(false);
    setShowTechModal(true);
  };

  const openConModal = () => {
    if (!canWrite) {
      setFormMessage(t("sub.read_only"));
      return;
    }
    resetConForm();
    setShowTechModal(false);
    setShowConModal(true);
  };

  const toggleTechnician = async (technician: Technician) => {
    if (updatingTechId || deletingTechId || !canWrite) return;
    setUpdatingTechId(technician.id);
    setFormMessage("");
    const result = await updateTechnicianToCloud(technician.id, {
      active: !technician.active,
    });
    setUpdatingTechId(null);
    if (!result.ok) setFormMessage(result.error ?? t("common.save_failed"));
  };

  const deleteTechnician = async (technician: Technician) => {
    if (updatingTechId || deletingTechId || !canWrite || !confirm(t("work.delete_tech"))) {
      return;
    }
    setDeletingTechId(technician.id);
    setFormMessage("");
    const result = await deleteTechnicianToCloud(technician.id);
    setDeletingTechId(null);
    if (!result.ok) setFormMessage(result.error ?? t("common.save_failed"));
  };

  const toggleContractor = async (contractor: Contractor) => {
    if (updatingConId || deletingConId || !canWrite) return;
    setUpdatingConId(contractor.id);
    setFormMessage("");
    const result = await updateContractorToCloud(contractor.id, {
      active: !contractor.active,
    });
    setUpdatingConId(null);
    if (!result.ok) setFormMessage(result.error ?? t("common.save_failed"));
  };

  const deleteContractor = async (contractor: Contractor) => {
    if (
      updatingConId ||
      deletingConId ||
      !canWrite ||
      !confirm(t("work.delete_contractor"))
    ) {
      return;
    }
    setDeletingConId(contractor.id);
    setFormMessage("");
    const result = await deleteContractorToCloud(contractor.id);
    setDeletingConId(null);
    if (!result.ok) setFormMessage(result.error ?? t("common.save_failed"));
  };

  const openPayment = (contractor: Contractor) => {
    if (!canWrite || !canSeeFinancials || contractor.payableBalance <= 0) return;
    setPayContractor(contractor);
    setPayAmount(contractor.payableBalance);
    setPayMethod("cash");
    setPayNote("");
    setPayMessage("");
  };

  const methodLabel = (method: PaymentMethod) => t(`work.method.${method}`);

  const teamColumns: DataTableColumn<Technician>[] = [
    {
      key: "member",
      header: t("work.team"),
      render: (technician) => (
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-sm font-semibold text-teal-700 ring-1 ring-inset ring-teal-100">
              {technician.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-950">{technician.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{technician.phone || "—"}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "specialties",
      header: t("work.specialties"),
      render: (technician) =>
        technician.specialties.length > 0 ? (
          <span className="text-slate-600">
            {technician.specialties.map((specialty) => specialtyLabels[specialty]).join(" · ")}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
      hideOnMobile: true,
    },
    ...(canSeeFinancials
      ? [
          {
            key: "rate",
            header: t("work.hourly_rate"),
            align: "right" as const,
            render: (technician: Technician) => (
              <span className="font-mono font-semibold tabular-nums text-slate-700">
                {technician.hourlyRate ? formatLkr(technician.hourlyRate) : "—"}
              </span>
            ),
            hideOnMobile: true,
          },
        ]
      : []),
    {
      key: "status",
      header: t("common.status"),
      render: (technician) => (
        <StatusBadge tone={technician.active ? "positive" : "neutral"}>
          {technician.active ? t("work.active") : t("work.inactive")}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (technician) => (
        <ActionMenu
          label={t("common.actions")}
          items={[
            {
              label:
                updatingTechId === technician.id
                  ? t("common.saving")
                  : technician.active
                    ? t("work.deactivate")
                    : t("work.activate"),
              onSelect: () => void toggleTechnician(technician),
              disabled: !canWrite || Boolean(updatingTechId || deletingTechId),
            },
            {
              label:
                deletingTechId === technician.id ? t("common.saving") : t("common.delete"),
              onSelect: () => void deleteTechnician(technician),
              tone: "danger",
              disabled: !canWrite || Boolean(updatingTechId || deletingTechId),
            },
          ]}
        />
      ),
    },
  ];

  const contractorColumns: DataTableColumn<Contractor>[] = [
    {
      key: "contractor",
      header: t("work.contractors"),
      render: (contractor) => (
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-sm font-semibold text-amber-700 ring-1 ring-inset ring-amber-100">
              {contractor.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-950">{contractor.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {[contractor.company, contractor.phone].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "specialties",
      header: t("work.specialties"),
      render: (contractor) => (
        <span className="text-slate-600">
          {contractor.specialties.length > 0
            ? contractor.specialties
                .map((specialty) => specialtyLabels[specialty])
                .join(" · ")
            : "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    ...(canSeeFinancials
      ? [
          {
            key: "rate",
            header: t("work.rate"),
            render: (contractor: Contractor) => (
              <span className="text-slate-700">
                {contractor.rateAmount > 0
                  ? `${formatLkr(contractor.rateAmount)} · ${rateLabels[contractor.rateType]}`
                  : "—"}
              </span>
            ),
            hideOnMobile: true,
          },
          {
            key: "payable",
            header: t("work.payable"),
            align: "right" as const,
            render: (contractor: Contractor) => (
              <span
                className={`font-mono font-semibold tabular-nums ${
                  contractor.payableBalance > 0 ? "text-rose-600" : "text-slate-500"
                }`}
              >
                {formatLkr(contractor.payableBalance)}
              </span>
            ),
          },
          {
            key: "performance",
            header: t("work.jobs_done"),
            render: (contractor: Contractor) => {
              const stats = contractorJobStats(contractor.id);
              return (
                <span className="text-slate-600">
                  {stats.count} · {t("work.margin")} {formatLkr(stats.margin)}
                </span>
              );
            },
            hideOnMobile: true,
          },
        ]
      : []),
    {
      key: "status",
      header: t("common.status"),
      render: (contractor) => (
        <StatusBadge tone={contractor.active ? "positive" : "neutral"}>
          {contractor.active ? t("work.active") : t("work.inactive")}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (contractor) => (
        <ActionMenu
          label={t("common.actions")}
          items={[
            ...(canSeeFinancials && contractor.payableBalance > 0
              ? [
                  {
                    label: t("work.pay"),
                    onSelect: () => openPayment(contractor),
                    disabled: !canWrite,
                  },
                ]
              : []),
            {
              label:
                updatingConId === contractor.id
                  ? t("common.saving")
                  : contractor.active
                    ? t("work.deactivate")
                    : t("work.activate"),
              onSelect: () => void toggleContractor(contractor),
              disabled: !canWrite || Boolean(updatingConId || deletingConId),
            },
            {
              label:
                deletingConId === contractor.id ? t("common.saving") : t("common.delete"),
              onSelect: () => void deleteContractor(contractor),
              tone: "danger" as const,
              disabled: !canWrite || Boolean(updatingConId || deletingConId),
            },
          ]}
        />
      ),
    },
  ];

  const payoutColumns: DataTableColumn<ContractorPayment>[] = [
    {
      key: "contractor",
      header: t("work.contractors"),
      render: (payment) => (
        <div>
          <p className="font-semibold text-slate-950">{payment.contractorName}</p>
          <p className="mt-1 text-xs text-slate-500">{payment.date.slice(0, 10)}</p>
        </div>
      ),
    },
    {
      key: "date",
      header: t("common.date"),
      render: (payment) => <span className="text-slate-600">{payment.date.slice(0, 10)}</span>,
      hideOnMobile: true,
    },
    {
      key: "method",
      header: t("work.method"),
      render: (payment) => <span className="text-slate-600">{methodLabel(payment.method)}</span>,
      hideOnMobile: true,
    },
    {
      key: "amount",
      header: t("bank.amount"),
      align: "right",
      render: (payment) => (
        <span className="font-mono font-semibold tabular-nums text-emerald-700">
          {formatLkr(payment.amount)}
        </span>
      ),
    },
  ];

  const inputClass =
    "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-100/70";

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={t("work.title")}
          description={t("work.subtitle")}
          actions={
            <>
              <Button
                variant="secondary"
                onClick={openTechModal}
                disabled={!canWrite}
                title={!canWrite ? (disabledHint ?? undefined) : undefined}
              >
                {t("work.add_tech")}
              </Button>
              <Button
                variant="primary"
                onClick={openConModal}
                disabled={!canWrite}
                title={!canWrite ? (disabledHint ?? undefined) : undefined}
              >
                {t("work.add_contractor")}
              </Button>
            </>
          }
          metrics={
            <div className={`grid gap-3 sm:grid-cols-2 ${canSeeFinancials ? "xl:grid-cols-3" : ""}`}>
              <MetricCard
                label={t("work.team")}
                value={String(data.technicians.length)}
                icon={<WorkforceIcon className="h-4.5 w-4.5" />}
              />
              <MetricCard
                label={t("work.contractors")}
                value={String(activeContractors.length)}
                icon={<SuppliersIcon className="h-4.5 w-4.5" />}
              />
              {canSeeFinancials && (
                <MetricCard
                  label={t("work.outstanding_payout")}
                  value={formatLkr(outstandingPayout)}
                  icon={<ExpenseIcon className="h-4.5 w-4.5" />}
                  tone={outstandingPayout > 0 ? "warning" : "default"}
                />
              )}
            </div>
          }
        />

        <WriteDisabledHint className="mb-5" />

        {formMessage && !showTechModal && !showConModal && (
          <div className="mb-5">
            <AlertRow tone="warning">{formMessage}</AlertRow>
          </div>
        )}

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={activeSection}
            onChange={(value) => setActiveSection(value as WorkforceSection)}
            tabs={[
              { value: "team", label: t("work.team") },
              { value: "contractors", label: t("work.contractors") },
              ...(canSeeFinancials ? [{ value: "payouts", label: t("work.payouts") }] : []),
            ]}
          />
          <p className="text-xs font-medium text-slate-400">
            {activeSection === "team" && `${data.technicians.length} ${t("work.team")}`}
            {activeSection === "contractors" &&
              `${data.contractors.length} ${t("work.contractors")}`}
            {activeSection === "payouts" &&
              `${data.contractorPayments.length} ${t("work.payouts")}`}
          </p>
        </div>

        {activeSection === "team" && (
          <DataTable
            columns={teamColumns}
            rows={data.technicians}
            emptyState={
              <EmptyState
                size="compact"
                icon={<WorkforceIcon className="h-5 w-5" />}
                title={t("work.no_team")}
                description={t("work.team_hint")}
                action={
                  canWrite ? (
                    <Button variant="primary" onClick={openTechModal}>
                      {t("work.add_tech")}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        )}

        {activeSection === "contractors" && (
          <DataTable
            columns={contractorColumns}
            rows={data.contractors}
            emptyState={
              <EmptyState
                size="compact"
                icon={<SuppliersIcon className="h-5 w-5" />}
                title={t("work.no_contractors")}
                description={t("work.contractor_hint")}
                action={
                  canWrite ? (
                    <Button variant="primary" onClick={openConModal}>
                      {t("work.add_contractor")}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        )}

        {activeSection === "payouts" && canSeeFinancials && (
          <DataTable
            columns={payoutColumns}
            rows={data.contractorPayments.slice(0, 20)}
            emptyState={
              <EmptyState
                size="compact"
                icon={<ExpenseIcon className="h-5 w-5" />}
                title={t("work.payouts")}
                description={t("work.owed_contractors")}
              />
            }
          />
        )}
      </ProMain>

      <Drawer
        open={showTechModal}
        onClose={() => {
          setShowTechModal(false);
          resetTechForm();
        }}
        title={t("work.add_tech_title")}
        description={t("work.in_house")}
        size="md"
        footer={
          <DrawerFooter
            onCancel={() => {
              setShowTechModal(false);
              resetTechForm();
            }}
            cancelLabel={t("common.cancel")}
            primaryLabel={savingTech ? t("common.saving") : t("common.save")}
            primaryType="submit"
            primaryForm="workforce-technician-form"
            primaryDisabled={savingTech}
          />
        }
      >
        <form
          id="workforce-technician-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (savingTech) return;
            setSavingTech(true);
            setFormMessage("");
            const result = await saveTechnicianToCloud({
              name: techName,
              phone: techPhone,
              specialties: techSpecs,
              hourlyRate:
                canSeeFinancials && techHourlyRate
                  ? Number(techHourlyRate) || undefined
                  : undefined,
            });
            setSavingTech(false);
            if (!result.ok) {
              setFormMessage(result.error ?? t("sub.read_only"));
              return;
            }
            setShowTechModal(false);
            resetTechForm();
            setActiveSection("team");
          }}
        >
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              {t("work.name")}
              <input
                required
                value={techName}
                onChange={(event) => setTechName(event.target.value)}
                className={`${inputClass} mt-1.5`}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t("work.phone")}
              <input
                value={techPhone}
                onChange={(event) => setTechPhone(event.target.value)}
                className={`${inputClass} mt-1.5`}
              />
            </label>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">{t("work.specialties")}</p>
              <SpecialtyPicker value={techSpecs} onChange={setTechSpecs} labels={specialtyLabels} />
            </div>
            {canSeeFinancials && (
              <label className="block text-sm font-medium text-slate-700">
                {t("work.hourly_rate")}
                <input
                  type="number"
                  min={0}
                  placeholder={t("work.hourly_rate_ph")}
                  value={techHourlyRate}
                  onChange={(event) => setTechHourlyRate(event.target.value)}
                  className={`${inputClass} mt-1.5`}
                />
              </label>
            )}
            {formMessage && showTechModal && <AlertRow tone="warning">{formMessage}</AlertRow>}
          </div>
        </form>
      </Drawer>

      <Drawer
        open={showConModal}
        onClose={() => {
          setShowConModal(false);
          resetConForm();
        }}
        title={t("work.add_contractor_title")}
        description={t("work.subcontractors")}
        size="lg"
        footer={
          <DrawerFooter
            onCancel={() => {
              setShowConModal(false);
              resetConForm();
            }}
            cancelLabel={t("common.cancel")}
            primaryLabel={savingCon ? t("common.saving") : t("common.save")}
            primaryType="submit"
            primaryForm="workforce-contractor-form"
            primaryDisabled={savingCon}
          />
        }
      >
        <form
          id="workforce-contractor-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (savingCon) return;
            setSavingCon(true);
            setFormMessage("");
            const result = await saveContractorToCloud({
              name: conName,
              company: conCompany,
              phone: conPhone,
              specialties: conSpecs,
              rateType: conRateType,
              rateAmount: conRate,
            });
            setSavingCon(false);
            if (!result.ok) {
              setFormMessage(result.error ?? t("sub.read_only"));
              return;
            }
            setShowConModal(false);
            resetConForm();
            setActiveSection("contractors");
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              {t("work.name")}
              <input
                required
                value={conName}
                onChange={(event) => setConName(event.target.value)}
                className={`${inputClass} mt-1.5`}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t("work.company")}
              <input
                value={conCompany}
                onChange={(event) => setConCompany(event.target.value)}
                className={`${inputClass} mt-1.5`}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t("work.phone")}
              <input
                value={conPhone}
                onChange={(event) => setConPhone(event.target.value)}
                className={`${inputClass} mt-1.5`}
              />
            </label>
            {canSeeFinancials && (
              <label className="block text-sm font-medium text-slate-700">
                {t("work.rate")}
                <select
                  value={conRateType}
                  onChange={(event) => setConRateType(event.target.value as ContractorRateType)}
                  className={`${inputClass} mt-1.5`}
                >
                  {RATE_TYPES.map((rateType) => (
                    <option key={rateType} value={rateType}>
                      {rateLabels[rateType]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {canSeeFinancials && (
              <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
                {t("work.rate_amount")}
                <input
                  type="number"
                  min={0}
                  value={conRate || ""}
                  onChange={(event) => setConRate(Number(event.target.value))}
                  className={`${inputClass} mt-1.5`}
                />
              </label>
            )}
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium text-slate-700">{t("work.specialties")}</p>
              <SpecialtyPicker value={conSpecs} onChange={setConSpecs} labels={specialtyLabels} />
            </div>
            {formMessage && showConModal && (
              <div className="sm:col-span-2">
                <AlertRow tone="warning">{formMessage}</AlertRow>
              </div>
            )}
          </div>
        </form>
      </Drawer>

      <Dialog
        open={Boolean(payContractor)}
        onClose={() => setPayContractor(null)}
        title={payContractor?.name ?? t("work.pay")}
        description={
          payContractor
            ? `${t("work.payable")}: ${formatLkr(payContractor.payableBalance)}`
            : undefined
        }
        size="md"
        footer={
          <DrawerFooter
            onCancel={() => setPayContractor(null)}
            cancelLabel={t("common.cancel")}
            primaryLabel={savingPayment ? t("common.saving") : t("work.record_payout")}
            primaryType="submit"
            primaryForm="workforce-payment-form"
            primaryDisabled={savingPayment || payAmount <= 0}
          />
        }
      >
        <form
          id="workforce-payment-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!payContractor || savingPayment || payAmount <= 0) return;
            setSavingPayment(true);
            setPayMessage("");
            const result = await recordContractorPaymentToCloud(
              payContractor.id,
              payAmount,
              payMethod,
              payNote,
            );
            setSavingPayment(false);
            if (!result.ok) {
              setPayMessage(result.error ?? t("common.save_failed"));
              return;
            }
            setPayContractor(null);
            setActiveSection("payouts");
          }}
        >
          <div className="space-y-4">
            {payMessage && <AlertRow tone="danger">{payMessage}</AlertRow>}
            <label className="block text-sm font-medium text-slate-700">
              {t("bank.amount")}
              <input
                type="number"
                required
                min={1}
                value={payAmount || ""}
                onChange={(event) => setPayAmount(Number(event.target.value))}
                className={`${inputClass} mt-1.5`}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t("work.method")}
              <select
                value={payMethod}
                onChange={(event) => setPayMethod(event.target.value as PaymentMethod)}
                className={`${inputClass} mt-1.5`}
              >
                {PAY_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {methodLabel(method)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t("work.note")}
              <input
                value={payNote}
                onChange={(event) => setPayNote(event.target.value)}
                className={`${inputClass} mt-1.5`}
              />
            </label>
          </div>
        </form>
      </Dialog>
    </AppShell>
  );
}
