"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { site } from "@/content/site";

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  subject: "",
  message: "",
  website: "", // honeypot
};

export function ContactForm() {
  const copy = site.contactSection.form;
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  function setField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setErrors({});

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        errors?: Record<string, string>;
      };

      if (!response.ok) {
        setErrors(data.errors ?? {});
        setFormError(data.error ?? "বার্তাটি পাঠানো যায়নি। আবার চেষ্টা করুন।");
        return;
      }

      setSent(true);
      setForm(emptyForm);
    } catch {
      setFormError("ইন্টারনেট সমস্যা হচ্ছে। অনুগ্রহ করে ফোনে যোগাযোগ করুন।");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="card p-6 text-center sm:p-8">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </span>
        <h3 className="text-lg">{copy.successTitle}</h3>
        <p className="mt-2 text-sm text-slate-600">{copy.successText}</p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="btn-outline mt-6"
        >
          আরেকটি বার্তা পাঠান
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5 sm:p-6">
      {formError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {formError}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="contact-name">
            {copy.name} <span className="text-rose-500">*</span>
          </label>
          <input
            id="contact-name"
            className="input"
            value={form.name}
            onChange={(event) => setField("name", event.target.value)}
            minLength={3}
            maxLength={80}
            autoComplete="name"
            required
          />
          {errors.name ? (
            <p className="mt-1 text-xs text-rose-600">{errors.name}</p>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="contact-phone">
            {copy.phone} <span className="text-rose-500">*</span>
          </label>
          <input
            id="contact-phone"
            className="input"
            type="tel"
            inputMode="tel"
            placeholder="01711223344"
            value={form.phone}
            onChange={(event) => setField("phone", event.target.value)}
            autoComplete="tel"
            required
          />
          {errors.phone ? (
            <p className="mt-1 text-xs text-rose-600">{errors.phone}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="contact-email">
            {copy.email}
          </label>
          <input
            id="contact-email"
            className="input"
            type="email"
            value={form.email}
            onChange={(event) => setField("email", event.target.value)}
            autoComplete="email"
            maxLength={120}
          />
          {errors.email ? (
            <p className="mt-1 text-xs text-rose-600">{errors.email}</p>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="contact-subject">
            {copy.subject}
          </label>
          <input
            id="contact-subject"
            className="input"
            value={form.subject}
            onChange={(event) => setField("subject", event.target.value)}
            maxLength={120}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="contact-message">
          {copy.message} <span className="text-rose-500">*</span>
        </label>
        <textarea
          id="contact-message"
          className="input min-h-[120px] resize-y"
          value={form.message}
          onChange={(event) => setField("message", event.target.value)}
          minLength={10}
          maxLength={1000}
          required
        />
        {errors.message ? (
          <p className="mt-1 text-xs text-rose-600">{errors.message}</p>
        ) : null}
      </div>

      <input
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        value={form.website}
        onChange={(event) => setField("website", event.target.value)}
      />

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {copy.sending}
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" />
            {copy.submit}
          </>
        )}
      </button>
    </form>
  );
}
