/**
 * Single source of truth for the product catalogue.
 *
 * - `prisma/seed.ts` writes these rows into PostgreSQL.
 * - `src/lib/catalog.ts` uses them as a safe fallback if the database is
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
  /** Optional mesh weight in grams/m². Not used by the current roll sizes. */
  gsm?: number;
  price: number; // BDT per roll
  unit: string;
  badge?: string;
  /** Every photo of this product — rendered as a carousel. First one is primary. */
  images: string[];
  sortOrder: number;
  specs: SeedSpec[];
};

export const seedProducts: SeedProduct[] = [
  {
    slug: "fiberglass-mesh-big-roll",
    name: "বিগ রোল (Big Roll) — ৫০ × ১ মিটার",
    nameEn: "Fiberglass Mesh Big Roll — 50 × 1 m",
    tagline:
      "বড় দেয়াল, ছাদ ও পুরো ঘরের কাজের জন্য। এক রোলেই ৫১৫ স্কয়ার ফিট কভারেজ।",
    description:
      "বিগ রোলের প্রস্থ ১ মিটার, তাই বড় দেয়াল, ছাদের প্লাস্টার, স্ল্যাব ও কনস্ট্রাকশনের ভারী কাজে এটি সবচেয়ে সুবিধাজনক। ৫০ মিটার লম্বা রোল থেকে এক টানেই চওড়া পৃষ্ঠে মেশ বিছিয়ে দেওয়া যায়—জোড়া কম হয়, কাজও দ্রুত এগোয়। যারা পুরো বিল্ডিং বা বড় প্রজেক্টে কাজ করেন, তাদের জন্য এটি সবচেয়ে সাশ্রয়ী প্যাক।",
    price: 7500,
    unit: "রোল",
    badge: "সবচেয়ে বেশি বিক্রি",
    images: [
      "/assets/big-roll-1.jpg",
      "/assets/big-roll-2.jpg",
      "/assets/big-roll-3.jpg",
      "/assets/big-roll-4.jpg",
      "/assets/big-roll-5.jpg",
    ],
    sortOrder: 1,
    specs: [
      { label: "সাইজ", value: "৫০ × ১ মিটার" },
      { label: "ফিটে", value: "১৬০.৫ × ৩.২১ ফুট" },
      { label: "মোট এরিয়া", value: "৫১৫ স্কয়ার ফিট" },
      { label: "প্রস্থ", value: "১ মিটার (৩.২১ ফুট)" },
      { label: "দৈর্ঘ্য", value: "৫০ মিটার (১৬০.৫ ফুট)" },
      { label: "উপাদান", value: "ক্ষার-প্রতিরোধী ফাইবারগ্লাস জালিকা" },
      { label: "রঙ", value: "সাদা" },
      {
        label: "ব্যবহার",
        value: "বাইরের দেয়াল, ছাদের প্লাস্টার, স্ল্যাব, বড় জোড়া, পুরো ঘরের কাজ",
      },
    ],
  },
  {
    slug: "fiberglass-mesh-small-roll",
    name: "স্মল রোল (Small Roll) — ৫০ × ০.৩৩ মিটার",
    nameEn: "Fiberglass Mesh Small Roll — 50 × 0.33 m",
    tagline:
      "জোড়া, জানালার কোণা ও ফাটল মেরামতের জন্য। ছোট কাজে কম খরচে ১৭৪ স্কয়ার ফিট।",
    description:
      "স্মল রোলের প্রস্থ ০.৩৩ মিটার (প্রায় ১ ফুট), তাই জোড়া, জানালা-দরজার কোণা, কলাম ও ফাটল মেরামতের কাজে এটি ব্যবহার করা সহজ। যেখানে পুরো দেয়ালে মেশ লাগবে না, শুধু ফাটলের ঝুঁকিপূর্ণ অংশ সুরক্ষিত করতে হবে—সেখানেই স্মল রোল সবচেয়ে কম খরচে সঠিক সমাধান। মিস্ত্রিরা একা হাতেই সহজে কেটে লাগাতে পারেন।",
    price: 2500,
    unit: "রোল",
    badge: "কম খরচে শুরু",
    images: [
      "/assets/small-roll-1.jpg",
      "/assets/small-roll-2.jpg",
      "/assets/small-roll-3.jpg",
    ],
    sortOrder: 2,
    specs: [
      { label: "সাইজ", value: "৫০ × ০.৩৩ মিটার" },
      { label: "ফিটে", value: "১৬০.৫ × ১.০৮ ফুট" },
      { label: "মোট এরিয়া", value: "১৭৪ স্কয়ার ফিট" },
      { label: "প্রস্থ", value: "০.৩৩ মিটার (১.০৮ ফুট)" },
      { label: "দৈর্ঘ্য", value: "৫০ মিটার (১৬০.৫ ফুট)" },
      { label: "উপাদান", value: "ক্ষার-প্রতিরোধী ফাইবারগ্লাস জালিকা" },
      { label: "রঙ", value: "সাদা" },
      {
        label: "ব্যবহার",
        value: "জোড়া, জানালা-দরজার কোণা, কলাম, ফাটল মেরামত, ছোট কাজ",
      },
    ],
  },
];

/** Bulk discount tiers. Keep in sync with `priceFor()` in src/lib/utils.ts */
export const bulkDiscountTiers = [
  { minQty: 25, percent: 10 },
  { minQty: 10, percent: 5 },
  { minQty: 5, percent: 2 },
];
