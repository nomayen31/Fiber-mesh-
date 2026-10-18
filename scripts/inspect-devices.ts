/**
 * Read-only inspection of the notification tables. Prints no tokens — only a
 * masked tail — so it is safe to run against production.
 *
 *   node --env-file=.env --import tsx scripts/inspect-devices.ts
 */

import { prisma } from "@/lib/prisma";

function mask(token: string): string {
  return token.length <= 6 ? "••••" : `••••${token.slice(-6)}`;
}

async function main() {
  const devices = await prisma.deviceToken.findMany({
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      token: true,
      adminId: true,
      platform: true,
      label: true,
      isActive: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });

  console.log(`\nDeviceToken rows: ${devices.length}\n`);
  for (const device of devices) {
    console.log(
      [
        `id=${device.id}`,
        `token=${mask(device.token)}`,
        `admin=${device.adminId}`,
        `platform=${device.platform}`,
        `active=${device.isActive}`,
        `label=${device.label ?? "-"}`,
        `lastSeen=${device.lastSeenAt.toISOString()}`,
      ].join("  "),
    );
  }

  const jobs = await prisma.notificationJob.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  console.log(`\nNotificationJob by status:`);
  for (const row of jobs) console.log(`  ${row.status}: ${row._count._all}`);

  const failed = await prisma.notificationJob.findMany({
    where: { status: { not: "SENT" } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      eventType: true,
      status: true,
      attempts: true,
      lastError: true,
      createdAt: true,
    },
  });
  console.log(`\nRecent non-SENT jobs (${failed.length}):`);
  for (const job of failed) {
    console.log(
      `  ${job.createdAt.toISOString()}  ${job.eventType}  ${job.status}  attempts=${job.attempts}  ${job.lastError ?? ""}`,
    );
  }

  const orders = await prisma.order.count();
  const inquiries = await prisma.inquiry.count();
  console.log(`\norders=${orders}  inquiries=${inquiries}`);
}

void (async () => {
  try {
    await main();
  } finally {
    await prisma.$disconnect();
  }
})();
