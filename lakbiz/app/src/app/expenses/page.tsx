"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProLoadingState } from "@/components/ui/pro-shell";
import { PageHeader, MetricCard, EmptyState, SearchInput, FilterBar } from "@/components/ui/primitives";
import { Drawer, ConfirmDialog } from "@/components/ui/overlay";
import { FormField, TextInput, SelectInput, MoneyInput, DateInput } from "@/components/ui/form";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { PlusIcon } from "@/components/ui/icons";
import { useLocale } from "@/lib/i18n/locale-provider";
import { paymentLabel } from "@/lib/i18n/payment";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import { formatLkr } from "@/lib/format";
import { getFiscalYearBounds, getIncomeTaxYearSummary } from "@/lib/income-tax";
import {
  createExpense,
  deleteExpense,
  fetchOrgExpenses,
  updateExpense,
  type Expense,
  type ExpenseCategory,
  type ExpenseInput,
  type ExpensePaymentMethod,
} from "@/lib/supabase/expenses-client";

const CATEGORIES: ExpenseCategory[] = [
  "rent", "utilities", "salaries", "fuel", "transport", "supplies", "maintenance", "insurance", "marketing",
  "parking", "equipment_rental", "outsourced_repair", "parts_purchase", "other",
];
const PAY_METHODS: ExpensePaymentMethod[] = ["cash", "bank_transfer", "card", "cheque"];

const emptyForm = {
  category: "other" as ExpenseCategory,
  amount: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  paymentMethod: "cash" as ExpensePaymentMethod,
  vendor: "",
  notes: "",
  jobId: "",
};

