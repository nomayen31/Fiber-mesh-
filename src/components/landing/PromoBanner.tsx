import Image from "next/image";
import Link from "next/link";
import { site } from "@/content/site";

/**
 * Full-width promotional banner. The artwork already carries its own message,
 * so the section only provides the link target and the frame.
 */
export function PromoBanner() {
  const { promoBanner } = site;

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="container-x py-6 sm:py-8">
        <Link
          href={promoBanner.href}
          aria-label={promoBanner.alt}
          className="block overflow-hidden rounded-2xl ring-1 ring-slate-200 transition hover:ring-brand-300"
        >
          <div className="relative aspect-[2056/765] w-full bg-slate-100">
            <Image
              src={promoBanner.src}
              alt={promoBanner.alt}
              fill
              sizes="(max-width: 1152px) 100vw, 1152px"
              className="object-cover"
            />
          </div>
        </Link>
      </div>
    </section>
  );
}
