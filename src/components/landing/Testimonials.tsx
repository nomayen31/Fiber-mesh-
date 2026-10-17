import { MapPin, Quote, Star } from "lucide-react";
import { site } from "@/content/site";
import { Section, SectionHeading } from "@/components/ui/Section";

/**
 * Social proof block. The three quotes live in `src/content/site.ts` — replace
 * them with real customer feedback as soon as you have it.
 */
export function Testimonials() {
  const { testimonials } = site;

  return (
    <Section id="reviews" tone="muted">
      <div className="container-x">
        <SectionHeading
          eyebrow={testimonials.eyebrow}
          title={testimonials.title}
          subtitle={testimonials.subtitle}
        />

        <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.items.map((item) => (
            <figure
              key={item.name}
              className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex gap-0.5 text-accent-500"
                  aria-label="৫ এ ৫ রেটিং"
                >
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      className="h-3.5 w-3.5 fill-current"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <Quote
                  className="h-6 w-6 text-slate-200"
                  aria-hidden="true"
                />
              </div>

              <blockquote className="mt-3 flex-1 text-[14px] leading-relaxed text-slate-700">
                {item.text}
              </blockquote>

              <figcaption className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                  {item.name.slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {item.name}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500">
                    {item.role}
                    <span aria-hidden="true">·</span>
                    <MapPin className="h-3 w-3" aria-hidden="true" />
                    {item.location}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </Section>
  );
}
