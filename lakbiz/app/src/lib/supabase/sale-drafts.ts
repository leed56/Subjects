import { createBrowserClient } from "./client";

export type SaleDraftPayload = {
  cart: Record<string, number>;
  priceOverrides: Record<string, number>;
  inventoryStates: Record<string, unknown>;
  discount: number;
  cashReceived: number | "";
  payment: string;
  splitPayment: boolean;
  secondaryPayment: string;
  secondaryAmount: number | "";
  customerId: string;
  walkInName: string;
  walkInPhone: string;
  chequeNo: string;
  chequeBank: string;
  chequeDate: string;
  postDated: boolean;
  pendingSaleId: string | null;
  snapshotTotal: number;
};

export type SaleDraft = {
  id: string;
  title: string;
  payload: SaleDraftPayload;
  createdAt: string;
  updatedAt: string;
};

export type SaleDraftError = "not_configured" | "unavailable" | "not_found" | "failed";
type Result<T> = { ok: true; data: T } | { ok: false; code: SaleDraftError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function numberMap(value: unknown, allowZero = false): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) =>
      typeof item === "number" && Number.isFinite(item) && (allowZero ? item >= 0 : item > 0),
    ),
  );
}

function normalizePayload(value: unknown): SaleDraftPayload | null {
  if (!isRecord(value)) return null;
  const cart = numberMap(value.cart);
  if (Object.keys(cart).length === 0) return null;
  const amount = (candidate: unknown) =>
    typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0 ? candidate : 0;
  const text = (candidate: unknown) => typeof candidate === "string" ? candidate : "";
  const paymentOptions = ["cash", "card", "bank_transfer", "cheque", "credit", "mixed"];
  const payment = text(value.payment);
  const secondaryPayment = text(value.secondaryPayment);
  const cashReceived = value.cashReceived === "" ? "" : amount(value.cashReceived);
  const secondaryAmount = value.secondaryAmount === "" ? "" : amount(value.secondaryAmount);
  return {
    cart,
    priceOverrides: numberMap(value.priceOverrides, true),
    inventoryStates: isRecord(value.inventoryStates) ? value.inventoryStates : {},
    discount: amount(value.discount),
    cashReceived,
    payment: paymentOptions.includes(payment) ? payment : "cash",
    splitPayment: value.splitPayment === true,
    secondaryPayment: paymentOptions.includes(secondaryPayment) ? secondaryPayment : "card",
    secondaryAmount,
    customerId: text(value.customerId),
    walkInName: text(value.walkInName),
    walkInPhone: text(value.walkInPhone),
    chequeNo: text(value.chequeNo),
    chequeBank: text(value.chequeBank),
    chequeDate: text(value.chequeDate),
    postDated: value.postDated === true,
    pendingSaleId: typeof value.pendingSaleId === "string" ? value.pendingSaleId : null,
    snapshotTotal: amount(value.snapshotTotal),
  };
}

function errorCode(message: string): SaleDraftError {
  const lower = message.toLowerCase();
  if (lower.includes("sale_drafts") || lower.includes("schema cache") || lower.includes("relation") && lower.includes("does not exist")) return "unavailable";
  return "failed";
}

export function saleDraftErrorMessage(locale: string, code: SaleDraftError): string {
  if (locale === "si") {
    if (code === "unavailable") return "රඳවාගත් බිල්පත් සේවාව තවම සූදානම් නැහැ. ටික වේලාවකින් නැවත උත්සාහ කරන්න.";
    if (code === "not_found") return "මෙම රඳවාගත් බිල්පත තවදුරටත් නැහැ. ලැයිස්තුව නැවත පූරණය කරන්න.";
    if (code === "not_configured") return "මෙම shop එකට cloud සම්බන්ධතාවක් නැහැ. අන්තර්ජාල සම්බන්ධතාව පරීක්ෂා කරන්න.";
    return "රඳවාගත් බිල්පත සුරැකීමට නොහැකි වුණා. සම්බන්ධතාව පරීක්ෂා කර නැවත උත්සාහ කරන්න.";
  }
  if (locale === "ta") {
    if (code === "unavailable") return "சேமித்த பில் வசதி இன்னும் தயாராகவில்லை. சிறிது நேரத்தில் மீண்டும் முயற்சிக்கவும்.";
    if (code === "not_found") return "இந்த சேமித்த பில் இனி இல்லை. பட்டியலை மீண்டும் ஏற்றவும்.";
    if (code === "not_configured") return "இந்தக் கடைக்கு cloud இணைப்பு இல்லை. இணைய இணைப்பைச் சரிபார்க்கவும்.";
    return "சேமித்த பில்லை சேமிக்க முடியவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.";
  }
  if (code === "unavailable") return "Held bills are not ready for this shop yet. Try again shortly.";
  if (code === "not_found") return "This held bill is no longer available. Refresh the list.";
  if (code === "not_configured") return "Cloud sync is unavailable for this shop. Check the internet connection.";
  return "Could not save the held bill. Check the connection and try again.";
}

function toSaleDraft(row: unknown): SaleDraft | null {
  if (!isRecord(row)) return null;
  const payload = normalizePayload(row.payload);
  if (!payload || typeof row.id !== "string") return null;
  return {
    id: row.id,
    title: typeof row.title === "string" && row.title.trim() ? row.title : "Held bill",
    payload,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

export async function listSaleDrafts(organizationId: string): Promise<Result<SaleDraft[]>> {
  const supabase = createBrowserClient();
  if (!supabase) return { ok: false, code: "not_configured" };
  const { data, error } = await supabase
    .from("sale_drafts")
    .select("id,title,payload,created_at,updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (error) return { ok: false, code: errorCode(error.message) };
  return { ok: true, data: (data ?? []).map(toSaleDraft).filter((draft): draft is SaleDraft => Boolean(draft)) };
}

export async function saveSaleDraft(
  organizationId: string,
  draftId: string | null,
  title: string,
  payload: SaleDraftPayload,
): Promise<Result<SaleDraft>> {
  const supabase = createBrowserClient();
  if (!supabase) return { ok: false, code: "not_configured" };
  const values = {
    title: title.trim().slice(0, 100) || "Held bill",
    payload,
    updated_at: new Date().toISOString(),
  };
  if (draftId) {
    const { data, error } = await supabase
      .from("sale_drafts")
      .update(values)
      .eq("id", draftId)
      .eq("organization_id", organizationId)
      .select("id,title,payload,created_at,updated_at")
      .maybeSingle();
    if (error) return { ok: false, code: errorCode(error.message) };
    const draft = toSaleDraft(data);
    return draft ? { ok: true, data: draft } : { ok: false, code: "not_found" };
  }
  const { data, error } = await supabase
    .from("sale_drafts")
    .insert({ organization_id: organizationId, ...values })
    .select("id,title,payload,created_at,updated_at")
    .single();
  if (error) return { ok: false, code: errorCode(error.message) };
  const draft = toSaleDraft(data);
  return draft ? { ok: true, data: draft } : { ok: false, code: "failed" };
}

export async function deleteSaleDraft(organizationId: string, draftId: string): Promise<Result<string>> {
  const supabase = createBrowserClient();
  if (!supabase) return { ok: false, code: "not_configured" };
  const { data, error } = await supabase
    .from("sale_drafts")
    .delete()
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, code: errorCode(error.message) };
  return typeof data?.id === "string"
    ? { ok: true, data: data.id }
    : { ok: false, code: "not_found" };
}
