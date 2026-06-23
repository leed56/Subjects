import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { BUSINESS_TEMPLATES, templateFromDbRow } from "@/lib/admin/templates";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const admin = await requirePlatformAdmin();
  if ("error" in admin) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("business_templates")
    .select("id, name_en, name_si, sector_id, default_plan_id")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("business_templates query failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Could not load templates from database",
        detail: error.message,
        templates: BUSINESS_TEMPLATES,
        source: "fallback",
      },
      { status: 503 },
    );
  }

  if (!data?.length) {
    return NextResponse.json({
      ok: true,
      templates: BUSINESS_TEMPLATES,
      source: "static",
    });
  }

  return NextResponse.json({
    ok: true,
    templates: data.map(templateFromDbRow),
    source: "database",
  });
}
