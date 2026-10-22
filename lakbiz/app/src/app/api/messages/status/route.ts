import { NextResponse } from "next/server";
import { isTextLkConfigured } from "@/lib/messaging/textlk-server";
import { isWasenderConfigured } from "@/lib/messaging/wasender-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Authenticated: whether server-side Text.lk SMS / WasenderAPI WhatsApp
 * are configured (no secrets exposed — just booleans the client uses to
 * decide whether to show those channels at all). `configured` is kept
 * for existing callers (Text.lk); `whatsappConfigured` is additive. */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ configured: false, error: "Sign in required" }, { status: 401 });
  }

  return NextResponse.json({
    configured: isTextLkConfigured(),
    whatsappConfigured: isWasenderConfigured(),
  });
}