/** Module-level helper so "today" isn't computed inline during render
 * (matches the Date.now()-outside-render convention from Phases 4/5). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function ExpensesPage() {
  const { t } = useLocale();
  const { org, orgRole } = useSubscription();
  const { data: localData, ready: localReady } = useAppStore();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ExpenseCategory>("all");

  const canSeeFinancials = orgRole === "owner" || orgRole === "manager";
  const orgId = org.isAuthenticated ? org.id : null;

  useEffect(() => {
    if (!orgId || !canSeeFinancials) {
      setExpenses([]);
      return;
    }
    let cancelled = false;
    void fetchOrgExpenses(orgId).then((result) => {
      if (cancelled) return;
      if (result.error) setLoadError(result.error);
      setExpenses(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId, canSeeFinancials]);

  if (!org.isAuthenticated || !localReady || !localData || expenses === null) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  if (!canSeeFinancials) {
    return (
      <AppShell>
        <ProMain>
          <EmptyState title={t("expenses.no_access")} description={t("expenses.no_access_hint")} />
        </ProMain>
      </AppShell>
    );
  }

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditing(expense);
    setForm({
      category: expense.category,
      amount: String(expense.amount),
      expenseDate: expense.expenseDate,
      paymentMethod: expense.paymentMethod,
      vendor: expense.vendor ?? "",
      notes: expense.notes ?? "",
      jobId: expense.jobId ?? "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (saving || !form.amount || Number(form.amount) <= 0) return;
    const input: ExpenseInput = {
      category: form.category,
      amount: Number(form.amount),
      expenseDate: form.expenseDate || todayIso(),
      paymentMethod: form.paymentMethod,
      vendor: form.vendor,
      notes: form.notes,
      jobId: form.jobId || null,
    };
    setSaving(true);
    const result = editing ? await updateExpense(editing.id, input) : await createExpense(orgId!, input);
    setSaving(false);
    if (result.error || !result.data) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error ?? undefined });
      return;
    }
    setExpenses((prev) => {
      const next = (prev ?? []).filter((e) => e.id !== result.data!.id);
      return [result.data!, ...next].sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1));
    });
    toast({ tone: "success", title: editing ? t("common.update") : t("expenses.added") });
    setFormOpen(false);
    resetForm();
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const result = await deleteExpense(deleteTarget.id);
    setDeleting(false);
    if (result.error) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    setExpenses((prev) => (prev ?? []).filter((e) => e.id !== deleteTarget.id));
    toast({ tone: "success", title: t("common.delete"), description: `${t(`expenses.cat_${deleteTarget.category}`)} · ${formatLkr(deleteTarget.amount)}` });
    setDeleteTarget(null);
  };

  const query = search.trim().toLowerCase();
  const filtered = expenses
    .filter((e) => categoryFilter === "all" || e.category === categoryFilter)
    .filter((e) => !query || (e.vendor ?? "").toLowerCase().includes(query) || (e.notes ?? "").toLowerCase().includes(query));

  const monthStart = monthStartIso();
  const today = todayIso();
  const monthTotal = expenses.filter((e) => e.expenseDate >= monthStart && e.expenseDate <= today).reduce((s, e) => s + e.amount, 0);

  const fiscalStart = localData.business.quarterStartMonth ?? 4;
  const bounds = getFiscalYearBounds(new Date(), fiscalStart);
  const boundsStartIso = bounds.start.toISOString().slice(0, 10);
  const boundsEndIso = bounds.end.toISOString().slice(0, 10);
  // Job-linked expenses (jobId set) are excluded here: getIncomeTaxYearSummary
  // already nets those into acJobProfit on a per-job basis (fix-all pass —
  // see income-tax.ts). Including them again in this general otherExpenses
  // total would double-subtract them from the tax estimate. Only general
  // (non-job) expenses belong in yearTotal.
  const yearTotal = expenses
    .filter((e) => !e.jobId && e.expenseDate >= boundsStartIso && e.expenseDate <= boundsEndIso)
    .reduce((s, e) => s + e.amount, 0);

  const jobLinkedExpenseTotals = new Map<string, { category: string; amount: number }[]>();
  for (const e of expenses) {
    if (!e.jobId) continue;
    const list = jobLinkedExpenseTotals.get(e.jobId) ?? [];
    list.push({ category: e.category, amount: e.amount });
    jobLinkedExpenseTotals.set(e.jobId, list);
  }

  const withoutExpenses = getIncomeTaxYearSummary(localData, new Date(), 0, jobLinkedExpenseTotals);
  const withExpenses = getIncomeTaxYearSummary(localData, new Date(), yearTotal, jobLinkedExpenseTotals);
  const taxImpact = withoutExpenses.estimatedTax - withExpenses.estimatedTax;

  const columns: DataTableColumn<Expense>[] = [
    {
      key: "expense",
      header: t("expenses.expense"),
      render: (e) => (
        <div>
          <button type="button" onClick={() => openEdit(e)} className="font-semibold text-slate-900 hover:text-teal-700 hover:underline">
            {t(`expenses.cat_${e.category}`)}
          </button>
          <p className="mt-0.5 text-xs text-slate-500">{e.vendor || "—"}</p>
        </div>
      ),
    },
    {
      key: "date",
      header: t("common.date"),
      hideOnMobile: true,
      render: (e) => new Date(e.expenseDate).toLocaleDateString("en-LK"),
    },
    {
      key: "payment",
      header: t("common.payment"),
      hideOnMobile: true,
      render: (e) => paymentLabel(t, e.paymentMethod),
    },
    {
      key: "job",
      header: t("expenses.job"),
      hideOnMobile: true,
      render: (e) => {
        if (!e.jobId) return <span className="text-slate-400">—</span>;
        const job = localData.acJobs.find((j) => j.id === e.jobId);
        return job ? <span className="text-slate-600">{job.jobNo} · {job.customerName}</span> : <span className="text-slate-400">—</span>;
      },
    },
    {
      key: "amount",
      header: t("common.total"),
      align: "right",
      render: (e) => <span className="font-mono font-semibold text-slate-900">{formatLkr(e.amount)}</span>,
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (e) => (
        <button type="button" onClick={() => setDeleteTarget(e)} className="text-xs font-medium text-rose-600 hover:underline">
          {t("common.delete")}
        </button>
      ),
    },
  ];

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={t("expenses.title")}
          description={`${expenses.length} ${t("expenses.expenses")}`}
          actions={
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <PlusIcon className="h-4 w-4" />
              {t("expenses.add")}
            </button>
          }
          metrics={
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label={t("expenses.this_month")} value={formatLkr(monthTotal)} />
              <MetricCard label={t("expenses.this_fiscal_year")} value={formatLkr(yearTotal)} hint={bounds.label} />
              <MetricCard
                label={t("expenses.tax_impact")}
                value={taxImpact > 0 ? `-${formatLkr(taxImpact)}` : formatLkr(0)}
                hint={t("expenses.tax_impact_hint")}
                tone={taxImpact > 0 ? "positive" : "default"}
              />
            </div>
          }
        />

        {loadError && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{loadError}</div>
        )}

        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder={t("expenses.search_placeholder")} className="min-w-[200px] flex-1" />
          <SelectInput
            value={categoryFilter}
            onChange={(v) => setCategoryFilter(v as "all" | ExpenseCategory)}
            options={[{ value: "all", label: t("cust.filter_all") }, ...CATEGORIES.map((c) => ({ value: c, label: t(`expenses.cat_${c}`) }))]}
          />
        </FilterBar>

        {expenses.length === 0 ? (
          <EmptyState
            title={t("expenses.no_expenses")}
            description={t("expenses.no_expenses_hint")}
            action={
              <button type="button" onClick={openCreate} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                {t("expenses.add")}
              </button>
            }
          />
        ) : (
          <DataTable columns={columns} rows={filtered} emptyState={<EmptyState title={t("sales.no_match")} />} />
        )}

        <Drawer
          open={formOpen}
          onClose={() => setFormOpen(false)}
          title={editing ? t("common.edit") : t("expenses.add")}
          footer={
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !form.amount || Number(form.amount) <= 0}
                className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? t("common.saving") : editing ? t("common.update") : t("expenses.add")}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <FormField label={t("expenses.category")}>
              <SelectInput
                value={form.category}
                onChange={(v) => setForm((f) => ({ ...f, category: v as ExpenseCategory }))}
                options={CATEGORIES.map((c) => ({ value: c, label: t(`expenses.cat_${c}`) }))}
              />
            </FormField>
            <FormField label={t("common.total")}>
              <MoneyInput value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v }))} />
            </FormField>
            <FormField label={t("common.date")}>
              <DateInput value={form.expenseDate} onChange={(v) => setForm((f) => ({ ...f, expenseDate: v }))} />
            </FormField>
            <FormField label={t("common.payment")}>
              <SelectInput
                value={form.paymentMethod}
                onChange={(v) => setForm((f) => ({ ...f, paymentMethod: v as ExpensePaymentMethod }))}
                options={PAY_METHODS.map((m) => ({ value: m, label: paymentLabel(t, m) }))}
              />
            </FormField>
            <FormField label={t("expenses.vendor")}>
              <TextInput value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder={t("expenses.vendor_ph")} />
            </FormField>
            <FormField label={t("expenses.link_job")}>
              <SelectInput
                value={form.jobId}
                onChange={(v) => setForm((f) => ({ ...f, jobId: v }))}
                options={[
                  { value: "", label: t("expenses.no_job") },
                  ...localData.acJobs.map((j) => ({ value: j.id, label: `${j.jobNo} · ${j.customerName}` })),
                ]}
              />
            </FormField>
            <FormField label={t("common.notes")}>
              <TextInput value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </FormField>
          </div>
        </Drawer>

        <ConfirmDialog
          open={!!deleteTarget}
          title={t("common.confirm_delete")}
          description={deleteTarget ? `${t(`expenses.cat_${deleteTarget.category}`)} · ${formatLkr(deleteTarget.amount)}` : undefined}
          tone="danger"
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.cancel")}
          loading={deleting}
          onConfirm={() => void confirmDelete()}
          onClose={() => setDeleteTarget(null)}
        />
      </ProMain>
    </AppShell>
  );
}
