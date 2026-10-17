/**
 * Single source of truth for the product catalogue.
 *
 * - `prisma/seed.ts` writes these rows into PostgreSQL.
 * - `src/lib/products.ts` uses them as a safe fallback if the database is
 *   temporarily unreachable, so the landing page never breaks.
 *
 * Edit prices / specs here and re-run `npm run db:seed` to update the database.
 */

export type SeedSpec = { label: string; value: string };

export type SeedProduct = {
  slug: string;
  name: string;
  nameEn: string;
  tagline: string;
  description: string;
  gsm: number;
  price: number; // BDT per roll
  unit: string;
  badge?: string;
  imageUrl?: string;
  sortOrder: number;
  specs: SeedSpec[];
};

export const seedProducts: SeedProduct[] = [
  {
    slug: "fiberglass-mesh-45-gsm",
    name: "ফাইবারগ্লাস মেশ ৪৫ GSM",
    nameEn: "Fiberglass Mesh 45 GSM",
    tagline: "সাধারণ প্লাস্টার ও ঘরের ভেতরের দেয়ালের জন্য অর্থসাশ্রয়ী সমাধান",
    description:
      "৪৫ GSM ফাইবারগ্লাস মেশ ঘরের ভেতরের প্লাস্টার, হালকা জোড়া ও চুল-ফাটল প্রতিরোধে সবচেয়ে বেশি ব্যবহৃত হয়। কম ওজন হওয়ায় এটি সহজে কাটা যায় এবং প্লাস্টারের ভেতরে ভালোভাবে বসে।",
    gsm: 45,
    price: 1250,
    unit: "রোল",
    imageUrl: "/assets/product-45gsm.jpg",
    sortOrder: 1,
    specs: [
      { label: "ওজন (GSM)", value: "৪৫ গ্রাম/বর্গমিটার" },
      { label: "জালিকার ছিদ্র", value: "৪ × ৪ মিমি" },
      { label: "প্রস্থ", value: "১ মিটার" },
      { label: "দৈর্ঘ্য", value: "৫০ মিটার / রোল" },
      { label: "কভারেজ", value: "প্রায় ৫০ বর্গমিটার (৫০০ বর্গফুট)" },
      { label: "উপাদান", value: "ক্ষার-প্রতিরোধী কাচতন্তু জালিকা" },
      { label: "রঙ", value: "সাদা" },
      { label: "ব্যবহার", value: "ভেতরের প্লাস্টার, হালকা জোড়া, ফাটল মেরামত" },
    ],
  },
  {
    slug: "fiberglass-mesh-60-gsm",
    name: "ফাইবারগ্লাস মেশ ৬০ GSM",
    nameEn: "Fiberglass Mesh 60 GSM",
    tagline: "জোড়া ও বাইরের দেয়ালের জন্য সবচেয়ে জনপ্রিয় মডেল",
    description:
      "৬০ GSM মেশ জোড়া মজবুতকরণ এবং বাইরের দেয়ালের প্লাস্টারে দুর্দান্ত পারফর্ম করে। ভেতরের ও বাইরের—দুই কাজেই ব্যবহার করা যায়, তাই ঠিকাদারদের কাছে এটি সবচেয়ে চাহিদাসম্পন্ন মডেল।",
    gsm: 60,
    price: 1650,
    unit: "রোল",
    imageUrl: "/assets/product-60gsm.jpg",
    badge: "সবচেয়ে জনপ্রিয়",
    sortOrder: 2,
    specs: [
      { label: "ওজন (GSM)", value: "৬০ গ্রাম/বর্গমিটার" },
      { label: "জালিকার ছিদ্র", value: "৫ × ৫ মিমি" },
      { label: "প্রস্থ", value: "১ মিটার" },
      { label: "দৈর্ঘ্য", value: "৫০ মিটার / রোল" },
      { label: "কভারেজ", value: "প্রায় ৫০ বর্গমিটার (৫০০ বর্গফুট)" },
      { label: "উপাদান", value: "ক্ষার-প্রতিরোধী কাচতন্তু জালিকা" },
      { label: "রঙ", value: "সাদা / নীল" },
      { label: "ব্যবহার", value: "ইট-কনক্রিট জোড়া, বাইরের দেয়াল, জানালার কোণা" },
    ],
  },
  {
    slug: "fiberglass-mesh-90-gsm",
    name: "ফাইবারগ্লাস মেশ ৯০ GSM",
    nameEn: "Fiberglass Mesh 90 GSM",
    tagline: "ভারী কাজ ও বাইরের পৃষ্ঠের জন্য মজবুত সুরক্ষা",
    description:
      "৯০ GSM মেশ বেশি টান-শক্তি ধরে রাখে, তাই বাইরের দেয়াল, বড় জোড়া, ছাদের প্লাস্টার এবং পুরাতন দেয়াল মেরামতের কাজে এটি ব্যবহার করা হয়। যেখানে ফাটলের ঝুঁকি বেশি, সেখানে এটি সবচেয়ে নির্ভরযোগ্য।",
    gsm: 90,
    price: 2300,
    unit: "রোল",
    imageUrl: "/assets/product-90gsm.jpg",
    badge: "বেস্ট ফর জোড়া",
    sortOrder: 3,
    specs: [
      { label: "ওজন (GSM)", value: "৯০ গ্রাম/বর্গমিটার" },
      { label: "জালিকার ছিদ্র", value: "৫ × ৫ মিমি" },
      { label: "প্রস্থ", value: "১ মিটার" },
      { label: "দৈর্ঘ্য", value: "৫০ মিটার / রোল" },
      { label: "কভারেজ", value: "প্রায় ৫০ বর্গমিটার (৫০০ বর্গফুট)" },
      { label: "উপাদান", value: "ক্ষার-প্রতিরোধী কাচতন্তু জালিকা" },
      { label: "রঙ", value: "সাদা" },
      { label: "ব্যবহার", value: "ছাদের প্লাস্টার, বাইরের দেয়াল, বড় জোড়া, মেরামত" },
    ],
  },
  {
    slug: "fiberglass-mesh-160-gsm-alkali-resistant",
    name: "ফাইবারগ্লাস মেশ ১৬০ GSM (আলকালাই রেজিস্ট্যান্ট)",
    nameEn: "Fiberglass Mesh 160 GSM Alkali Resistant",
    tagline: "প্রিমিয়াম গ্রেড - স্ল্যাব, কলাম ও ইন্ডাস্ট্রিয়াল কাজের জন্য",
    description:
      "১৬০ GSM প্রিমিয়াম গ্রেড মেশ ভারী কনস্ট্রাকশন, স্ল্যাব রিইনফোর্সমেন্ট, কলাম ও থার্মোকল/ইনসুলেশন প্যানেলের ফিনিশিং স্তরে ব্যবহার হয়। উচ্চ টান-শক্তি এবং ক্ষার প্রতিরোধী কোটিং থাকায় দীর্ঘমেয়াদে ফাটল প্রতিরোধে সেরা ফলাফল দেয়।",
    gsm: 160,
    price: 3400,
    unit: "রোল",
    imageUrl: "/assets/product-160gsm.jpg",
    badge: "প্রিমিয়াম",
    sortOrder: 4,
    specs: [
      { label: "ওজন (GSM)", value: "১৬০ গ্রাম/বর্গমিটার" },
      { label: "জালিকার ছিদ্র", value: "৫ × ৫ মিমি" },
      { label: "প্রস্থ", value: "১ মিটার" },
      { label: "দৈর্ঘ্য", value: "৫০ মিটার / রোল" },
      { label: "কভারেজ", value: "প্রায় ৫০ বর্গমিটার (৫০০ বর্গফুট)" },
      { label: "উপাদান", value: "উচ্চ-শক্তির ক্ষার-প্রতিরোধী কাচতন্তু" },
      { label: "রঙ", value: "সাদা" },
      { label: "ব্যবহার", value: "স্ল্যাব, কলাম, ইনসুলেশন প্যানেল, ইন্ডাস্ট্রিয়াল প্লাস্টার" },
    ],
  },
];

/** Bulk discount tiers. Keep in sync with `priceFor()` in src/lib/utils.ts */
export const bulkDiscountTiers = [
  { minQty: 25, percent: 10 },
  { minQty: 10, percent: 5 },
  { minQty: 5, percent: 2 },
];
