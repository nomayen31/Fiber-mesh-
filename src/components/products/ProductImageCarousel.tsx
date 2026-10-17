"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  /** All photos of the product, in display order. */
  images: string[];
  /** Used for the alt text of every slide. */
  alt: string;
  /** `sizes` passed to next/image — keep it in sync with the layout. */
  sizes: string;
  /** Loads the first slide eagerly (use on the first visible card). */
  priority?: boolean;
  /** Applied to the image viewport (aspect ratio, rounding, …). */
  className?: string;
  /** Extra classes for the <img> itself (e.g. padding inside a white frame). */
  imageClassName?: string;
  /** Renders a thumbnail strip under the viewport (product detail page). */
  showThumbnails?: boolean;
  thumbnailsClassName?: string;
};

/**
 * Product photo carousel: swipe on touch, arrows and dots everywhere.
 * Renders a single image without controls when there is only one photo.
 */
export function ProductImageCarousel({
  images,
  alt,
  sizes,
  priority = false,
  className = "",
  imageClassName = "object-contain",
  showThumbnails = false,
  thumbnailsClassName = "",
}: Props) {
  const slides = images.filter(Boolean);
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => (current + delta + count) % count);
    },
    [count],
  );

  if (count === 0) {
    return (
      <div className={`${className} mesh-surface flex items-center justify-center`}>
        <span className="rounded-xl bg-white/85 px-4 py-2 text-center text-sm font-semibold text-brand-700 shadow-sm ring-1 ring-slate-200 backdrop-blur">
          FIBERGLASS MESH
        </span>
      </div>
    );
  }

  if (count === 1) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image
          src={slides[0]}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={imageClassName}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        className={`group/carousel relative overflow-hidden ${className}`}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${alt} — ছবির গ্যালারি`}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null) return;
          const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
          if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1);
          touchStartX.current = null;
        }}
      >
        <div
          className="flex h-full w-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((src, i) => (
            <div key={src} className="relative h-full w-full shrink-0">
              <Image
                src={src}
                alt={`${alt} — ছবি ${i + 1}`}
                fill
                priority={priority && i === 0}
                sizes={sizes}
                className={imageClassName}
              />
            </div>
          ))}
        </div>

        {/* arrows — always visible: most traffic is a phone in a hurry */}
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="আগের ছবি"
          className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur transition hover:bg-white hover:text-brand-700 active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="পরের ছবি"
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur transition hover:bg-white hover:text-brand-700 active:scale-95"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* dots */}
        <div className="absolute inset-x-0 bottom-2.5 flex justify-center">
          <div className="flex items-center gap-1.5 rounded-full bg-white/80 px-2 py-1 shadow-sm ring-1 ring-slate-200 backdrop-blur">
            {slides.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`ছবি ${i + 1} দেখুন`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-brand-600" : "w-1.5 bg-slate-400 hover:bg-slate-500"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {showThumbnails ? (
        <div className={`flex flex-wrap gap-2.5 ${thumbnailsClassName}`}>
          {slides.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`ছবি ${i + 1} দেখুন`}
              aria-current={i === index}
              className={`relative h-16 w-16 overflow-hidden rounded-xl border bg-white transition sm:h-20 sm:w-20 ${
                i === index
                  ? "border-brand-500 ring-2 ring-brand-200"
                  : "border-slate-200 hover:border-brand-300"
              }`}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="80px"
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
