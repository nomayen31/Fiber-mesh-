import { site } from "@/content/site";
import { Section } from "@/components/ui/Section";

/**
 * "ব্যবহারের ক্ষেত্র" — leaflet / flowchart layout: a gradient header card,
 * eight numbered rows and a cost-saving footer strip.
 *
 * Bengali note: no `uppercase` / letter-spacing here — the global `:lang(bn)`
 * rule in `globals.css` neutralises both anyway, and they visibly break Bengali.
 */
export function UseCases() {
  const { useCases } = site;

  return (
    <Section id="use-cases" tone="white">
      <div className="container-x">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
          {/* ── leaflet header ── */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center text-white">
            <span className="inline-block rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold">
              {useCases.eyebrow}
            </span>
            <h2 className="mt-3 text-[26px] font-bold leading-snug sm:text-3xl md:text-4xl">
              {useCases.title}
            </h2>
            <p className="mt-2 text-sm text-blue-100 md:text-base">
              {useCases.subtitle}
            </p>
          </div>

          {/* ── flowchart rows ── */}
          <div className="space-y-6 p-6 md:p-10">
            {useCases.items.map((item, index) => (
              <div
                key={item.title}
                className="relative flex flex-col items-start rounded-xl border border-blue-100 bg-blue-50/50 p-5 shadow-sm transition hover:shadow-md md:flex-row md:items-center"
              >
                <div className="mb-3 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white md:mb-0 md:mr-5">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">{item.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── leaflet footer ── */}
          <div className="border-t border-gray-200 bg-gray-100 p-6 text-center">
            <p className="text-sm font-medium text-gray-600">
              {useCases.footer}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
