"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { site } from "@/content/site";
import { cn } from "@/lib/utils";
import { Section, SectionHeading } from "@/components/ui/Section";

export function Faq() {
  const { faq } = site;
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Section id="faq" tone="white">
      <div className="container-x">
        <SectionHeading
          eyebrow={faq.eyebrow}
          title={faq.title}
          subtitle={faq.subtitle}
        />

        <div className="mx-auto mt-12 max-w-3xl space-y-3">
          {faq.items.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={item.q}
                className={cn(
                  "overflow-hidden rounded-2xl border transition",
                  isOpen
                    ? "border-brand-200 bg-brand-50/40 shadow-card"
                    : "border-slate-200 bg-white",
                )}
              >
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${index}`}
                  >
                    <span className="text-[15px] font-semibold text-slate-900 sm:text-base">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 shrink-0 text-slate-400 transition-transform",
                        isOpen && "rotate-180 text-brand-600",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </h3>
                <div
                  id={`faq-panel-${index}`}
                  hidden={!isOpen}
                  className="px-5 pb-4 text-sm text-slate-600"
                >
                  {item.a}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
