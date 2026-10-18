import type { Metadata, Viewport } from "next";
import { site } from "@/content/site";
import { OrderModalProvider } from "@/components/order/OrderModalProvider";
import { FirebaseAnalytics } from "@/components/analytics/FirebaseAnalytics";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const description =
  "বাংলাদেশে ফাইবারগ্লাস মেশ (Fiberglass Mesh) এর বিশ্বস্ত সরবরাহকারী। দেয়ালের ফাটল, ইট-কনক্রিট জোড়া, জানালার কোণা ও বাইরের প্লাস্টারে ব্যবহারের জন্য Big Roll (৫১৫ স্কয়ার ফিট) ও Small Roll (১৭৪ স্কয়ার ফিট) ফাইবারগ্লাস মেশ। ফেনী থেকে সারাদেশে হোম ডেলিভারি ও ক্যাশ অন ডেলিভারি।";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${site.brand.name} | ফাইবারগ্লাস মেশ - দেয়ালের ফাটল প্রতিরোধের সঠিক সমাধান`,
    template: `%s | ${site.brand.name}`,
  },
  description,
  applicationName: site.brand.name,
  keywords: [
    "Fiberglass mesh",
    "ফাইবারগ্লাস মেশ",
    "ফাইবার মেশ",
    "fiber mesh Bangladesh",
    "দেয়ালের ফাটল প্রতিরোধ",
    "crack control mesh",
    "ইট কনক্রিট জোড়",
    "আলকালাই রেজিস্ট্যান্ট মেশ",
    "ফাইবারগ্লাস মেশ রোল দাম",
    "construction mesh price Bangladesh",
  ],
  authors: [{ name: site.brand.name }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "bn_BD",
    url: siteUrl,
    siteName: site.brand.name,
    title: "দেয়ালের ফাটলের ঝুঁকি কমাতে সঠিক সমাধান, Fiberglass Mesh",
    description,
    images: [
      {
        url: "/assets/hero-banner.jpg",
        width: 1920,
        height: 1080,
        alt: "Fiber Mesh — ফাইবারগ্লাস মেশ, সারাদেশে হোম ডেলিভারি ও ক্যাশ অন ডেলিভারি",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fiber Mesh | ফাইবারগ্লাস মেশ",
    description,
    images: ["/assets/hero-banner.jpg"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/assets/logo.jpg", sizes: "200x200" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d5dd8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bn" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* The provider powers every "অর্ডার করুন" button on the site. */}
        <OrderModalProvider>{children}</OrderModalProvider>
        {/* Loads only in the browser, only on public pages, and never blocks render. */}
        <FirebaseAnalytics />
        <Analytics />
      </body>
    </html>
  );
}
