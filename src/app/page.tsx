import type { Metadata } from "next";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { PromoBanner } from "@/components/landing/PromoBanner";
import { WhatIs } from "@/components/landing/WhatIs";
import { Benefits } from "@/components/landing/Benefits";
import { UseCases } from "@/components/landing/UseCases";
import { ConcreteReinforcement } from "@/components/landing/ConcreteReinforcement";
import { HowTo } from "@/components/landing/HowTo";
import { VideoSection } from "@/components/landing/VideoSection";
import { ProductsSection } from "@/components/landing/ProductsSection";
import { Testimonials } from "@/components/landing/Testimonials";
import { Gallery } from "@/components/landing/Gallery";
import { Faq } from "@/components/landing/Faq";
import { AboutContact } from "@/components/landing/AboutContact";
import { Footer } from "@/components/landing/Footer";
import { MobileCallBar } from "@/components/landing/MobileCallBar";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "দেয়ালের ফাটলের ঝুঁকি কমাতে সঠিক সমাধান, Fiberglass Mesh",
  description: site.hero.subtitle,
};

/**
 * Every section reads from the DB (products) or from `src/content/site.ts`
 * (copy), so `dynamic` is set to keep the catalogue fresh on each request.
 */
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="pb-28 md:pb-0">
        <Hero />
        <PromoBanner />
        <WhatIs />
        <Benefits />
        <UseCases />
        <ConcreteReinforcement />
        <HowTo />
        <VideoSection />
        <ProductsSection />
        <Testimonials />
        <Gallery />
        <Faq />
        <AboutContact />
      </main>
      <Footer />
      <MobileCallBar />
    </>
  );
}
