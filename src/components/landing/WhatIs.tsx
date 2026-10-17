import { site } from "@/content/site";
import { Section, SectionHeading } from "@/components/ui/Section";

export function WhatIs() {
  const { whatIs } = site;

  return (
    <Section id="what-is" tone="white">
      <div className="container-x">
        <SectionHeading
          eyebrow={whatIs.eyebrow}
          title={whatIs.title}
          subtitle={whatIs.intro}
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
          <div className="prose-bn space-y-6">
            {whatIs.paragraphs.map((paragraph) => (
              <article key={paragraph.title} className="card p-5 sm:p-6">
                <h3 className="flex items-center gap-3 text-lg">
                  <span
                    className="mesh-surface h-9 w-9 shrink-0 rounded-lg ring-1 ring-slate-200"
                    aria-hidden="true"
                  />
                  {paragraph.title}
                </h3>
                <p className="mt-3 text-[15px] text-slate-600">{paragraph.text}</p>
              </article>
            ))}
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <h3 className="text-base">প্রোডাক্ট স্পেসিফিকেশন</h3>
                <p className="mt-1 text-xs text-slate-500">
                  স্ট্যান্ডার্ড মডেলগুলোর সাধারণ তথ্য
                </p>
              </div>
              <dl className="divide-y divide-slate-100">
                {whatIs.facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="flex items-start justify-between gap-6 px-5 py-3.5"
                  >
                    <dt className="text-sm text-slate-500">{fact.label}</dt>
                    <dd className="text-right text-sm font-medium text-slate-800">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </Section>
  );
}
