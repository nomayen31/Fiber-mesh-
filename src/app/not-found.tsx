import Link from "next/link";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="container-x flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          404
        </p>
        <h1 className="mt-3 text-2xl sm:text-3xl">দুঃখিত, পেজটি খুঁজে পাওয়া যায়নি</h1>
        <p className="mt-3 max-w-md text-sm text-slate-600">
          আপনি যে লিংকে এসেছেন সেটি আর নেই অথবা ঠিকানা ভুল লেখা হয়েছে। নিচের
          লিংক থেকে পণ্য দেখুন বা সরাসরি কল করুন।
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="btn-primary">
            হোমপেজে যান
          </Link>
          <Link href="/products" className="btn-outline">
            সব পণ্য দেখুন
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
