import { Info } from "lucide-react";
import { site } from "@/content/site";
import { Section, SectionHeading } from "@/components/ui/Section";

export function HowTo() {
  const { howTo } = site;

  return (
    <Section id="how-to" tone="brand">
      <div className="container-x">
        <SectionHeading
          eyebrow={howTo.eyebrow}
          title={howTo.title}
          subtitle={howTo.subtitle}
          invert
        />

        <ol className="mt-12 grid gap-4 lg:grid-cols-2">
          {howTo.steps.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition hover:bg-white/10"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-base font-bold text-white shadow-sm">
                {index + 1}
              </span>
              <div>
                <h3 className="text-[17px] text-white">{step.title}</h3>
                <p className="mt-1.5 text-sm text-brand-100/85">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-accent-400/30 bg-accent-500/10 p-5">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent-300" aria-hidden="true" />
          <div>
            <h3 className="text-[15px] text-accent-100">{howTo.note.title}</h3>
            <p className="mt-1 text-sm text-brand-100/85">{howTo.note.text}</p>
          </div>
        </div>
      </div>
    </Section>
  );
}
