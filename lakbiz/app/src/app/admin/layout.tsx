import { redirect } from "next/navigation";
import { AdminGate } from "@/components/admin/admin-gate";
import { isPlatformAdminUser } from "@/lib/admin/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await isPlatformAdminUser();
  if (!isAdmin) {
    redirect("/login?next=/admin");
  }

  return <AdminGate>{children}</AdminGate>;
}
