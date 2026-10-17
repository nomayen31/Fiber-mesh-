import { ArrowRight, Check, MessageCircle, Phone } from "lucide-react";
import { site } from "@/content/site";
import { Icon } from "@/components/ui/Icon";
import { Section } from "@/components/ui/Section";

/**
 * Concrete-reinforcement highlight band. Sits between "where to use" (walls)
 * and the application guide, and maps the social post copy onto the site:
 * the post's "ইনবক্স করুন" becomes WhatsApp / phone / catalogue links.
 */
export function ConcreteReinforcement() {
  const { concrete, contact } = site;

  const whatsappHref = `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(
    concrete.whatsappText,
  )}`;

  return (
    <Section id="concrete" tone="brand" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-mesh-grid opacity-40"
      />
      <div className="container-x relative">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-14">
          {/* Copy + the five promises */}
          <div>
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold text-brand-100 ring-1 ring-white/20">
              {concrete.eyebrow}
            </span>

            <h2 className="mt-4 text-balance text-2xl leading-snug text-white sm:text-3xl lg:text-[34px]">
              {concrete.title}
            </h2>
            <p className="mt-4 text-[15px] text-brand-100/90 sm:text-base">
              {concrete.subtitle}
            </p>

            <ul className="mt-8 grid gap-3">
              {concrete.items.map((item) => (
                <li
                  key={item.title}
                  className="flex items-start gap-3.5 rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-brand-200 ring-1 ring-brand-400/25">
                    <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold leading-snug text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-brand-100/80">
                      {item.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Applications + call to action */}
          <div className="rounded-2xl bg-white/[0.07] p-6 ring-1 ring-white/15 backdrop-blur sm:p-7">
            <h3 className="text-sm font-semibold text-brand-100">
              {concrete.applicationsTitle}
            </h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {concrete.applications.map((application) => (
                <li
                  key={application}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-950/60 px-3 py-1.5 text-[13px] font-medium text-brand-50 ring-1 ring-white/15"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                  {application}
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-xl bg-brand-500/15 p-4 ring-1 ring-brand-400/30">
              <p className="text-[15px] font-semibold leading-snug text-white">
                {concrete.callout.title}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-brand-100/85">
                {concrete.callout.text}
              </p>
            </div>

            <div className="mt-5 grid gap-2.5">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-accent w-full"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {concrete.primaryCta}
              </a>
              <a
                href="#products"
                className="btn w-full border border-white/25 bg-white/5 text-white transition hover:bg-white/10 focus-visible:ring-white/25"
              >
                {concrete.secondaryCta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <a
              href={`tel:${contact.phone}`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-100 hover:text-white"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {contact.phoneDisplay}
            </a>

            <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-relaxed text-brand-100/70">
              {concrete.note}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
