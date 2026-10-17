import { z } from "zod";
import { ORDER_STATUSES, orderSources } from "@/lib/utils";
import { districts } from "@/content/districts";

/**
 * Every payload that reaches the server is validated here with Zod.
 * Error messages are in Bengali because they are shown directly to customers.
 */

export const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;

export const nameField = z
  .string({ required_error: "নাম লিখুন", invalid_type_error: "নাম লিখুন" })
  .trim()
  .min(3, "নাম কমপক্ষে ৩ অক্ষরের হতে হবে")
  .max(80, "নাম অনেক বড় হয়ে গেছে");

export const phoneField = z
  .string({ required_error: "মোবাইল নম্বর দিন", invalid_type_error: "মোবাইল নম্বর দিন" })
  .trim()
  .transform((value) => value.replace(/[\s\-()]/g, ""))
  .transform((value) => {
    if (value.startsWith("+880")) return `0${value.slice(4)}`;
    if (value.startsWith("880")) return `0${value.slice(3)}`;
    return value;
  })
  .refine((value) => BD_PHONE_REGEX.test(value), {
    message: "সঠিক মোবাইল নম্বর দিন (যেমন: 01711223344)",
  });

/**
 * Hidden anti-bot field. It must accept any string here so that a filled
 * honeypot still passes validation — the route handlers then return a fake
 * success instead of telling the bot (via a 422) that it was detected.
 */
const honeypot = z.string().max(1000).optional().default("");

/** One of the 64 districts in src/content/districts.ts. */
const districtValues = districts.map((district) => district.value) as [
  string,
  ...string[],
];

export const districtField = z
  .string({ required_error: "জেলা নির্বাচন করুন", invalid_type_error: "জেলা নির্বাচন করুন" })
  .trim()
  .refine((value) => districtValues.includes(value), {
    message: "তালিকা থেকে আপনার জেলা নির্বাচন করুন",
  });

export const orderCreateSchema = z.object({
  customerName: nameField,
  phone: phoneField,
  district: districtField,
  address: z
    .string({ required_error: "ডেলিভারি ঠিকানা লিখুন" })
    .trim()
    .min(8, "ডেলিভারি ঠিকানা কমপক্ষে ৮ অক্ষরের হতে হবে")
    .max(300, "ঠিকানা অনেক বড় হয়ে গেছে"),
  productSlug: z.string().trim().min(1, "পণ্য নির্বাচন করুন"),
  quantity: z.coerce
    .number({ invalid_type_error: "পরিমাণ সংখ্যায় লিখুন" })
    .int("পরিমাণ পূর্ণসংখ্যা হতে হবে")
    .min(1, "কমপক্ষে ১ রোল")
    .max(10000, "একসাথে ১০,০০০ রোলের বেশি অর্ডার করতে চাইলে ফোন করুন"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  website: honeypot, // hidden anti-bot field: must stay empty
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

export const inquiryCreateSchema = z.object({
  name: nameField,
  phone: phoneField,
  email: z
    .string()
    .trim()
    .max(120)
    .email("সঠিক ইমেইল দিন")
    .optional()
    .or(z.literal("")),
  subject: z.string().trim().max(120).optional().or(z.literal("")),
  message: z
    .string({ required_error: "আপনার প্রশ্ন বা প্রয়োজন লিখুন" })
    .trim()
    .min(10, "বার্তাটি কমপক্ষে ১০ অক্ষরের হতে হবে")
    .max(1000, "বার্তাটি ১০০০ অক্ষরের মধ্যে রাখুন"),
  website: honeypot,
});

export type InquiryCreateInput = z.infer<typeof inquiryCreateSchema>;

export const loginSchema = z.object({
  password: z.string().min(1, "পাসওয়ার্ড দিন"),
});

export const adminOrderSchema = z.object({
  customerName: nameField,
  phone: phoneField,
  district: z
    .string()
    .trim()
    .refine((value) => value === "" || districtValues.includes(value), {
      message: "তালিকা থেকে জেলা নির্বাচন করুন",
    })
    .optional()
    .or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  productSlug: z.string().trim().optional().or(z.literal("")),
  productName: z.string().trim().max(120).optional().or(z.literal("")),
  unitPrice: z.coerce.number().int().min(0).max(1_000_000),
  quantity: z.coerce.number().int().min(1).max(10000),
  applyBulkDiscount: z.coerce.boolean().optional().default(true),
  status: z.enum(ORDER_STATUSES).optional().default("COMPLETED"),
  source: z.enum(orderSources).optional().default("MANUAL"),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  createdAt: z
    .string()
    .trim()
    .optional()
    .or(z.literal("")), // datetime-local value, Bangladesh time
});

export type AdminOrderInput = z.infer<typeof adminOrderSchema>;

export const orderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const orderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum([...ORDER_STATUSES, "ALL"]).optional().default("ALL"),
  source: z.enum([...orderSources, "ALL"]).optional().default("ALL"),
  q: z.string().trim().max(80).optional().default(""),
  from: z.string().trim().optional().default(""),
  to: z.string().trim().optional().default(""),
});

/** Turn a ZodError into `{ field: "message" }` for form UIs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
