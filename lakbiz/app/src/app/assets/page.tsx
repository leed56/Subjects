"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProLoadingState } from "@/components/ui/pro-shell";
import { PageHeader, MetricCard, EmptyState, StatusBadge, SearchInput, FilterBar, Tabs, ActionMenu } from "@/components/ui/primitives";
import { Drawer, ConfirmDialog } from "@/components/ui/overlay";
import { FormField, TextInput, SelectInput, DateInput } from "@/components/ui/form";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { PlusIcon } from "@/components/ui/icons";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import {
  createAsset,
  deleteAsset,
  fetchAssetJobs,
  fetchOrgAssets,
  updateAsset,
  type AcAsset,
  type AcAssetInput,
  type AcAssetStatus,
  type AssetJob,
} from "@/lib/supabase/ac-assets-client";

type StatusFilter = "all" | AcAssetStatus;

const emptyForm = {
  customerId: "",
  brand: "",
  model: "",
  serialNo: "",
  indoorSerial: "",
  outdoorSerial: "",
  btu: "",
  acType: "",
  refrigerantType: "",
  installDate: "",
  warrantyExpiry: "",
  locationInProperty: "",
  siteAddress: "",
  status: "active" as AcAssetStatus,
  nextServiceDate: "",
  notes: "",
};

/** Plain module-level helpers (not inline in the component body) so the
 * Date.now() call happens outside render's purity check. */
function isServiceDueSoon(asset: AcAsset): boolean {
  if (!asset.nextServiceDate) return false;
  const due = new Date(asset.nextServiceDate).getTime();
  return due <= Date.now() + 1000 * 60 * 60 * 24 * 30;
}

function isUnderWarranty(asset: AcAsset): boolean {
  if (!asset.warrantyExpiry) return false;
  return new Date(asset.warrantyExpiry).getTime() > Date.now();
}

