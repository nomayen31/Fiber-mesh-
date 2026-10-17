import { site } from "@/content/site";
import { Section, SectionHeading } from "@/components/ui/Section";

/**
 * Self-hosted product video (public/assets). `preload="metadata"` keeps the
 * page light — the browser only fetches the video once the user presses play.
 */
export function VideoSection() {
  const { video } = site;

  return (
    <Section id="video" tone="white">
      <div className="container-x">
        <SectionHeading
          eyebrow={video.eyebrow}
          title={video.title}
          subtitle={video.subtitle}
        />

        <div className="mx-auto mt-10 max-w-3xl">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-card">
            <video
              className="aspect-video w-full"
              controls
              playsInline
              preload="metadata"
              poster={video.poster}
            >
              <source src={video.src} type="video/mp4" />
              আপনার ব্রাউজার ভিডিও চালাতে পারছে না।{" "}
              <a href={video.src} className="underline">
                ভিডিওটি ডাউনলোড করুন
              </a>
              ।
            </video>
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">
            {video.caption}
          </p>
        </div>
      </div>
    </Section>
  );
}
