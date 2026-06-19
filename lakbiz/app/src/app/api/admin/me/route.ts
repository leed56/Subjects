import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/auth";

export async function GET() {
  const admin = await requirePlatformAdmin();
  if ("error" in admin) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  return NextResponse.json({
    ok: true,
    admin: { email: admin.email, userId: admin.userId },
  });
}
