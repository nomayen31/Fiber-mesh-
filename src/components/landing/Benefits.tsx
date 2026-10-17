import { site } from "@/content/site";
import { Icon } from "@/components/ui/Icon";
import { Section, SectionHeading } from "@/components/ui/Section";

export function Benefits() {
  const { benefits } = site;

  return (
    <Section id="benefits" tone="muted">
      <div className="container-x">
        <SectionHeading
          eyebrow={benefits.eyebrow}
          title={benefits.title}
          subtitle={benefits.subtitle}
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.items.map((item) => (
            <article
              key={item.title}
              className="card p-5 transition hover:border-brand-200 hover:shadow-card-hover"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                <Icon name={item.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-[17px] leading-snug">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
