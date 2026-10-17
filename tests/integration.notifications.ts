/**
 * Integration test for the notification outbox — runs against the **real**
 * PostgreSQL database, using the real `prismaNotificationStore`, so the unique
 * index, the cascade rules and the JSON column are all genuinely exercised.
 *
 * It never sends a real push (the sender is a stub) and it deletes every row it
 * creates, in a `finally` block, so the production data is left exactly as it
 * was found.
 *
 *   npm run test:integration
 */

import { prisma } from "@/lib/prisma";
import {
  dispatchJob,
  enqueueOrderNotification,
} from "@/lib/notifications/dispatch";
import { prismaNotificationStore } from "@/lib/notifications/store";
import { StubSender } from "./helpers/stub-sender";

const MARKER = `NOTIFYTEST-${Date.now()}`;
const results: Array<{ name: string; ok: boolean; detail?: string }> = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const store = prismaNotificationStore;
const sender = new StubSender();

const createdOrderIds: string[] = [];
const createdDeviceIds: string[] = [];

async function main() {
  // Deterministic regardless of the ambient environment: exercise every event.
  process.env.NOTIFY_EVENTS = "order.created,order.confirmed,inquiry.created";

  console.log(`\nNotification integration test  (marker: ${MARKER})\n`);

  /* ── fixtures ── */
  console.log("1) Fixtures");
  const product = await prisma.product.findFirst({
    where: { isActive: true },
    select: { id: true, name: true, price: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!product) throw new Error("No active product to build an order from.");
  check("active product available", true, product.name);

  const phone = "01700000000";
  const order = await prisma.order.create({
    data: {
      orderNo: `${MARKER}-A`,
      customerName: "ইন্টিগ্রেশন টেস্ট",
      phone,
      district: "Feni",
      address: "টেস্ট ঠিকানা",
      productId: product.id,
      productName: product.name,
      unitPrice: product.price,
      quantity: 5,
      subtotal: product.price * 5,
      discount: 0,
      total: product.price * 5,
      status: "PENDING",
      source: "WEBSITE",
      note: MARKER,
    },
    select: { id: true, orderNo: true, productName: true, quantity: true, total: true, district: true, source: true },
  });
  createdOrderIds.push(order.id);
  check("test order persisted", Boolean(order.id), order.orderNo);

  const goodDevice = await prisma.deviceToken.create({
    data: { token: `${MARKER}-good`, label: MARKER },
    select: { id: true, isActive: true },
  });
  createdDeviceIds.push(goodDevice.id);

  const deadDevice = await prisma.deviceToken.create({
    data: { token: `${MARKER}-dead`, label: MARKER },
    select: { id: true, isActive: true },
  });
  createdDeviceIds.push(deadDevice.id);
  check("two devices registered", true, `good + dead`);

  /* ── enqueue + idempotency ── */
  console.log("\n2) Outbox enqueue and the database-level idempotency guard");
  const jobId = await enqueueOrderNotification(order, "order.created", { store, sender });
  check("enqueue returns a job id", Boolean(jobId), jobId ?? "null");

  const duplicate = await enqueueOrderNotification(order, "order.created", { store, sender });
  check("duplicate enqueue is rejected by the unique index", duplicate === null);

  const jobCount = await prisma.notificationJob.count({ where: { orderId: order.id } });
  check("exactly one job row exists for the order", jobCount === 1, `count=${jobCount}`);

  const job = await prisma.notificationJob.findUnique({
    where: { id: jobId! },
    select: { status: true, eventType: true, payload: true, title: true, body: true },
  });
  check("job starts PENDING", job?.status === "PENDING", job?.status);
  check("job records the event type", job?.eventType === "order.created");
  check(
    "persisted payload carries no customer PII",
    !JSON.stringify(job?.payload ?? {}).includes(phone),
  );
  check(
    "job body references the order number",
    Boolean(job?.body.includes(order.orderNo)),
    job?.body,
  );

  /* ── happy path delivery ── */
  console.log("\n3) Delivery to every active device");
  const summary = await dispatchJob(jobId!, { store, sender });
  check("job reaches SENT", summary.status === "SENT", summary.status);
  check("both devices were contacted", sender.tokensSentTo().length === 2);

  const deliveries = await prisma.notificationDelivery.findMany({
    where: { jobId: jobId! },
    select: { status: true, messageId: true },
  });
  check(
    "a SENT delivery row exists per device",
    deliveries.length === 2 && deliveries.every((d) => d.status === "SENT"),
    deliveries.map((d) => d.status).join(","),
  );

  /* ── no double send ── */
  console.log("\n4) Duplicate delivery is prevented");
  const callsBefore = sender.tokensSentTo().length;
  const again = await dispatchJob(jobId!, { store, sender });
  check("second dispatch reports alreadyDone", again.alreadyDone === true);
  check(
    "no additional push was attempted",
    sender.tokensSentTo().length === callsBefore,
    `${callsBefore} -> ${sender.tokensSentTo().length}`,
  );

  /* ── dead token ── */
  console.log("\n5) Invalid token handling");
  sender.behavior.set(`${MARKER}-dead`, "invalid-token");
  const secondJobId = await enqueueOrderNotification(order, "order.confirmed", { store, sender });
  if (!secondJobId) {
    check("confirmed-event job created (needs NOTIFY_EVENTS to include it)", false);
  } else {
    const deadSummary = await dispatchJob(secondJobId, { store, sender });
    check("the good device still received it", deadSummary.sent >= 1, `sent=${deadSummary.sent}`);

    const dead = await prisma.deviceToken.findUnique({
      where: { id: deadDevice.id },
      select: { isActive: true },
    });
    check("the dead token was deactivated", dead?.isActive === false);

    const good = await prisma.deviceToken.findUnique({
      where: { id: goodDevice.id },
      select: { isActive: true },
    });
    check("the good token stayed active", good?.isActive === true);
  }

  /* ── the order itself is untouched ── */
  console.log("\n6) Notification work never mutates the order");
  const after = await prisma.order.findUnique({
    where: { id: order.id },
    select: { status: true, total: true, phone: true },
  });
  check("order status unchanged", after?.status === "PENDING", after?.status);
  check("order total unchanged", after?.total === order.total);

  /* ── retry query ── */
  console.log("\n7) Retry window");
  const retryable = await store.listRetryableJobIds({
    since: new Date(Date.now() - 60_000),
    maxAttempts: 5,
    limit: 50,
  });
  check(
    "delivered jobs are not offered for retry",
    !retryable.includes(jobId!),
    `retryable=${retryable.length}`,
  );
}

async function cleanup() {
  console.log("\n8) Cleanup");
  const orders = await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  const devices = await prisma.deviceToken.deleteMany({
    where: { id: { in: createdDeviceIds } },
  });
  const leftoverJobs = await prisma.notificationJob.count({
    where: { eventKey: { contains: MARKER } },
  });
  console.log(`  deleted orders   : ${orders.count}`);
  console.log(`  deleted devices  : ${devices.count}`);
  console.log(`  leftover jobs    : ${leftoverJobs}`);
  const strayOrders = await prisma.order.count({ where: { note: MARKER } });
  const strayDevices = await prisma.deviceToken.count({ where: { label: MARKER } });
  check("no test order left behind", strayOrders === 0);
  check("no test device left behind", strayDevices === 0);
  check("no test job left behind", leftoverJobs === 0);
}

// tsx compiles this project to CommonJS (package.json has no `type: module`),
// so the driver is wrapped rather than using top-level await.
void (async () => {
  try {
    await main();
  } catch (error) {
    console.error("\nIntegration test crashed:", error);
    check("test run completed without crashing", false, String(error));
  } finally {
    try {
      await cleanup();
    } catch (error) {
      console.error("Cleanup failed:", error);
    }
    await prisma.$disconnect();

    const passed = results.filter((r) => r.ok).length;
    const failed = results.length - passed;
    console.log(`\n──────── ${passed} passed, ${failed} failed ────────\n`);
    process.exitCode = failed === 0 ? 0 : 1;
  }
})();
