import { prisma } from "@/lib/prisma";
import { addDhakaDays, dhakaDayKey, formatShortDate, startOfDhakaDay } from "@/lib/utils";
import type { InquiryCreateInput } from "@/lib/validators";

export async function createInquiry(input: InquiryCreateInput) {
  return prisma.inquiry.create({
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email ? input.email : null,
      subject: input.subject ? input.subject : null,
      message: input.message,
    },
    select: { id: true, createdAt: true },
  });
}

export async function listInquiries(params: {
  page: number;
  pageSize: number;
  q?: string;
  onlyUnread?: boolean;
}) {
  const where = {
    ...(params.onlyUnread ? { isRead: false } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: "insensitive" as const } },
            { phone: { contains: params.q } },
            { message: { contains: params.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.inquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.inquiry.count({ where }),
  ]);

  return {
    inquiries: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export async function toggleInquiryRead(id: string, isRead: boolean) {
  return prisma.inquiry.update({
    where: { id },
    data: { isRead },
    select: { id: true, isRead: true },
  });
}

export async function deleteInquiry(id: string) {
  return prisma.inquiry.delete({ where: { id }, select: { id: true } });
}

export async function exportInquiries(limit = 5000) {
  const rows = await prisma.inquiry.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

/** "2 days ago" style helper for the dashboard list. */
export function relativeDay(date: string): string {
  const today = dhakaDayKey(new Date());
  const target = dhakaDayKey(new Date(date));
  if (today === target) return "আজ";
  if (dhakaDayKey(addDhakaDays(new Date(date), 1)) === today) return "গতকাল";
  return formatShortDate(date);
}

export { startOfDhakaDay };