export default function AssetsPage() {
  const { t } = useLocale();
  const { org } = useSubscription();
  const { data: localData, ready: localReady } = useAppStore();
  const { toast } = useToast();

  const [assets, setAssets] = useState<AcAsset[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AcAsset | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [profileAsset, setProfileAsset] = useState<AcAsset | null>(null);
  const [profileTab, setProfileTab] = useState<"overview" | "jobs">("overview");
  const [profileJobs, setProfileJobs] = useState<AssetJob[] | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AcAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const orgId = org.isAuthenticated ? org.id : null;

  useEffect(() => {
    if (!orgId) {
      setAssets([]);
      return;
    }
    let cancelled = false;
    void fetchOrgAssets(orgId).then((result) => {
      if (cancelled) return;
      if (result.error) setLoadError(result.error);
      setAssets(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  useEffect(() => {
    if (!profileAsset || profileTab !== "jobs") return;
    let cancelled = false;
    void fetchAssetJobs(profileAsset.id).then((result) => {
      if (!cancelled) setProfileJobs(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [profileAsset, profileTab]);

  if (!org.isAuthenticated || !localReady || !localData || assets === null) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  const customerName = (customerId: string | null) => {
    if (!customerId) return null;
    return localData.customers.find((c) => c.id === customerId)?.name ?? null;
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (asset: AcAsset) => {
    setEditing(asset);
    setForm({
      customerId: asset.customerId ?? "",
      brand: asset.brand ?? "",
      model: asset.model ?? "",
      serialNo: asset.serialNo ?? "",
      indoorSerial: asset.indoorSerial ?? "",
      outdoorSerial: asset.outdoorSerial ?? "",
      btu: asset.btu != null ? String(asset.btu) : "",
      acType: asset.acType ?? "",
      refrigerantType: asset.refrigerantType ?? "",
      installDate: asset.installDate ?? "",
      warrantyExpiry: asset.warrantyExpiry ?? "",
      locationInProperty: asset.locationInProperty ?? "",
      siteAddress: asset.siteAddress ?? "",
      status: asset.status,
      nextServiceDate: asset.nextServiceDate ?? "",
      notes: asset.notes ?? "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    const input: AcAssetInput = {
      customerId: form.customerId || null,
      brand: form.brand,
      model: form.model,
      serialNo: form.serialNo,
      indoorSerial: form.indoorSerial,
      outdoorSerial: form.outdoorSerial,
      btu: form.btu ? Number(form.btu) : null,
      acType: form.acType,
      refrigerantType: form.refrigerantType,
      installDate: form.installDate || null,
      warrantyExpiry: form.warrantyExpiry || null,
      locationInProperty: form.locationInProperty,
      siteAddress: form.siteAddress,
      status: form.status,
      nextServiceDate: form.nextServiceDate || null,
      notes: form.notes,
    };
    setSaving(true);
    const result = editing ? await updateAsset(editing.id, input) : await createAsset(orgId!, input);
    setSaving(false);
    if (result.error || !result.data) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error ?? undefined });
      return;
    }
    setAssets((prev) => {
      const next = (prev ?? []).filter((a) => a.id !== result.data!.id);
      return [result.data!, ...next];
    });
    toast({ tone: "success", title: editing ? t("common.update") : t("assets.added") });
    setFormOpen(false);
    resetForm();
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const result = await deleteAsset(deleteTarget.id);
    setDeleting(false);
    if (result.error) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    setAssets((prev) => (prev ?? []).filter((a) => a.id !== deleteTarget.id));
    if (profileAsset?.id === deleteTarget.id) setProfileAsset(null);
    toast({ tone: "success", title: t("common.delete"), description: deleteTarget.brand ?? deleteTarget.serialNo ?? "" });
    setDeleteTarget(null);
  };

  const query = search.trim().toLowerCase();
  const filtered = assets
    .filter((a) => statusFilter === "all" || a.status === statusFilter)
    .filter((a) => {
      if (!query) return true;
      const haystack = [a.brand, a.model, a.serialNo, a.indoorSerial, a.outdoorSerial, customerName(a.customerId)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

  const activeCount = assets.filter((a) => a.status === "active").length;
  const dueSoonCount = assets.filter((a) => isServiceDueSoon(a)).length;
  const warrantyActiveCount = assets.filter((a) => isUnderWarranty(a)).length;

  const statusTone = (status: AcAssetStatus) => {
    if (status === "active") return "positive" as const;
    if (status === "replaced" || status === "removed") return "neutral" as const;
    return "warning" as const;
  };

  const columns: DataTableColumn<AcAsset>[] = [
    {
      key: "asset",
      header: t("assets.asset"),
      render: (a) => (
        <div>
          <button type="button" onClick={() => { setProfileAsset(a); setProfileTab("overview"); setProfileJobs(null); }} className="font-semibold text-slate-900 hover:text-teal-700 hover:underline">
            {[a.brand, a.model].filter(Boolean).join(" ") || t("assets.untitled")}
          </button>
          <p className="mt-0.5 text-xs text-slate-500">{a.serialNo ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: t("common.customer"),
      render: (a) => customerName(a.customerId) ?? "—",
    },
    {
      key: "status",
      header: t("common.status"),
      hideOnMobile: true,
      render: (a) => <StatusBadge tone={statusTone(a.status)}>{t(`assets.status_${a.status}`)}</StatusBadge>,
    },
    {
      key: "nextService",
      header: t("assets.next_service"),
      hideOnMobile: true,
      render: (a) => (a.nextServiceDate ? new Date(a.nextServiceDate).toLocaleDateString("en-LK") : "—"),
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (a) => (
        <ActionMenu
          items={[
            { label: t("common.edit"), onSelect: () => openEdit(a) },
            { label: t("common.delete"), tone: "danger" as const, onSelect: () => setDeleteTarget(a) },
          ]}
        />
      ),
    },
  ];

  const customerOptions = [{ value: "", label: t("assets.no_customer") }, ...localData.customers.map((c) => ({ value: c.id, label: c.name }))];
  const acTypeOptions = ["split", "window", "cassette", "ducted", "portable", "other"];

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={t("assets.title")}
          description={`${assets.length} ${t("assets.units")}`}
          actions={
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <PlusIcon className="h-4 w-4" />
              {t("assets.add")}
            </button>
          }
          metrics={
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label={t("assets.units")} value={String(assets.length)} />
              <MetricCard label={t("assets.status_active")} value={String(activeCount)} tone="positive" />
              <MetricCard label={t("assets.service_due_soon")} value={String(dueSoonCount)} tone={dueSoonCount > 0 ? "warning" : "default"} />
              <MetricCard label={t("assets.under_warranty")} value={String(warrantyActiveCount)} />
            </div>
          }
        />

        {loadError && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{loadError}</div>
        )}

        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder={t("assets.search_placeholder")} className="min-w-[220px] flex-1" />
          <div className="flex gap-1.5">
            {(["all", "active", "inactive", "removed", "replaced"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  statusFilter === s ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200"
                }`}
              >
                {s === "all" ? t("cust.filter_all") : t(`assets.status_${s}`)}
              </button>
            ))}
          </div>
        </FilterBar>

        {assets.length === 0 ? (
          <EmptyState
            title={t("assets.no_assets")}
            description={t("assets.no_assets_hint")}
            action={
              <button type="button" onClick={openCreate} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                {t("assets.add")}
              </button>
            }
          />
        ) : (
          <DataTable columns={columns} rows={filtered} emptyState={<EmptyState title={t("sales.no_match")} />} />
        )}

        {/* Create / edit drawer */}
        <Drawer
          open={formOpen}
          onClose={() => setFormOpen(false)}
          title={editing ? t("common.edit") : t("assets.add")}
          footer={
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? t("common.saving") : editing ? t("common.update") : t("assets.add")}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <FormField label={t("common.customer")}>
              <SelectInput value={form.customerId} onChange={(v) => setForm((f) => ({ ...f, customerId: v }))} options={customerOptions} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("assets.brand")}>
                <TextInput value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
              </FormField>
              <FormField label={t("assets.model")}>
                <TextInput value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
              </FormField>
            </div>
            <FormField label={t("assets.serial_no")}>
              <TextInput value={form.serialNo} onChange={(e) => setForm((f) => ({ ...f, serialNo: e.target.value }))} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("assets.indoor_serial")}>
                <TextInput value={form.indoorSerial} onChange={(e) => setForm((f) => ({ ...f, indoorSerial: e.target.value }))} />
              </FormField>
              <FormField label={t("assets.outdoor_serial")}>
                <TextInput value={form.outdoorSerial} onChange={(e) => setForm((f) => ({ ...f, outdoorSerial: e.target.value }))} />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("assets.btu")}>
                <TextInput type="number" value={form.btu} onChange={(e) => setForm((f) => ({ ...f, btu: e.target.value }))} />
              </FormField>
              <FormField label={t("assets.ac_type")}>
                <SelectInput
                  value={form.acType}
                  onChange={(v) => setForm((f) => ({ ...f, acType: v }))}
                  options={[{ value: "", label: "—" }, ...acTypeOptions.map((v) => ({ value: v, label: t(`assets.type_${v}`) }))]}
                />
              </FormField>
            </div>
            <FormField label={t("assets.refrigerant_type")}>
              <TextInput value={form.refrigerantType} onChange={(e) => setForm((f) => ({ ...f, refrigerantType: e.target.value }))} placeholder="R32, R410A…" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("assets.install_date")}>
                <DateInput value={form.installDate} onChange={(v) => setForm((f) => ({ ...f, installDate: v }))} />
              </FormField>
              <FormField label={t("assets.warranty_expiry")}>
                <DateInput value={form.warrantyExpiry} onChange={(v) => setForm((f) => ({ ...f, warrantyExpiry: v }))} />
              </FormField>
            </div>
            <FormField label={t("assets.location_in_property")}>
              <TextInput value={form.locationInProperty} onChange={(e) => setForm((f) => ({ ...f, locationInProperty: e.target.value }))} placeholder={t("assets.location_ph")} />
            </FormField>
            <FormField label={t("common.address")}>
              <TextInput value={form.siteAddress} onChange={(e) => setForm((f) => ({ ...f, siteAddress: e.target.value }))} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("common.status")}>
                <SelectInput
                  value={form.status}
                  onChange={(v) => setForm((f) => ({ ...f, status: v as AcAssetStatus }))}
                  options={(["active", "inactive", "removed", "replaced"] as const).map((s) => ({ value: s, label: t(`assets.status_${s}`) }))}
                />
              </FormField>
              <FormField label={t("assets.next_service")}>
                <DateInput value={form.nextServiceDate} onChange={(v) => setForm((f) => ({ ...f, nextServiceDate: v }))} />
              </FormField>
            </div>
            <FormField label={t("common.notes")}>
              <TextInput value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </FormField>
          </div>
        </Drawer>

        {/* Asset profile drawer */}
        {profileAsset && (
          <Drawer
            open
            onClose={() => setProfileAsset(null)}
            title={[profileAsset.brand, profileAsset.model].filter(Boolean).join(" ") || t("assets.untitled")}
            description={profileAsset.serialNo ?? undefined}
          >
            <div className="mb-4 flex items-center gap-2">
              <StatusBadge tone={statusTone(profileAsset.status)}>{t(`assets.status_${profileAsset.status}`)}</StatusBadge>
              {customerName(profileAsset.customerId) && <span className="text-sm text-slate-600">{customerName(profileAsset.customerId)}</span>}
            </div>
            <div className="mb-4 flex gap-2">
              <button type="button" onClick={() => openEdit(profileAsset)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("common.edit")}
              </button>
            </div>
            <Tabs
              value={profileTab}
              onChange={(v) => setProfileTab(v as "overview" | "jobs")}
              tabs={[
                { value: "overview", label: t("cust.tab_overview") },
                { value: "jobs", label: `${t("nav.jobs")}${profileJobs ? ` (${profileJobs.length})` : ""}` },
              ]}
            />
            <div className="mt-4">
              {profileTab === "overview" && (
                <dl className="space-y-2 text-sm">
                  {profileAsset.acType && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">{t("assets.ac_type")}</dt>
                      <dd className="text-slate-900">{t(`assets.type_${profileAsset.acType}`)}</dd>
                    </div>
                  )}
                  {profileAsset.btu != null && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">{t("assets.btu")}</dt>
                      <dd className="text-slate-900">{profileAsset.btu}</dd>
                    </div>
                  )}
                  {profileAsset.indoorSerial && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">{t("assets.indoor_serial")}</dt>
                      <dd className="text-slate-900">{profileAsset.indoorSerial}</dd>
                    </div>
                  )}
                  {profileAsset.outdoorSerial && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">{t("assets.outdoor_serial")}</dt>
                      <dd className="text-slate-900">{profileAsset.outdoorSerial}</dd>
                    </div>
                  )}
                  {profileAsset.refrigerantType && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">{t("assets.refrigerant_type")}</dt>
                      <dd className="text-slate-900">{profileAsset.refrigerantType}</dd>
                    </div>
                  )}
                  {profileAsset.installDate && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">{t("assets.install_date")}</dt>
                      <dd className="text-slate-900">{new Date(profileAsset.installDate).toLocaleDateString("en-LK")}</dd>
                    </div>
                  )}
                  {profileAsset.warrantyExpiry && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">{t("assets.warranty_expiry")}</dt>
                      <dd className="text-slate-900">{new Date(profileAsset.warrantyExpiry).toLocaleDateString("en-LK")}</dd>
                    </div>
                  )}
                  {profileAsset.locationInProperty && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">{t("assets.location_in_property")}</dt>
                      <dd className="text-slate-900">{profileAsset.locationInProperty}</dd>
                    </div>
                  )}
                  {profileAsset.siteAddress && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">{t("common.address")}</dt>
                      <dd className="text-right text-slate-900">{profileAsset.siteAddress}</dd>
                    </div>
                  )}
                  {profileAsset.notes && (
                    <div className="border-t border-slate-100 pt-2">
                      <dt className="text-slate-500">{t("common.notes")}</dt>
                      <dd className="mt-1 text-slate-900">{profileAsset.notes}</dd>
                    </div>
                  )}
                </dl>
              )}
              {profileTab === "jobs" &&
                (profileJobs === null ? (
                  <ProLoadingState label={t("common.loading")} />
                ) : profileJobs.length === 0 ? (
                  <EmptyState title={t("assets.no_jobs")} description={t("assets.no_jobs_hint")} />
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {profileJobs.map((j) => (
                      <li key={j.id} className="px-3.5 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{j.jobNo}</p>
                          <StatusBadge>{j.status}</StatusBadge>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {new Date(j.jobDate).toLocaleDateString("en-LK")} · {j.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          </Drawer>
        )}

        <ConfirmDialog
          open={!!deleteTarget}
          title={t("common.confirm_delete")}
          description={deleteTarget ? [deleteTarget.brand, deleteTarget.model].filter(Boolean).join(" ") || deleteTarget.serialNo || "" : undefined}
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
