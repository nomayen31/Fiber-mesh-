import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "অ্যাডমিন লগইন",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-400">
          লোড হচ্ছে...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
