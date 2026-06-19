import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PlatformAdminContext = {
  userId: string;
  email: string;
};

export async function requirePlatformAdmin(): Promise<
  PlatformAdminContext | { error: string; status: number }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sign in required", status: 401 };
  }

  const { data: adminRow, error } = await supabase
    .from("platform_admins")
    .select("user_id, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !adminRow) {
    return { error: "Platform admin access required", status: 403 };
  }

  return {
    userId: adminRow.user_id,
    email: adminRow.email,
  };
}

export async function isPlatformAdminUser(): Promise<boolean> {
  const result = await requirePlatformAdmin();
  return "userId" in result;
}
