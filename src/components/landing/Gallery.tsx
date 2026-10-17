import Image from "next/image";
import { Facebook } from "lucide-react";
import { site } from "@/content/site";
import { Section, SectionHeading } from "@/components/ui/Section";

/**
 * Social proof pulled from the business Facebook page. Each card links to the
 * page itself — there are no individual post URLs to keep in sync.
 */
export function Gallery() {
  const { gallery, contact } = site;

  return (
    <Section id="gallery" tone="muted">
      <div className="container-x">
        <SectionHeading
          eyebrow={gallery.eyebrow}
          title={gallery.title}
          subtitle={gallery.subtitle}
        />

        <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
          {gallery.items.map((item) => (
            <a
              key={item.src}
              href={contact.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="group overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 transition hover:ring-brand-300 hover:shadow-card-hover"
            >
              <div className="relative aspect-[4/5] w-full bg-white">
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 384px"
                  className="object-contain transition duration-300 group-hover:scale-[1.02]"
                />
              </div>
            </a>
          ))}
        </div>

        <div className="mt-8 text-center">
          <a
            href={contact.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            <Facebook className="h-4 w-4" aria-hidden="true" />
            {gallery.cta}
          </a>
        </div>
      </div>
    </Section>
  );
}
