import { NextResponse } from "next/server";
import { isTextLkConfigured } from "@/lib/messaging/textlk-server";

/** Public: whether server-side Text.lk SMS is configured (no secrets exposed). */
export async function GET() {
  return NextResponse.json({ configured: isTextLkConfigured() });
}
