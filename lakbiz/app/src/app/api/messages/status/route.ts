import { NextResponse } from "next/server";
import { isTextLkConfigured } from "@/lib/messaging/textlk-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Authenticated: whether server-side Text.lk SMS is configured (no secrets exposed). */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ configured: false, error: "Sign in required" }, { status: 401 });
  }

  return NextResponse.json({ configured: isTextLkConfigured() });
}
