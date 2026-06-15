"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { formatLkr } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-provider";
import { paymentLabel } from "@/lib/i18n/payment";
import { useAppStore } from "@/lib/store/use-app-store";

export default function BillsPage() {
  const { data, ready, updateBusiness } = useAppStore();
  const { t } = useLocale();
  const [editBiz, setEditBiz] = useState(false);
  const [bizName, setBizName] = useState("");
  const [bizNameSi, setBizNameSi] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizTin, setBizTin] = useState("");

  if (!ready || !data) {
    return (
      <div className="min-h-full bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10">{t("common.loading")}</main>
      </div>
    );
  }

  const openBizEdit = () => {
    setBizName(data.business.name);
    setBizNameSi(data.business.nameSi ?? "");
    setBizPhone(data.business.phone ?? "");
    setBizAddress(data.business.address ?? "");
    setBizTin(data.business.tin ?? "");
    setEditBiz(true);
  };

  return (
    <div className="min-h-full bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("bills.title")}</h1>
            <p className="text-slate-600">
              {t("bills.subtitle")} · {data.sales.length} {t("bills.count")}
            </p>
          </div>
          <button
            onClick={openBizEdit}
            className="rounded-lg border border-teal-700 px-4 py-2 text-sm text-teal-700"
          >
            {t("bills.shop_details")}
          </button>
        </div>

        {editBiz && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateBusiness({
                ...data.business,
                name: bizName,
                nameSi: bizNameSi,
                phone: bizPhone,
                address: bizAddress,
                tin: bizTin,
              });
              setEditBiz(false);
            }}
            className="mb-8 rounded-xl border bg-white p-5"
          >
            <h2 className="font-semibold">{t("bills.shop_header")}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                required
                placeholder={t("bills.shop_name")}
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder={t("bills.shop_name_si")}
                value={bizNameSi}
                onChange={(e) => setBizNameSi(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder={t("bills.phone_wa")}
                value={bizPhone}
                onChange={(e) => setBizPhone(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder={t("bills.tin")}
                value={bizTin}
                onChange={(e) => setBizTin(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <input
                placeholder={t("common.address")}
                value={bizAddress}
                onChange={(e) => setBizAddress(e.target.value)}
                className="col-span-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
              >
                {t("common.save")}
              </button>
              <button
                type="button"
                onClick={() => setEditBiz(false)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        )}

        <div className="mb-4 rounded-lg bg-white border border-slate-200 p-4 text-sm">
          <p className="font-medium text-slate-800">{data.business.name}</p>
          {data.business.phone && (
            <p className="text-slate-500">
              {t("bills.tel")}: {data.business.phone}
            </p>
          )}
        </div>

        {data.sales.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-slate-600">{t("bills.no_bills")}</p>
            <Link href="/sales" className="mt-2 inline-block text-teal-700 underline">
              {t("bills.create_sale")}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">{t("bills.bill_no")}</th>
                  <th className="px-4 py-3">{t("common.date")}</th>
                  <th className="px-4 py-3">{t("common.customer")}</th>
                  <th className="px-4 py-3">{t("common.total")}</th>
                  <th className="px-4 py-3">{t("common.payment")}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.sales.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">
                      {s.billNo ?? s.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(s.date).toLocaleString("en-LK")}
                    </td>
                    <td className="px-4 py-3">{s.customerName || "—"}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatLkr(s.total)}
                    </td>
                    <td className="px-4 py-3">
                      {paymentLabel(t, s.paymentMethod)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/bills/${s.id}`}
                        className="font-medium text-teal-700 hover:underline"
                      >
                        {t("common.view_print")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
