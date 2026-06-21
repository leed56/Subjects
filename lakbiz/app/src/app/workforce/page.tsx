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
  Contractor,
  ContractorRateType,
  WorkSpecialty,
} from "@/lib/store/types";
import type { PaymentMethod } from "@/lib/types";

const SPECIALTIES: WorkSpecialty[] = ["installation", "service", "repair"];
const RATE_TYPES: ContractorRateType[] = ["per_job", "per_unit", "per_meter", "fixed"];
const PAY_METHODS: PaymentMethod[] = ["cash", "bank_transfer", "cheque", "card"];

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
    recordContractorPayment,
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

  const [payContractor, setPayContractor] = useState<Contractor | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [payNote, setPayNote] = useState("");

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

  const contractorJobStats = (id: string) => {
    const jobs = data.acJobs.filter(
      (j) => j.assigneeType === "contractor" && j.assigneeId === id && j.status === "completed",
    );
    const revenue = jobs.reduce((s, j) => s + j.quotedAmount, 0);
    const cost = jobs.reduce((s, j) => s + (j.subcontractCost ?? 0), 0);
    return { count: jobs.length, margin: revenue - cost };
  };
  const totalMargin = data.contractors.reduce((s, c) => s + contractorJobStats(c.id).margin, 0);

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
          <ProStatCard label={t("work.total_margin")} value={formatLkr(totalMargin)} hint={t("work.margin_hint")} icon="📈" tone="emerald" />
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
                {data.contractors.map((c) => {
                  const stats = contractorJobStats(c.id);
                  return (
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
                    <p className="mt-3 text-xs font-bold text-slate-500">{t("work.jobs_done")}: {stats.count} · {t("work.margin")}: <span className="font-black text-emerald-700">{formatLkr(stats.margin)}</span></p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {c.payableBalance > 0 && (
                        <button onClick={() => { setPayContractor(c); setPayAmount(c.payableBalance); setPayMethod("cash"); setPayNote(""); }} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-100">
                          {t("work.pay")}
                        </button>
                      )}
                      <button onClick={() => updateContractor(c.id, { active: !c.active })} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-200">
                        {c.active ? t("work.deactivate") : t("work.activate")}
                      </button>
                      <button onClick={() => { if (confirm(t("work.delete_contractor"))) deleteContractor(c.id); }} className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100">
                        {t("common.delete")}
                      </button>
                    </div>
                  </article>
                  );
                })}
              </div>
            )}
          </ProCard>
        </section>

        {data.contractorPayments.length > 0 && (
          <section className="mt-6">
            <ProCard title={t("work.payouts")} eyebrow={t("work.contractors")} action={<ProBadge tone="emerald">{data.contractorPayments.length}</ProBadge>}>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">{t("common.date")}</th>
                      <th className="px-4 py-3">{t("work.contractors")}</th>
                      <th className="px-4 py-3">{t("work.method")}</th>
                      <th className="px-4 py-3 text-right">{t("bank.amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.contractorPayments.slice(0, 20).map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-semibold text-slate-600">{p.date.slice(0, 10)}</td>
                        <td className="px-4 py-3 font-black text-slate-950">{p.contractorName}</td>
                        <td className="px-4 py-3 font-semibold text-slate-600">{methodLabel(p.method)}</td>
                        <td className="px-4 py-3 text-right font-mono font-black text-emerald-600">{formatLkr(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ProCard>
          </section>
        )}
      </ProMain>

      {payContractor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-5 shadow-2xl shadow-slate-950/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">{t("work.pay")}</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">{payContractor.name}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">{t("work.payable")}: {formatLkr(payContractor.payableBalance)}</p>
              </div>
              <button onClick={() => setPayContractor(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">✕</button>
            </div>
            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (recordContractorPayment(payContractor.id, payAmount, payMethod, payNote)) {
                  setPayContractor(null);
                }
              }}
            >
              <input type="number" required min={1} placeholder={t("bank.amount")} value={payAmount || ""} onChange={(e) => setPayAmount(Number(e.target.value))} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black outline-none focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100" />
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-emerald-300">
                {PAY_METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
              </select>
              <input placeholder={t("work.note")} value={payNote} onChange={(e) => setPayNote(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-emerald-300" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="submit" className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-700/20 hover:bg-emerald-700">{t("work.record_payout")}</button>
                <button type="button" onClick={() => setPayContractor(null)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">{t("common.cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProPageShell>
  );

  function methodLabel(m: PaymentMethod): string {
    return t(`work.method.${m}`);
  }
}
