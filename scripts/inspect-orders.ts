/**
 * Read-only listing of orders and inquiries, for audit purposes.
 * Prints a masked phone number and truncates long text.
 *
 *   node --env-file=.env --import tsx scripts/inspect-orders.ts
 */

import { prisma } from "@/lib/prisma";

function maskPhone(phone: string): string {
  return phone.length <= 4 ? "••••" : `${phone.slice(0, 4)}••••${phone.slice(-2)}`;
}

async function main() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      orderNo: true,
      customerName: true,
      phone: true,
      district: true,
      productName: true,
      quantity: true,
      unitPrice: true,
      total: true,
      status: true,
      source: true,
      note: true,
      createdAt: true,
    },
  });

  console.log(`\nOrders: ${orders.length}\n`);
  for (const order of orders) {
    console.log(
      [
        order.createdAt.toISOString(),
        order.orderNo.padEnd(20),
        maskPhone(order.phone),
        `qty=${order.quantity}`,
        `total=${order.total}`,
        order.status.padEnd(10),
        order.source.padEnd(8),
        `note=${(order.note ?? "-").slice(0, 40)}`,
      ].join("  "),
    );
  }

  const inquiries = await prisma.inquiry.findMany({
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, name: true, phone: true, subject: true, isRead: true },
  });
  console.log(`\nInquiries: ${inquiries.length}\n`);
  for (const inquiry of inquiries) {
    console.log(
      `${inquiry.createdAt.toISOString()}  ${maskPhone(inquiry.phone)}  ${inquiry.subject ?? "-"}  read=${inquiry.isRead}`,
    );
  }
}

void (async () => {
  try {
    await main();
  } finally {
    await prisma.$disconnect();
  }
})();
