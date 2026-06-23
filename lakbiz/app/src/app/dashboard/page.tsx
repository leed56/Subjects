"use client";

import Link from "next/link";
import { useState } from "react";
import { AcServiceDoneDialog } from "@/components/ac-service-done-dialog";
import { AcServiceDuePanel } from "@/components/ac-service-due-panel";
import { SiteHeader } from "@/components/site-header";
import {
  ProBadge,
  ProButton,
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
import { getDashboardStats } from "@/lib/store/actions";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ACJob } from "@/lib/store/types";
import { getVatQuarterSummary } from "@/lib/vat";
import { useNotificationLogs } from "@/lib/messaging/use-notification-logs";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export default function DashboardPage() {
  const { data, ready, resetAll, recordACService } = useAppStore();
  const { t } = useLocale();
  const { can, org, isReadOnly, canSeeFinancials } = useSubscription();
  const notificationLogs = useNotificationLogs(org.id);
  const showVehicles = can("vehicles");
  const [serviceDoneJob, setServiceDoneJob] = useState<ACJob | null>(null);

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

  const stats = getDashboardStats(data);
  const vat = getVatQuarterSummary(data);
  const shopName = data.business.name || org.name || "LakBiz";
  const primaryActions = [
    { href: "/sales", label: t("dash.new_sale"), icon: "🧾", variant: "primary" as const },
    { href: "/stock", label: t("dash.add_stock"), icon: "📦", variant: "secondary" as const },
    { href: "/customers", label: t("nav.customers"), icon: "👥", variant: "secondary" as const },
    ...(canSeeFinancials
      ? [{ href: "/banking", label: t("nav.banking"), icon: "🏦", variant: "secondary" as const }]
      : []),
  ];

  return (
    <ProPageShell>
      <SiteHeader />
      <ProMain>
        <ProPageHeader
          eyebrow={org.isAuthenticated ? t("common.saved_cloud") : t("common.saved_browser")}
          title={`${t("dash.title")} · ${shopName}`}
          description={
            <span>
              {t("dash.live")} · {stats.productCount} {t("dash.products")} · {stats.saleCount} {t("dash.sales_today")}
              {isReadOnly && (
                <span className="mt-2 block font-bold text-amber-700">
                  {t("sub.read_only")}
                </span>
              )}
            </span>
          }
          actions={
            <>
              <ProButton href="/sales">{t("dash.new_sale")}</ProButton>
              <ProButton href="/stock" variant="secondary">
                {t("dash.add_stock")}
              </ProButton>
            </>
          }
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProStatCard
            label={t("dash.today_sales")}
            value={formatLkr(stats.todaySales)}
            hint={`${stats.saleCount} ${t("dash.sales_today")}`}
            icon="💸"
            tone="teal"
          />
          {canSeeFinancials && (
            <ProStatCard
              label={t("dash.today_profit")}
              value={formatLkr(stats.todayProfit)}
              hint={t("dash.profit_hint")}
              icon="📈"
              tone="emerald"
            />
          )}
          {canSeeFinancials && (
            <ProStatCard
              label={t("dash.bank_balance")}
              value={formatLkr(stats.bankBalance)}
              hint={t("nav.banking")}
              icon="🏦"
              tone="blue"
            />
          )}
          <ProStatCard
            label={t("dash.low_stock")}
            value={String(stats.lowStockCount)}
            hint={stats.lowStockCount > 0 ? t("dash.low_stock_alert") : t("dash.all_good_stock")}
            icon="⚠️"
            tone={stats.lowStockCount > 0 ? "amber" : "slate"}
          />
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {canSeeFinancials && (
            <>
              <ProStatCard
                label={t("dash.credit_out")}
                value={formatLkr(stats.creditOutstanding)}
                hint={t("dash.credit_customers")}
                icon="🤝"
                tone="amber"
              />
              <ProStatCard
                label={t("dash.supplier_pay")}
                value={formatLkr(stats.payableOutstanding)}
                hint={t("dash.supplier_payables")}
                icon="📥"
                tone="rose"
              />
              <ProStatCard
                label={t("dash.cheques_due")}
                value={String(stats.chequesDueSoonCount)}
                hint={t("nav.banking")}
                icon="🏷️"
                tone="slate"
              />
            </>
          )}
          {canSeeFinancials && showVehicles ? (
            <ProStatCard
              label={t("dash.car_profit_month")}
              value={formatLkr(stats.vehicleProfitThisMonth)}
              hint={`${stats.forSaleVehicleCount} ${t("dash.vehicles_sale")}`}
              icon="🚗"
              tone="blue"
            />
          ) : (
            <ProStatCard
              label={t("dash.products")}
              value={String(stats.productCount)}
              hint={t("nav.stock")}
              icon="📦"
              tone="teal"
            />
          )}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_0.95fr]">
          <ProCard
            eyebrow="Command center"
            title="Quick actions"
            action={<ProBadge tone={org.isAuthenticated ? "emerald" : "slate"}>{org.isAuthenticated ? "Cloud" : "Browser"}</ProBadge>}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2">
              {primaryActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-950/5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl shadow-sm ring-1 ring-slate-200 transition group-hover:scale-105">
                    {action.icon}
                  </span>
                  <p className="mt-4 text-sm font-black text-slate-950">{action.label}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Open module →</p>
                </Link>
              ))}
            </div>
          </ProCard>

          {canSeeFinancials && (
          <ProCard
            eyebrow={vat.enabled ? t("vat.meter_label") : t("vat.title")}
            title={vat.enabled ? formatLkr(vat.netPayable) : t("vat.enable_hint")}
            action={<ProButton href="/vat" variant="secondary">{t("nav.vat")}</ProButton>}
            className={vat.enabled ? "bg-slate-950 text-white ring-slate-800" : ""}
          >
            {vat.enabled ? (
              <div>
                <p className="text-sm font-semibold text-slate-400">{vat.bounds.label}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">{t("vat.output_vat")}</p>
                    <p className="mt-1 font-mono text-xl font-black text-amber-300">{formatLkr(vat.outputVat)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">{t("vat.input_vat")}</p>
                    <p className="mt-1 font-mono text-xl font-black text-teal-300">{formatLkr(vat.inputVat)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50 p-4 text-sm text-slate-700">
                <p>{t("vat.enable_hint")}</p>
                <Link href="/settings/shop" className="mt-3 inline-flex font-black text-teal-700 underline">
                  {t("vat.shop_settings")}
                </Link>
              </div>
            )}
          </ProCard>
          )}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          <ProCard
            title={t("dash.low_stock_alert")}
            action={<ProButton href="/stock" variant="ghost">{t("nav.stock")}</ProButton>}
          >
            {stats.lowStockItems.length === 0 ? (
              <ProEmptyState title={t("dash.all_good_stock")} description="Your reorder list is clear right now." />
            ) : (
              <div className="space-y-3">
                {stats.lowStockItems.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{p.name}</p>
                      <p className="text-xs font-semibold text-amber-700">
                        {p.stockQty} {String(p.customFields.unit ?? "pcs")} · {t("common.low")}
                      </p>
                    </div>
                    <ProBadge tone="amber">Low</ProBadge>
                  </div>
                ))}
              </div>
            )}
          </ProCard>

          {canSeeFinancials && (
          <ProCard
            title={t("dash.credit_customers")}
            action={<ProButton href="/customers" variant="ghost">{t("dash.manage_customers")}</ProButton>}
          >
            {stats.topDebtors.length === 0 ? (
              <ProEmptyState title={t("dash.no_credit")} description="No outstanding customer credit at the moment." />
            ) : (
              <div className="space-y-3">
                {stats.topDebtors.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="truncate text-sm font-black text-slate-950">{c.name}</p>
                    <p className="shrink-0 font-mono text-sm font-black text-teal-700">{formatLkr(c.creditBalance)}</p>
                  </div>
                ))}
              </div>
            )}
          </ProCard>
          )}

          {canSeeFinancials && (
          <ProCard
            title={t("dash.supplier_payables")}
            action={<ProButton href="/suppliers" variant="ghost">{t("dash.manage_suppliers")}</ProButton>}
          >
            {stats.topPayables.length === 0 ? (
              <ProEmptyState title={t("dash.no_payables")} description="Supplier payable list is clear." />
            ) : (
              <div className="space-y-3">
                {stats.topPayables.slice(0, 6).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="truncate text-sm font-black text-slate-950">{s.name}</p>
                    <p className="shrink-0 font-mono text-sm font-black text-rose-700">{formatLkr(s.payableBalance)}</p>
                  </div>
                ))}
              </div>
            )}
          </ProCard>
          )}
        </section>

        {(showVehicles && stats.aging60VehicleCount > 0) || stats.pendingACJobCount > 0 ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            {showVehicles && stats.aging60VehicleCount > 0 && (
              <ProCard
                title={`${stats.aging60VehicleCount} ${t("dash.vehicles_aging")}`}
                action={<ProButton href="/vehicles" variant="secondary">{t("dash.view_vehicles")}</ProButton>}
              >
                <div className="space-y-3">
                  {stats.aging60Vehicles.slice(0, 5).map((v) => (
                    <div key={v.id} className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
                      <p className="font-black text-amber-950">{v.make} {v.model} {v.year}</p>
                      <p className="mt-1 text-sm font-semibold text-amber-800">{formatLkr(v.askPrice)} · {v.stockId}</p>
                    </div>
                  ))}
                </div>
              </ProCard>
            )}

            {stats.pendingACJobCount > 0 && (
              <ProCard
                title={`${stats.pendingACJobCount} ${t("dash.ac_pending")}`}
                action={<ProButton href="/jobs" variant="secondary">{t("dash.view_jobs")}</ProButton>}
              >
                <div className="space-y-3">
                  {stats.pendingACJobs.slice(0, 5).map((j) => (
                    <div key={j.id} className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3">
                      <p className="font-black text-sky-950">{j.customerName}</p>
                      <p className="mt-1 text-sm font-semibold text-sky-800">{j.description} · {j.jobNo}</p>
                    </div>
                  ))}
                </div>
              </ProCard>
            )}
          </section>
        ) : null}

        <section className="mt-6">
          <AcServiceDuePanel
            dueTodayJobs={stats.acServiceDueToday}
            upcomingJobs={stats.acServiceDueSoon.filter(
              (j) =>
                j.serviceDueDate &&
                stats.acServiceDueToday.every((t) => t.id !== j.id),
            )}
            business={data.business}
            overdueCount={stats.acServiceOverdueCount}
            logs={notificationLogs}
            onServiceDone={setServiceDoneJob}
          />
        </section>

        {data.products.length === 0 && (
          <section className="mt-6">
            <ProCard>
              <ProEmptyState
                title={t("dash.get_started")}
                description="Add stock, customers and your first sale to activate the full dashboard experience."
                action={
                  <div className="flex flex-col justify-center gap-2 sm:flex-row">
                    <ProButton href="/stock">{t("nav.stock")}</ProButton>
                    <ProButton href="/customers" variant="secondary">{t("nav.customers")}</ProButton>
                    <ProButton href="/sales" variant="secondary">{t("nav.sales")}</ProButton>
                  </div>
                }
              />
            </ProCard>
          </section>
        )}

        <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 text-center text-xs font-semibold text-slate-500 shadow-sm sm:flex-row sm:text-left">
          <span>{t(org.isAuthenticated ? "common.saved_cloud" : "common.saved_browser")}</span>
          <button
            onClick={() => {
              if (confirm(t("common.confirm_delete"))) resetAll();
            }}
            className="rounded-full px-3 py-1.5 font-black text-rose-600 transition hover:bg-rose-50"
          >
            {t("common.reset_data")}
          </button>
        </div>

        <AcServiceDoneDialog
          job={serviceDoneJob}
          business={data.business}
          open={!!serviceDoneJob}
          onClose={() => setServiceDoneJob(null)}
          onConfirm={(input) => {
            if (serviceDoneJob) recordACService(serviceDoneJob.id, input);
          }}
        />
      </ProMain>
    </ProPageShell>
  );
}
