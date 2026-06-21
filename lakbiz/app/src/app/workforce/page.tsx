"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import {
  ProBadge,
  ProCard,
  ProEmptyState,
  ProLoadingState,
  ProMain,
  ProPageHeader,
  ProPageShell,
  ProStatCard,
} from "@/components/ui/pro-shell";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import type {
  ContractorRateType,
  WorkSpecialty,
} from "@/lib/store/types";

const SPECIALTIES: WorkSpecialty[] = ["installation", "service", "repair"];
const RATE_TYPES: ContractorRateType[] = ["per_job", "per_unit", "per_meter", "fixed"];

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
      {SPECIALTIES.map((s) => {
        const on = value.includes(s);
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== s) : [...value, s])}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
              on
                ? "bg-teal-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200"
            }`}
          >
            {labels[s]}
          </button>
        );
      })}
    </div>
  );
}

export default function WorkforcePage() {
  const {
    data,
    ready,
    addTechnician,
    updateTechnician,
    deleteTechnician,
    addContractor,
    updateContractor,
    deleteContractor,
  } = useAppStore();
  const { t } = useLocale();

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

  const [showTechForm, setShowTechForm] = useState(false);
  const [techName, setTechName] = useState("");
  const [techPhone, setTechPhone] = useState("");
  const [techSpecs, setTechSpecs] = useState<WorkSpecialty[]>([]);

  const [showConForm, setShowConForm] = useState(false);
  const [conName, setConName] = useState("");
  const [conCompany, setConCompany] = useState("");
  const [conPhone, setConPhone] = useState("");
  const [conSpecs, setConSpecs] = useState<WorkSpecialty[]>([]);
  const [conRateType, setConRateType] = useState<ContractorRateType>("per_job");
  const [conRate, setConRate] = useState(0);

  if (!ready || !data) {
    return (
      <ProPageShell>
        <SiteHeader />
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </ProPageShell>
    );
  }

  const activeContractors = data.contractors.filter((c) => c.active);
  const outstandingPayout = data.contractors.reduce((s, c) => s + c.payableBalance, 0);

  return (
    <ProPageShell>
      <SiteHeader />
      <ProMain>
        <ProPageHeader
          eyebrow="AC workforce"
          title={t("work.title")}
          description={t("work.subtitle")}
          actions={
            <>
              <button
                onClick={() => setShowTechForm((v) => !v)}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm transition hover:border-teal-200 hover:text-teal-800 active:scale-[0.98]"
              >
                {t("work.add_tech")}
              </button>
              <button
                onClick={() => setShowConForm((v) => !v)}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-700 active:scale-[0.98]"
              >
                {t("work.add_contractor")}
              </button>
            </>
          }
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProStatCard label={t("work.team")} value={String(data.technicians.length)} hint={t("work.in_house")} icon="🧑‍🔧" tone="teal" />
          <ProStatCard label={t("work.contractors")} value={String(data.contractors.length)} hint={`${activeContractors.length} ${t("work.active")}`} icon="🤝" tone="blue" />
          <ProStatCard label={t("work.outstanding_payout")} value={formatLkr(outstandingPayout)} hint={t("work.owed_contractors")} icon="💸" tone="amber" />
          <ProStatCard label={t("work.active")} value={String(data.technicians.filter((x) => x.active).length + activeContractors.length)} hint={t("work.available")} icon="✅" tone="emerald" />
        </section>

        {showTechForm && (
          <section className="mt-6">
            <ProCard eyebrow={t("work.in_house")} title={t("work.add_tech_title")}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addTechnician({ name: techName, phone: techPhone, specialties: techSpecs });
                  setShowTechForm(false);
                  setTechName("");
                  setTechPhone("");
                  setTechSpecs([]);
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <input required placeholder={t("work.name")} value={techName} onChange={(e) => setTechName(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input placeholder={t("work.phone")} value={techPhone} onChange={(e) => setTechPhone(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                </div>
                <div className="mt-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{t("work.specialties")}</p>
                  <SpecialtyPicker value={techSpecs} onChange={setTechSpecs} labels={specialtyLabels} />
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button type="submit" className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700">{t("common.save")}</button>
                  <button type="button" onClick={() => setShowTechForm(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">{t("common.cancel")}</button>
                </div>
              </form>
            </ProCard>
          </section>
        )}

        {showConForm && (
          <section className="mt-6">
            <ProCard eyebrow={t("work.contractors")} title={t("work.add_contractor_title")}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addContractor({
                    name: conName,
                    company: conCompany,
                    phone: conPhone,
                    specialties: conSpecs,
                    rateType: conRateType,
                    rateAmount: conRate,
                  });
                  setShowConForm(false);
                  setConName("");
                  setConCompany("");
                  setConPhone("");
                  setConSpecs([]);
                  setConRate(0);
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <input required placeholder={t("work.name")} value={conName} onChange={(e) => setConName(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input placeholder={t("work.company")} value={conCompany} onChange={(e) => setConCompany(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <input placeholder={t("work.phone")} value={conPhone} onChange={(e) => setConPhone(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                  <select value={conRateType} onChange={(e) => setConRateType(e.target.value as ContractorRateType)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100">
                    {RATE_TYPES.map((r) => <option key={r} value={r}>{rateLabels[r]}</option>)}
                  </select>
                  <input type="number" placeholder={t("work.rate_amount")} value={conRate || ""} onChange={(e) => setConRate(Number(e.target.value))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-teal-300 focus:ring-4 focus:ring-teal-100" />
                </div>
                <div className="mt-3">
                  <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{t("work.specialties")}</p>
                  <SpecialtyPicker value={conSpecs} onChange={setConSpecs} labels={specialtyLabels} />
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button type="submit" className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 hover:bg-teal-700">{t("common.save")}</button>
                  <button type="button" onClick={() => setShowConForm(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">{t("common.cancel")}</button>
                </div>
              </form>
            </ProCard>
          </section>
        )}

        <section className="mt-6">
          <ProCard title={t("work.team")} eyebrow={t("work.in_house")} action={<ProBadge tone="teal">{data.technicians.length}</ProBadge>}>
            {data.technicians.length === 0 ? (
              <ProEmptyState title={t("work.no_team")} description={t("work.team_hint")} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.technicians.map((tch) => (
                  <article key={tch.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 ring-1 ring-slate-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-black text-slate-950">{tch.name}</h2>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{tch.phone || "—"}</p>
                      </div>
                      <ProBadge tone={tch.active ? "emerald" : "slate"}>{tch.active ? t("work.active") : t("work.inactive")}</ProBadge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tch.specialties.length === 0 ? (
                        <span className="text-xs font-semibold text-slate-400">—</span>
                      ) : (
                        tch.specialties.map((s) => <span key={s} className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-black text-teal-700">{specialtyLabels[s]}</span>)
                      )}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => updateTechnician(tch.id, { active: !tch.active })} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-200">
                        {tch.active ? t("work.deactivate") : t("work.activate")}
                      </button>
                      <button onClick={() => { if (confirm(t("work.delete_tech"))) deleteTechnician(tch.id); }} className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100">
                        {t("common.delete")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </ProCard>
        </section>

        <section className="mt-6">
          <ProCard title={t("work.contractors")} eyebrow={t("work.subcontractors")} action={<ProBadge tone="amber">{data.contractors.length}</ProBadge>}>
            {data.contractors.length === 0 ? (
              <ProEmptyState title={t("work.no_contractors")} description={t("work.contractor_hint")} />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.contractors.map((c) => (
                  <article key={c.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 ring-1 ring-slate-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-black text-slate-950">{c.name}</h2>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{c.company || "—"}{c.phone ? ` · ${c.phone}` : ""}</p>
                      </div>
                      <ProBadge tone={c.active ? "emerald" : "slate"}>{c.active ? t("work.active") : t("work.inactive")}</ProBadge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.specialties.map((s) => <span key={s} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">{specialtyLabels[s]}</span>)}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-sm">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">{t("work.rate")}</p>
                        <p className="font-black text-slate-900">{c.rateAmount > 0 ? `${formatLkr(c.rateAmount)} · ${rateLabels[c.rateType]}` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">{t("work.payable")}</p>
                        <p className={`font-mono font-black ${c.payableBalance > 0 ? "text-rose-600" : "text-slate-900"}`}>{formatLkr(c.payableBalance)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => updateContractor(c.id, { active: !c.active })} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-200">
                        {c.active ? t("work.deactivate") : t("work.activate")}
                      </button>
                      <button onClick={() => { if (confirm(t("work.delete_contractor"))) deleteContractor(c.id); }} className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100">
                        {t("common.delete")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </ProCard>
        </section>
      </ProMain>
    </ProPageShell>
  );
}
