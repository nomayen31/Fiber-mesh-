import Image from "next/image";
import { cn } from "@/lib/utils";

export function Section({
  id,
  className,
  children,
  tone = "white",
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
  tone?: "white" | "muted" | "brand" | "mesh";
}) {
  const tones = {
    white: "bg-white",
    muted: "bg-slate-50",
    brand: "bg-brand-950 text-brand-50",
    mesh: "mesh-surface",
  } as const;

  return (
    <section
      id={id}
      className={cn("scroll-mt-24 py-16 sm:py-20", tones[tone], className)}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  invert = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  invert?: boolean;
}) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" ? "mx-auto text-center" : "text-left",
      )}
    >
      {eyebrow ? (
        <span
          className={cn(
            "mb-3 inline-flex items-center rounded-full px-3 py-1.5 text-[12.5px] font-semibold",
            invert
              ? "bg-white/10 text-brand-100 ring-1 ring-white/20"
              : "bg-brand-50 text-brand-700 ring-1 ring-brand-100",
          )}
        >
          {eyebrow}
        </span>
      ) : null}
      <h2
        className={cn(
          "text-balance text-[25px] leading-[1.4] tracking-normal sm:text-[30px] sm:leading-[1.35] lg:text-[34px]",
          invert ? "text-white" : "text-slate-900",
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={cn(
            "mx-auto mt-3 max-w-2xl text-[14.5px] leading-relaxed sm:text-base",
            invert ? "text-brand-100/90" : "text-slate-600",
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200",
        className,
      )}
    >
      <Image
        src="/assets/logo.jpg"
        alt=""
        width={80}
        height={80}
        className="h-full w-full object-cover"
        aria-hidden="true"
      />
    </span>
  );
}
