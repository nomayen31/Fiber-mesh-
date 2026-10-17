import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/products/ProductCard";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { MobileCallBar } from "@/components/landing/MobileCallBar";
import { SectionHeading } from "@/components/ui/Section";
import { site } from "@/content/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "সব পণ্য - ফাইবারগ্লাস মেশ",
  description:
    "৪৫ GSM থেকে ১৬০ GSM পর্যন্ত ফাইবারগ্লাস মেশ - প্রতি রোল ১ মিটার × ৫০ মিটার। দাম, স্পেসিফিকেশন ও অর্ডার।",
};

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <>
      <Header />
      <main className="pb-20 md:pb-0">
        <section className="border-b border-slate-200 bg-slate-50 py-12 sm:py-14">
          <div className="container-x">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              হোমে ফিরে যান
            </Link>
            <div className="mt-6">
              <SectionHeading
                eyebrow={site.productsSection.eyebrow}
                title="আমাদের সব পণ্য"
                subtitle={site.productsSection.subtitle}
                align="left"
              />
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="container-x grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product, index) => (
              <ProductCard
                key={product.slug}
                product={product}
                priority={index < 2}
              />
            ))}
          </div>
        </section>
      </main>
      <Footer />
      <MobileCallBar />
    </>
  );
}
