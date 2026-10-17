import { Clock, Facebook, Mail, MapPin, MessageCircle, Phone, Truck } from "lucide-react";
import { site } from "@/content/site";
import { Icon } from "@/components/ui/Icon";
import { Section, SectionHeading } from "@/components/ui/Section";
import { ContactForm } from "@/components/landing/ContactForm";

export function AboutContact() {
  const { about, contact: business, contactSection: contact, delivery } = site;

  const whatsappHref = `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
    "আসসালামু আলাইকুম, আমি ফাইবারগ্লাস মেশ সম্পর্কে জানতে চাই।",
  )}`;

  return (
    <Section id="about" tone="white">
      <div className="container-x">
        {/* ── about ── */}
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <SectionHeading
              eyebrow={about.eyebrow}
              title={about.title}
              align="left"
            />
            <div className="prose-bn mt-5 space-y-4 text-[15px] text-slate-600">
              {about.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 24)}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {about.highlights.map((item) => (
              <article key={item.title} className="card p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-3.5 text-base">{item.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{item.text}</p>
              </article>
            ))}
          </div>
        </div>

        {/* ── contact ── */}
        <div id="contact" className="mt-20 scroll-mt-24">
          <SectionHeading
            eyebrow={contact.eyebrow}
            title={contact.title}
            subtitle={contact.subtitle}
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-4">
              <div className="card divide-y divide-slate-100">
                <a
                  href={`tel:${business.phone}`}
                  className="flex items-center gap-3.5 p-4 transition hover:bg-slate-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Phone className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xs text-slate-500">ফোনে অর্ডার</span>
                    <span className="block font-semibold text-slate-900">
                      {business.phoneDisplay}
                    </span>
                  </span>
                </a>

                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3.5 p-4 transition hover:bg-slate-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <MessageCircle className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xs text-slate-500">হোয়াটসঅ্যাপ</span>
                    <span className="block font-semibold text-slate-900">
                      মেসেজ পাঠান
                    </span>
                  </span>
                </a>

                <a
                  href={business.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3.5 p-4 transition hover:bg-slate-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1877F2]/10 text-[#1877F2]">
                    <Facebook className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xs text-slate-500">ফেসবুক পেজ</span>
                    <span className="block font-semibold text-slate-900">
                      fibermeshbd
                    </span>
                  </span>
                </a>

                {business.email ? (
                  <a
                    href={`mailto:${business.email}`}
                    className="flex items-center gap-3.5 p-4 transition hover:bg-slate-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Mail className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-xs text-slate-500">ইমেইল</span>
                      <span className="block font-semibold text-slate-900">
                        {business.email}
                      </span>
                    </span>
                  </a>
                ) : null}

                <div className="flex items-start gap-3.5 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <MapPin className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xs text-slate-500">ঠিকানা</span>
                    <span className="block font-medium text-slate-800">
                      {business.address}
                    </span>
                  </span>
                </div>

                <div className="flex items-start gap-3.5 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <Clock className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-xs text-slate-500">ব্যবসার সময়</span>
                    <span className="block font-medium text-slate-800">
                      {business.hours}
                    </span>
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                  <Truck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {delivery.headline}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-emerald-900/80">
                  {delivery.note}
                </p>
              </div>

              <p className="rounded-xl bg-amber-50 p-4 text-xs text-amber-800 ring-1 ring-amber-200">
                পাইকারি (wholesale) অর্ডার, বিল্ডার রেট বা প্রজেক্ট সাপ্লাইয়ের জন্য
                সরাসরি ফোন করুন—আলাদা রেট দেওয়া হবে।
              </p>
            </div>

            <ContactForm />
          </div>
        </div>
      </div>
    </Section>
  );
}
