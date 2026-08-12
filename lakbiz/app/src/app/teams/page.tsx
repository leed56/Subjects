"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ProMain, ProLoadingState } from "@/components/ui/pro-shell";
import { PageHeader, MetricCard, EmptyState, StatusBadge, SearchInput, FilterBar, Tabs, ActionMenu } from "@/components/ui/primitives";
import { Drawer, ConfirmDialog } from "@/components/ui/overlay";
import { FormField, TextInput, SelectInput } from "@/components/ui/form";
import { DataTable, type DataTableColumn } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { PlusIcon } from "@/components/ui/icons";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useSubscription } from "@/lib/subscription/subscription-provider";
import { useAppStore } from "@/lib/store/use-app-store";
import {
  addCrewMember,
  createCrew,
  deleteCrew,
  fetchCrewJobs,
  fetchCrewMembers,
  fetchOrgCrewMembers,
  fetchOrgCrews,
  removeCrewMember,
  setCrewMemberLead,
  updateCrew,
  type Crew,
  type CrewInput,
  type CrewJob,
  type CrewMember,
  type CrewMemberType,
  type CrewType,
} from "@/lib/supabase/crews-client";

const emptyForm = {
  name: "",
  crewType: "mixed" as CrewType,
  active: true,
  notes: "",
};

const CREW_TYPES: CrewType[] = ["installation", "maintenance", "mixed"];

