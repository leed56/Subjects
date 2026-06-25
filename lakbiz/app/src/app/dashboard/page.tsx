"use client";

import Link from "next/link";
import { useState } from "react";
import { AcServiceDoneDialog } from "@/components/ac-service-done-dialog";
import { AcServiceDuePanel } from "@/components/ac-service-due-panel";
import { OfflineSyncNotice } from "@/components/offline-sync-notice";
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
import { contactTypeI18nKey } from "@/lib/contact-type";
import { exportAccountantPack } from "@/lib/export";
import { useLocale } from "@/lib/i18n/locale-provider";
import { paymentLabel } from "@/lib/i18n/payment";
import { getDashboardStats } from "@/lib/store/actions";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ACJob } from "@/lib/store/types";
import { getVatQuarterSummary } from "@/lib/vat";
import { getIncomeTaxYearSummary } from "@/lib/income-tax";
import { useNotificationLogs } from "@/lib/messaging/use-notification-logs";
import { useSubscription } from "@/lib/subscription/subscription-provider";

export default function DashboardPage() {
  const { data, ready, resetAllToCloud, recordACServiceToCloud } = useAppStore();
  const { t } = useLocale();
  const { can, org, isReadOnly, canSeeFinancials } = useSubscription();
  const canExport = can("export");
  const showAcJobs = can("ac_jobs");
  const notificationLogs = useNotificationLogs(org.id);
  const showVehicles = can("vehicles");
  const [serviceDoneJob, setServiceDoneJob] = useState<ACJob | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

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
  const incomeTax = getIncomeTaxYearSummary(data);
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
              {canExport && canSeeFinancials && (
                <button
                  type="button"
                  onClick={() =>
                    exportAccountantPack(
                      data.business,
                      {
                        sales: data.sales,
                        products: data.products,
                        customers: data.customers,
                      },
                      {
                        includeProfit: true,
                        includeBuyPrice: true,
                        salesLabels: {
                          billNo: t("bills.bill_no"),
                          date: t("common.date"),
                          customer: t("common.customer"),
                          payment: t("common.payment"),
                          items: t("common.items"),
                          discount: t("sales.discount"),
                          subtotal: t("vat.subtotal"),
                          vat: t("vat.output_vat"),
                          total: t("common.total"),
                          profit: t("common.profit"),
                        },
                        stockLabels: {
                          name: t("common.name"),
                          sku: t("stock.sku"),
                          category: t("stock.category"),
                          condition: t("stock.condition"),
                          qty: t("common.qty"),
                          sellPrice: t("stock.sell_price"),
                          buyPrice: t("stock.buy_price"),
                          reorderLevel: t("stock.reorder_level"),
                        },
                        customerLabels: {
                          name: t("common.name"),
                          type: t("cust.contact_type"),
                          contactPerson: t("cust.contact_person"),
                          phone: t("common.phone"),
                          address: t("common.address"),
                          vatNumber: t("cust.vat_number"),
                          creditBalance: t("cust.credit_owed"),
                          creditLimit: t("cust.credit_limit"),
                        },
                        paymentLabel: (m) => paymentLabel(t, m),
                        typeLabel: (type) => t(contactTypeI18nKey(type)),
                        conditionLabel: (c) =>
                          t(c === "used" ? "stock.condition_used" : "stock.condition_new"),
                      },
                    )
                  }
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm transition hover:border-teal-200 hover:text-teal-800 active:scale-[0.98]"
                  title={t("export.accountant_pack_hint")}
                >
                  {t("export.accountant_pack")}
                </button>
              )}
              <ProButton href="/sales">{t("dash.new_sale")}</ProButton>
              <ProButton href="/stock" variant="secondary">
                {t("dash.add_stock")}
              </ProButton>
            </>
          }
        />

        <OfflineSyncNotice />

        {stats.lowStockCount > 0 && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {t("dash.low_stock_banner").replace("{count}", String(stats.lowStockCount))}{" "}
            <Link href="/stock" className="font-black underline">
              {t("nav.stock")}
            </Link>
          </p>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ProStatCard
            label={t("dash.today_sales")}
            value={formatLkr(stats.todaySales)}
            hint={`${stats.saleCount} ${t("dash.sales_today")}`}
            icon="💸"
            tone="teal"
          />
          <ProStatCard
            label={t("dash.month_sales")}
            value={formatLkr(stats.monthSales)}
            hint={
              stats.monthSalesChangePct != null
                ? t("dash.month_vs_last").replace(
                    "{pct}",
                    String(stats.monthSalesChangePct),
                  )
                : t("dash.month_no_compare")
            }
            icon="📅"
            tone="blue"
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
            eyebrow={t("dash.quick_actions_eyebrow")}
            title={t("dash.quick_actions_title")}
            action={<ProBadge tone={org.isAuthenticated ? "emerald" : "slate"}>{org.isAuthenticated ? t("dash.cloud") : t("dash.browser")}</ProBadge>}
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
                  <p className="mt-1 text-xs font-semibold text-slate-500">{t("dash.open_module")}</p>
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

          {canSeeFinancials && (
          <ProCard
            eyebrow={`${t("tax.income_meter")} · ${incomeTax.ratePct}%`}
            title={formatLkr(incomeTax.estimatedTax)}
            action={<ProButton href="/vat#income-tax" variant="secondary">{t("tax.income_title")}</ProButton>}
            className="bg-indigo-950 text-white ring-indigo-900"
          >
            <div>
              <p className="text-sm font-semibold text-indigo-300/80">{incomeTax.bounds.label}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-indigo-400">{t("tax.revenue")}</p>
                  <p className="mt-1 font-mono text-xl font-black text-indigo-100">{formatLkr(incomeTax.revenue)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-indigo-400">{t("tax.estimated_profit")}</p>
                  <p className="mt-1 font-mono text-xl font-black text-emerald-300">{formatLkr(incomeTax.estimatedTaxableProfit)}</p>
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold text-indigo-300/60">{t("tax.owner_only")}</p>
            </div>
          </ProCard>
          )}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          <ProCard
            title={t("dash.low_stock_alert")}
            action={<ProButton href="/stock" variant="ghost">{t("nav.stock")}</ProButton>}
          >
            {stats.lowStockItems.length === 0 ? (
              <ProEmptyState title={t("dash.all_good_stock")} description={t("dash.reorder_clear_desc")} />
            ) : (
              <div className="space-y-3">
                {stats.lowStockItems.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{p.name}</p>
                      <p className="text-xs font-semibold text-amber-700">
                        {p.stockQty} {String(p.customFields.unit ?? "pcs")}
                        {p.reorderLevel != null ? ` · ${t("stock.reorder_level")} ${p.reorderLevel}` : ""}
                      </p>
                    </div>
                    <ProBadge tone="amber">
                      {p.stockQty <= 0 ? t("dash.out_of_stock") : t("common.low")}
                    </ProBadge>
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
              <ProEmptyState title={t("dash.no_credit")} description={t("dash.no_credit_desc")} />
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
              <ProEmptyState title={t("dash.no_payables")} description={t("dash.no_payables_desc")} />
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

        {(showVehicles && stats.aging60VehicleCount > 0) || (showAcJobs && stats.pendingACJobCount > 0) ? (
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

            {showAcJobs && stats.pendingACJobCount > 0 && (
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

        {showAcJobs && (
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
        )}

        {data.products.length === 0 && (
          <section className="mt-6">
            <ProCard>
              <ProEmptyState
                title={t("dash.get_started")}
                description={t("dash.get_started_desc")}
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
          <span>{resetMessage || t(org.isAuthenticated ? "common.saved_cloud" : "common.saved_browser")}</span>
          <button
            onClick={async () => {
              if (resetting || isReadOnly) return;
              if (!confirm(t("common.confirm_delete"))) return;
              setResetting(true);
              setResetMessage("");
              const result = await resetAllToCloud();
              setResetting(false);
              if (!result.ok) {
                setResetMessage(result.error ?? t("common.save_failed"));
              }
            }}
            disabled={resetting || isReadOnly}
            className="rounded-full px-3 py-1.5 font-black text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resetting ? t("common.saving") : t("common.reset_data")}
          </button>
        </div>

        <AcServiceDoneDialog
          job={serviceDoneJob}
          business={data.business}
          open={!!serviceDoneJob}
          onClose={() => setServiceDoneJob(null)}
          onConfirm={async (input) => {
            if (!serviceDoneJob) return;
            const result = await recordACServiceToCloud(serviceDoneJob.id, input);
            if (result.ok) setServiceDoneJob(null);
          }}
        />
      </ProMain>
    </ProPageShell>
  );
}
