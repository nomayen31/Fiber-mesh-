/**
 * All 64 districts of Bangladesh, grouped by division, with the delivery time
 * we quote for each. Used by the order modal, the manual-order form, the admin
 * table and the CSV export — edit here and every surface follows.
 *
 * `value` is the English district name and is what gets stored in the database
 * (stable for courier integrations); `label` is what customers see.
 */

export type District = {
  /** Stored value, e.g. "Feni" */
  value: string;
  /** Bengali name shown in the UI, e.g. "ফেনী" */
  label: string;
  /** Delivery estimate shown next to the district, e.g. "২ দিন" */
  delivery: string;
};

export type Division = {
  /** Bengali division name */
  name: string;
  districts: District[];
};

const d = (value: string, label: string, delivery: string): District => ({
  value,
  label,
  delivery,
});

export const divisions: Division[] = [
  {
    name: "ঢাকা বিভাগ",
    districts: [
      d("Dhaka", "ঢাকা", "একই দিনে"),
      d("Faridpur", "ফরিদপুর", "২ দিন"),
      d("Gazipur", "গাজীপুর", "পরের দিন"),
      d("Gopalganj", "গোপালগঞ্জ", "২–৩ দিন"),
      d("Kishoreganj", "কিশোরগঞ্জ", "২ দিন"),
      d("Madaripur", "মাদারীপুর", "২–৩ দিন"),
      d("Manikganj", "মানিকগঞ্জ", "পরের দিন"),
      d("Munshiganj", "মুন্সিগঞ্জ", "পরের দিন"),
      d("Narayanganj", "নারায়ণগঞ্জ", "পরের দিন"),
      d("Narsingdi", "নরসিংদী", "পরের দিন"),
      d("Rajbari", "রাজবাড়ী", "২–৩ দিন"),
      d("Shariatpur", "শরীয়তপুর", "২–৩ দিন"),
      d("Tangail", "টাঙ্গাইল", "২ দিন"),
    ],
  },
  {
    name: "চট্টগ্রাম বিভাগ",
    districts: [
      d("Bandarban", "বান্দরবান", "৩–৪ দিন"),
      d("Brahmanbaria", "ব্রাহ্মণবাড়িয়া", "২ দিন"),
      d("Chandpur", "চাঁদপুর", "২–৩ দিন"),
      d("Chattogram", "চট্টগ্রাম", "পরের দিন"),
      d("Cox's Bazar", "কক্সবাজার", "৩–৪ দিন"),
      d("Cumilla", "কুমিল্লা", "২ দিন"),
      d("Feni", "ফেনী", "২ দিন"),
      d("Khagrachhari", "খাগড়াছড়ি", "৩–৪ দিন"),
      d("Lakshmipur", "লক্ষ্মীপুর", "২–৩ দিন"),
      d("Noakhali", "নোয়াখালী", "২–৩ দিন"),
      d("Rangamati", "রাঙ্গামাটি", "৩–৪ দিন"),
    ],
  },
  {
    name: "রাজশাহী বিভাগ",
    districts: [
      d("Bogura", "বগুড়া", "২ দিন"),
      d("Chapainawabganj", "চাঁপাইনবাবগঞ্জ", "২–৩ দিন"),
      d("Joypurhat", "জয়পুরহাট", "২–৩ দিন"),
      d("Naogaon", "নওগাঁ", "২–৩ দিন"),
      d("Natore", "নাটোর", "২–৩ দিন"),
      d("Pabna", "পাবনা", "২ দিন"),
      d("Rajshahi", "রাজশাহী", "২ দিন"),
      d("Sirajganj", "সিরাজগঞ্জ", "২ দিন"),
    ],
  },
  {
    name: "খুলনা বিভাগ",
    districts: [
      d("Bagerhat", "বাগেরহাট", "২–৩ দিন"),
      d("Chuadanga", "চুয়াডাঙ্গা", "২–৩ দিন"),
      d("Jashore", "যশোর", "২ দিন"),
      d("Jhenaidah", "ঝিনাইদহ", "২–৩ দিন"),
      d("Khulna", "খুলনা", "২ দিন"),
      d("Kushtia", "কুষ্টিয়া", "২–৩ দিন"),
      d("Magura", "মাগুরা", "২–৩ দিন"),
      d("Meherpur", "মেহেরপুর", "২–৩ দিন"),
      d("Narail", "নড়াইল", "২–৩ দিন"),
      d("Satkhira", "সাতক্ষীরা", "৩–৪ দিন"),
    ],
  },
  {
    name: "বরিশাল বিভাগ",
    districts: [
      d("Barguna", "বরগুনা", "৩–৪ দিন"),
      d("Barishal", "বরিশাল", "২ দিন"),
      d("Bhola", "ভোলা", "৩–৪ দিন"),
      d("Jhalokati", "ঝালকাঠি", "২–৩ দিন"),
      d("Patuakhali", "পটুয়াখালী", "৩–৪ দিন"),
      d("Pirojpur", "পিরোজপুর", "২–৩ দিন"),
    ],
  },
  {
    name: "সিলেট বিভাগ",
    districts: [
      d("Habiganj", "হবিগঞ্জ", "২–৩ দিন"),
      d("Moulvibazar", "মৌলভীবাজার", "২–৩ দিন"),
      d("Sunamganj", "সুনামগঞ্জ", "৩–৪ দিন"),
      d("Sylhet", "সিলেট", "২ দিন"),
    ],
  },
  {
    name: "রংপুর বিভাগ",
    districts: [
      d("Dinajpur", "দিনাজপুর", "২–৩ দিন"),
      d("Gaibandha", "গাইবান্ধা", "২–৩ দিন"),
      d("Kurigram", "কুড়িগ্রাম", "৩–৪ দিন"),
      d("Lalmonirhat", "লালমনিরহাট", "৩–৪ দিন"),
      d("Nilphamari", "নীলফামারী", "২–৩ দিন"),
      d("Panchagarh", "পঞ্চগড়", "৩–৪ দিন"),
      d("Rangpur", "রংপুর", "২ দিন"),
      d("Thakurgaon", "ঠাকুরগাঁও", "৩–৪ দিন"),
    ],
  },
  {
    name: "ময়মনসিংহ বিভাগ",
    districts: [
      d("Jamalpur", "জামালপুর", "২–৩ দিন"),
      d("Mymensingh", "ময়মনসিংহ", "২ দিন"),
      d("Netrokona", "নেত্রকোণা", "২–৩ দিন"),
      d("Sherpur", "শেরপুর", "২–৩ দিন"),
    ],
  },
];

/** Flat list — handy for validation and lookups. */
export const districts: District[] = divisions.flatMap((division) =>
  division.districts,
);

const byValue = new Map(districts.map((district) => [district.value, district]));

export function getDistrict(value: string | null | undefined): District | undefined {
  if (!value) return undefined;
  return byValue.get(value);
}

/** Bengali name for a stored district value; falls back to the raw value. */
export function districtLabel(value: string | null | undefined): string {
  if (!value) return "";
  return getDistrict(value)?.label ?? value;
}

/** e.g. "ফেনী — ২ দিন" (empty string when the district is unknown). */
export function districtWithDelivery(value: string | null | undefined): string {
  const district = getDistrict(value);
  return district ? `${district.label} — ${district.delivery}` : (value ?? "");
}