export default function TeamsPage() {
  const { t } = useLocale();
  const { org } = useSubscription();
  const { data: localData, ready: localReady } = useAppStore();
  const { toast } = useToast();

  const [crews, setCrews] = useState<Crew[] | null>(null);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Crew | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [profileCrew, setProfileCrew] = useState<Crew | null>(null);
  const [profileTab, setProfileTab] = useState<"members" | "jobs">("members");
  const [profileMembers, setProfileMembers] = useState<CrewMember[] | null>(null);
  const [profileJobs, setProfileJobs] = useState<CrewJob[] | null>(null);
  const [addMemberType, setAddMemberType] = useState<CrewMemberType>("technician");
  const [addMemberId, setAddMemberId] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Crew | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | CrewType>("all");

  const orgId = org.isAuthenticated ? org.id : null;

  useEffect(() => {
    if (!orgId) {
      setCrews([]);
      return;
    }
    let cancelled = false;
    void Promise.all([fetchOrgCrews(orgId), fetchOrgCrewMembers(orgId)]).then(([crewsResult, membersResult]) => {
      if (cancelled) return;
      if (crewsResult.error) setLoadError(crewsResult.error);
      setCrews(crewsResult.data);
      const counts: Record<string, number> = {};
      for (const m of membersResult.data) counts[m.crewId] = (counts[m.crewId] ?? 0) + 1;
      setMemberCounts(counts);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const reloadProfileMembers = (crewId: string) => {
    void fetchCrewMembers(crewId).then((result) => {
      setProfileMembers(result.data);
      setMemberCounts((prev) => ({ ...prev, [crewId]: result.data.length }));
    });
  };

  useEffect(() => {
    if (!profileCrew) return;
    reloadProfileMembers(profileCrew.id);
  }, [profileCrew]);

  useEffect(() => {
    if (!profileCrew || profileTab !== "jobs") return;
    let cancelled = false;
    void fetchCrewJobs(profileCrew.id).then((result) => {
      if (!cancelled) setProfileJobs(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [profileCrew, profileTab]);

  if (!org.isAuthenticated || !localReady || !localData || crews === null) {
    return (
      <AppShell>
        <ProMain>
          <ProLoadingState label={t("common.loading")} />
        </ProMain>
      </AppShell>
    );
  }

  const technicianName = (id: string) => localData.technicians.find((tech) => tech.id === id)?.name ?? id;
  const contractorName = (id: string) => localData.contractors.find((c) => c.id === id)?.name ?? id;
  const memberName = (m: CrewMember) => (m.memberType === "technician" ? technicianName(m.memberId) : contractorName(m.memberId));

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (crew: Crew) => {
    setEditing(crew);
    setForm({ name: crew.name, crewType: crew.crewType, active: crew.active, notes: crew.notes ?? "" });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (saving || !form.name.trim()) return;
    const input: CrewInput = { name: form.name, crewType: form.crewType, active: form.active, notes: form.notes };
    setSaving(true);
    const result = editing ? await updateCrew(editing.id, input) : await createCrew(orgId!, input);
    setSaving(false);
    if (result.error || !result.data) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error ?? undefined });
      return;
    }
    setCrews((prev) => {
      const next = (prev ?? []).filter((c) => c.id !== result.data!.id);
      return [result.data!, ...next];
    });
    toast({ tone: "success", title: editing ? t("common.update") : t("crews.added") });
    setFormOpen(false);
    resetForm();
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const result = await deleteCrew(deleteTarget.id);
    setDeleting(false);
    if (result.error) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    setCrews((prev) => (prev ?? []).filter((c) => c.id !== deleteTarget.id));
    if (profileCrew?.id === deleteTarget.id) setProfileCrew(null);
    toast({ tone: "success", title: t("common.delete"), description: deleteTarget.name });
    setDeleteTarget(null);
  };

  const availableToAdd = () => {
    const already = new Set((profileMembers ?? []).filter((m) => m.memberType === addMemberType).map((m) => m.memberId));
    if (addMemberType === "technician") {
      return localData.technicians.filter((tech) => tech.active && !already.has(tech.id));
    }
    return localData.contractors.filter((c) => c.active && !already.has(c.id));
  };

  const handleAddMember = async () => {
    if (!profileCrew || !addMemberId || addingMember) return;
    setAddingMember(true);
    const result = await addCrewMember(profileCrew.id, orgId!, addMemberType, addMemberId);
    setAddingMember(false);
    if (result.error) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    setAddMemberId("");
    reloadProfileMembers(profileCrew.id);
  };

  const handleRemoveMember = async (memberRowId: string) => {
    if (!profileCrew) return;
    const result = await removeCrewMember(memberRowId);
    if (result.error) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    reloadProfileMembers(profileCrew.id);
  };

  const handleToggleLead = async (member: CrewMember) => {
    if (!profileCrew) return;
    const result = await setCrewMemberLead(member.id, !member.isLead);
    if (result.error) {
      toast({ tone: "error", title: t("common.save_failed"), description: result.error });
      return;
    }
    reloadProfileMembers(profileCrew.id);
  };

  const query = search.trim().toLowerCase();
  const filtered = crews
    .filter((c) => typeFilter === "all" || c.crewType === typeFilter)
    .filter((c) => !query || c.name.toLowerCase().includes(query));

  const activeCount = crews.filter((c) => c.active).length;
  const totalMembers = Object.values(memberCounts).reduce((sum, n) => sum + n, 0);

  const typeTone = (crewType: CrewType) => {
    if (crewType === "installation") return "info" as const;
    if (crewType === "maintenance") return "warning" as const;
    return "neutral" as const;
  };

  const columns: DataTableColumn<Crew>[] = [
    {
      key: "crew",
      header: t("crews.name"),
      render: (c) => (
        <div>
          <button
            type="button"
            onClick={() => {
              setProfileCrew(c);
              setProfileTab("members");
              setProfileJobs(null);
              setProfileMembers(null);
            }}
            className="font-semibold text-slate-900 hover:text-teal-700 hover:underline"
          >
            {c.name || t("crews.untitled")}
          </button>
          {!c.active && <p className="mt-0.5 text-xs text-slate-500">{t("work.inactive")}</p>}
        </div>
      ),
    },
    {
      key: "type",
      header: t("crews.type"),
      render: (c) => <StatusBadge tone={typeTone(c.crewType)}>{t(`crews.type_${c.crewType}`)}</StatusBadge>,
    },
    {
      key: "members",
      header: t("crews.members"),
      hideOnMobile: true,
      render: (c) => String(memberCounts[c.id] ?? 0),
    },
    {
      key: "actions",
      header: t("common.actions"),
      align: "right",
      render: (c) => (
        <ActionMenu
          items={[
            { label: t("common.edit"), onSelect: () => openEdit(c) },
            { label: t("common.delete"), tone: "danger" as const, onSelect: () => setDeleteTarget(c) },
          ]}
        />
      ),
    },
  ];

  return (
    <AppShell>
      <ProMain>
        <PageHeader
          title={t("crews.title")}
          description={`${crews.length} ${t("crews.crews")}`}
          actions={
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
            >
              <PlusIcon className="h-4 w-4" />
              {t("crews.add")}
            </button>
          }
          metrics={
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label={t("crews.crews")} value={String(crews.length)} />
              <MetricCard label={t("crews.active_crews")} value={String(activeCount)} tone="positive" />
              <MetricCard label={t("crews.total_members")} value={String(totalMembers)} />
            </div>
          }
        />

        {loadError && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{loadError}</div>
        )}

        <FilterBar>
          <SearchInput value={search} onChange={setSearch} placeholder={t("crews.search_placeholder")} className="min-w-[220px] flex-1" />
          <div className="flex gap-1.5">
            {(["all", ...CREW_TYPES] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTypeFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  typeFilter === s ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200"
                }`}
              >
                {s === "all" ? t("cust.filter_all") : t(`crews.type_${s}`)}
              </button>
            ))}
          </div>
        </FilterBar>

        {crews.length === 0 ? (
          <EmptyState
            title={t("crews.no_crews")}
            description={t("crews.no_crews_hint")}
            action={
              <button type="button" onClick={openCreate} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
                {t("crews.add")}
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
          title={editing ? t("common.edit") : t("crews.add")}
          footer={
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !form.name.trim()}
                className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? t("common.saving") : editing ? t("common.update") : t("crews.add")}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <FormField label={t("crews.name")}>
              <TextInput value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </FormField>
            <FormField label={t("crews.type")}>
              <SelectInput
                value={form.crewType}
                onChange={(v) => setForm((f) => ({ ...f, crewType: v as CrewType }))}
                options={CREW_TYPES.map((ct) => ({ value: ct, label: t(`crews.type_${ct}`) }))}
              />
            </FormField>
            <FormField label={t("common.status")}>
              <SelectInput
                value={form.active ? "active" : "inactive"}
                onChange={(v) => setForm((f) => ({ ...f, active: v === "active" }))}
                options={[
                  { value: "active", label: t("work.active") },
                  { value: "inactive", label: t("work.inactive") },
                ]}
              />
            </FormField>
            <FormField label={t("common.notes")}>
              <TextInput value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </FormField>
          </div>
        </Drawer>

        {/* Crew profile drawer */}
        {profileCrew && (
          <Drawer open onClose={() => setProfileCrew(null)} title={profileCrew.name || t("crews.untitled")}>
            <div className="mb-4 flex items-center gap-2">
              <StatusBadge tone={typeTone(profileCrew.crewType)}>{t(`crews.type_${profileCrew.crewType}`)}</StatusBadge>
              {!profileCrew.active && <StatusBadge tone="neutral">{t("work.inactive")}</StatusBadge>}
            </div>
            <div className="mb-4 flex gap-2">
              <button type="button" onClick={() => openEdit(profileCrew)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t("common.edit")}
              </button>
            </div>
            <Tabs
              value={profileTab}
              onChange={(v) => setProfileTab(v as "members" | "jobs")}
              tabs={[
                { value: "members", label: `${t("crews.tab_members")}${profileMembers ? ` (${profileMembers.length})` : ""}` },
                { value: "jobs", label: `${t("nav.jobs")}${profileJobs ? ` (${profileJobs.length})` : ""}` },
              ]}
            />
            <div className="mt-4">
              {profileTab === "members" &&
                (profileMembers === null ? (
                  <ProLoadingState label={t("common.loading")} />
                ) : (
                  <div className="space-y-4">
                    {profileMembers.length === 0 ? (
                      <EmptyState title={t("crews.no_members")} description={t("crews.no_members_hint")} />
                    ) : (
                      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                        {profileMembers.map((m) => (
                          <li key={m.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {memberName(m)}
                                {m.isLead && <span className="ml-2 rounded-md bg-teal-100 px-1.5 py-0.5 text-xs font-medium text-teal-800">{t("crews.lead_badge")}</span>}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {m.memberType === "technician" ? t("crews.member_type_technician") : t("crews.member_type_contractor")}
                              </p>
                            </div>
                            <ActionMenu
                              items={[
                                { label: m.isLead ? t("crews.unset_lead") : t("crews.set_lead"), onSelect: () => void handleToggleLead(m) },
                                { label: t("crews.remove_member"), tone: "danger" as const, onSelect: () => void handleRemoveMember(m.id) },
                              ]}
                            />
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="rounded-lg border border-slate-200 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("crews.add_member")}</p>
                      <div className="flex flex-wrap gap-2">
                        {(["technician", "contractor"] as const).map((mt) => (
                          <button
                            key={mt}
                            type="button"
                            onClick={() => {
                              setAddMemberType(mt);
                              setAddMemberId("");
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                              addMemberType === mt ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:border-teal-200"
                            }`}
                          >
                            {mt === "technician" ? t("crews.member_type_technician") : t("crews.member_type_contractor")}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-2">
                        {availableToAdd().length === 0 ? (
                          <p className="text-sm text-slate-500">{t("crews.no_available_members")}</p>
                        ) : (
                          <>
                            <SelectInput
                              value={addMemberId}
                              onChange={setAddMemberId}
                              options={[
                                { value: "", label: t("crews.select_member_placeholder") },
                                ...availableToAdd().map((m) => ({ value: m.id, label: m.name })),
                              ]}
                              className="flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => void handleAddMember()}
                              disabled={!addMemberId || addingMember}
                              className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                            >
                              {t("common.add")}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              {profileTab === "jobs" &&
                (profileJobs === null ? (
                  <ProLoadingState label={t("common.loading")} />
                ) : profileJobs.length === 0 ? (
                  <EmptyState title={t("crews.no_jobs")} description={t("crews.no_jobs_hint")} />
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
          description={deleteTarget?.name}
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
