import { site } from "@/content/site";
import { Icon } from "@/components/ui/Icon";
import { Section, SectionHeading } from "@/components/ui/Section";

export function UseCases() {
  const { useCases } = site;

  return (
    <Section id="use-cases" tone="white">
      <div className="container-x">
        <SectionHeading
          eyebrow={useCases.eyebrow}
          title={useCases.title}
          subtitle={useCases.subtitle}
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.items.map((item, index) => (
            <article
              key={item.title}
              className="relative rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition hover:border-brand-200 hover:bg-white hover:shadow-card"
            >
              <span className="absolute right-4 top-4 text-xs font-bold text-slate-300">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand-600 ring-1 ring-slate-200">
                <Icon name={item.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-4 pr-6 text-[17px] leading-snug">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </Section>
  );
}
