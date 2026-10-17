import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Truck } from "lucide-react";
import { getProductBySlug, getProducts } from "@/lib/catalog";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { MobileCallBar } from "@/components/landing/MobileCallBar";
import {
  ProductCallButton,
  ProductOrderButton,
} from "@/components/products/ProductOrderButton";
import { ProductCard } from "@/components/products/ProductCard";
import { site } from "@/content/site";
import { formatBdt } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "পণ্য পাওয়া যায়নি" };

  return {
    title: `${product.name} - দাম ও স্পেসিফিকেশন`,
    description: `${product.name}: ${product.tagline ?? ""} দাম ${formatBdt(product.price)} প্রতি রোল। ${product.description.slice(0, 120)}`,
    alternates: { canonical: `/products/${product.slug}` },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const others = (await getProducts())
    .filter((item) => item.slug !== product.slug)
    .slice(0, 3);

  return (
    <>
      <Header />
      <main className="pb-20 md:pb-0">
        <div className="border-b border-slate-200 bg-slate-50">
          <div className="container-x py-4">
            <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
              <Link href="/" className="hover:text-brand-700">
                হোম
              </Link>
              <span className="mx-1.5">/</span>
              <Link href="/products" className="hover:text-brand-700">
                পণ্য
              </Link>
              <span className="mx-1.5">/</span>
              <span className="text-slate-700">{product.name}</span>
            </nav>
          </div>
        </div>

        <section className="py-10 sm:py-14">
          <div className="container-x grid gap-10 lg:grid-cols-2 lg:gap-14">
            {/* visual */}
            <div>
              {product.imageUrl ? (
                <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-slate-200 bg-white">
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="mesh-surface flex aspect-[4/3] items-center justify-center rounded-3xl border border-slate-200">
                  <span className="rounded-2xl bg-white/85 px-6 py-4 text-center shadow-sm ring-1 ring-slate-200 backdrop-blur">
                    <span className="block text-4xl font-bold text-slate-900">
                      {product.gsm ?? ""} GSM
                    </span>
                    <span className="mt-1 block text-xs font-medium tracking-[0.2em] text-brand-700">
                      FIBERGLASS MESH
                    </span>
                  </span>
                </div>
              )}

              <ul className="mt-5 grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "প্রস্থ", value: "১ মিটার" },
                  { label: "দৈর্ঘ্য", value: "৫০ মিটার" },
                  { label: "কভারেজ", value: "৫০ বর্গমিটার" },
                ].map((item) => (
                  <li
                    key={item.label}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <span className="block text-xs text-slate-500">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-sm font-semibold text-slate-800">
                      {item.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* details */}
            <div>
              {product.badge ? (
                <span className="inline-flex rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700 ring-1 ring-accent-200">
                  {product.badge}
                </span>
              ) : null}

              <h1 className="mt-3 text-2xl leading-snug sm:text-3xl">
                {product.name}
              </h1>
              {product.nameEn ? (
                <p className="mt-1 text-sm text-slate-500">{product.nameEn}</p>
              ) : null}
              {product.tagline ? (
                <p className="mt-3 text-[15px] text-slate-600">
                  {product.tagline}
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-2 border-y border-slate-200 py-5">
                <p>
                  <span className="text-3xl font-bold text-brand-700">
                    {formatBdt(product.price)}
                  </span>
                  <span className="text-sm text-slate-500">
                    {" "}
                    {site.productsSection.priceSuffix}
                  </span>
                </p>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  স্টকে আছে
                </span>
                <p className="w-full text-xs text-slate-500">
                  {site.productsSection.bulkNote}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <ProductOrderButton slug={product.slug} className="btn-accent flex-1" />
                <ProductCallButton />
              </div>

              <p className="mt-4 flex items-start gap-2 text-sm text-slate-600">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                ঢাকার ভেতরে ২৪-৪৮ ঘণ্টা, ঢাকার বাইরে ২-৪ দিনে ডেলিভারি। ক্যাশ অন
                ডেলিভারি সুবিধা আছে।
              </p>

              <div className="mt-8">
                <h2 className="text-lg">বিস্তারিত বিবরণ</h2>
                <p className="mt-3 text-[15px] text-slate-600">
                  {product.description}
                </p>
              </div>

              <div className="mt-8">
                <h2 className="text-lg">স্পেসিফিকেশন</h2>
                <dl className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                  {product.specs.map((spec) => (
                    <div
                      key={spec.label}
                      className="flex items-start gap-4 px-4 py-3"
                    >
                      <dt className="w-32 shrink-0 text-sm text-slate-500">
                        {spec.label}
                      </dt>
                      <dd className="flex items-start gap-2 text-sm font-medium text-slate-800">
                        <Check
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                          aria-hidden="true"
                        />
                        {spec.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="mt-8 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
                <h2 className="text-base">{site.howTo.note.title}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {site.howTo.note.text}
                </p>
                <Link
                  href="/#how-to"
                  className="mt-3 inline-flex text-sm font-semibold text-brand-700 hover:underline"
                >
                  সম্পূর্ণ ৭ ধাপের গাইড দেখুন
                </Link>
              </div>
            </div>
          </div>
        </section>

        {others.length > 0 ? (
          <section className="border-t border-slate-200 bg-slate-50 py-14">
            <div className="container-x">
              <h2 className="text-xl">অন্য মডেলগুলোও দেখুন</h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((item) => (
                  <ProductCard key={item.slug} product={item} />
                ))}
              </div>
              <Link
                href="/products"
                className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                সব পণ্য দেখুন
              </Link>
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
      <MobileCallBar />
    </>
  );
}
