import { redirect } from "next/navigation";
import { AdminGate } from "@/components/admin/admin-gate";
import { isPlatformAdminUser } from "@/lib/admin/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const isAdmin = await isPlatformAdminUser();
  if (!isAdmin) {
    redirect("/dashboard");
  }

  return <AdminGate>{children}</AdminGate>;
}
