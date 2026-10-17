"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, LogIn } from "lucide-react";
import { site } from "@/content/site";
import { Logo } from "@/components/ui/Section";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "লগইন করা যায়নি।");
        return;
      }

      const next = searchParams.get("next");
      const destination = next && next.startsWith("/admin") ? next : "/admin";
      router.replace(destination);
      router.refresh();
    } catch {
      setError("সার্ভারের সাথে সংযোগ করা যায়নি।");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-bold text-white">
              {site.brand.name}
            </span>
          </span>
          <h1 className="mt-5 text-xl text-white">অ্যাডমিন ড্যাশবোর্ডে লগইন</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            অর্ডার, বিক্রয় ও গ্রাহকের তথ্য দেখতে পাসওয়ার্ড দিন।
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-800/50 p-6 shadow-xl backdrop-blur"
        >
          {error ? (
            <p
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-rose-500/30"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          <label
            className="mb-1.5 block text-sm font-medium text-slate-200"
            htmlFor="admin-password"
          >
            পাসওয়ার্ড
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              <Lock className="h-4 w-4" aria-hidden="true" />
            </span>
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 pl-9 pr-11 text-[15px] text-white placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20"
              placeholder="পাসওয়ার্ড লিখুন"
              autoComplete="current-password"
              required
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:text-slate-200"
              aria-label={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary mt-5 w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                লগইন হচ্ছে...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" aria-hidden="true" />
                লগইন করুন
              </>
            )}
          </button>

          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            পাসওয়ার্ড সেট করা হয় <code className="text-slate-300">.env</code>{" "}
            ফাইলের <code className="text-slate-300">ADMIN_PASSWORD</code> ভেরিয়েবলে।
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          <a href="/" className="hover:text-slate-300">
            ← ওয়েবসাইটে ফিরে যান
          </a>
        </p>
      </div>
    </div>
  );
}
