import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "অ্যাডমিন ড্যাশবোর্ড",
  robots: { index: false, follow: false },
};

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
