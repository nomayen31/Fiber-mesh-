import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProducts } from "@/lib/catalog";
import { ProductCard } from "@/components/products/ProductCard";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { MobileCallBar } from "@/components/landing/MobileCallBar";
import { WhatsAppButton } from "@/components/landing/WhatsAppButton";
import { SectionHeading } from "@/components/ui/Section";
import { site } from "@/content/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "সব পণ্য - ফাইবারগ্লাস মেশ",
  description:
    "Big Roll (৫০ × ১ মিটার, ৫১৫ স্কয়ার ফিট) ও Small Roll (৫০ × ০.৩৩ মিটার, ১৭৪ স্কয়ার ফিট) ফাইবারগ্লাস মেশ - দাম, স্পেসিফিকেশন ও অর্ডার। ফেনী থেকে সারাদেশে হোম ডেলিভারি ও ক্যাশ অন ডেলিভারি।",
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
          <div className="container-x">
            <div
              className={
                products.length <= 2
                  ? "grid max-w-3xl gap-6 sm:grid-cols-2"
                  : "grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
              }
            >
              {products.map((product, index) => (
                <ProductCard
                  key={product.slug}
                  product={product}
                  priority={index < 2}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <MobileCallBar />
      <WhatsAppButton />
    </>
  );
}
