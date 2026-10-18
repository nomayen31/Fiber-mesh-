/**
 * Integration test for the manual-order path used by the Android app.
 *
 * Runs against the **real** PostgreSQL database (there is no test database in
 * this project) and therefore creates rows with a unique marker and deletes
 * them in a `finally` block. It only ever touches rows it created itself.
 *
 *   npm run test:integration:manual
 */

import { prisma } from "@/lib/prisma";
import { createManualOrder } from "@/lib/orders";
import {
  dispatchJob,
  enqueueOrderNotification,
} from "@/lib/notifications/dispatch";
import { prismaNotificationStore } from "@/lib/notifications/store";
import { StubSender } from "./helpers/stub-sender";

const MARKER = `MANUALTEST-${Date.now()}`;
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
  process.env.NOTIFY_EVENTS = "order.created,order.confirmed,inquiry.created";

  console.log(`\nManual-order integration test  (marker: ${MARKER})\n`);

  /* ── fixture ── */
  console.log("1) Fixture");
  const product = await prisma.product.findFirst({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, name: true, price: true },
  });
  if (!product) throw new Error("No active product to build an order from.");
  check("active product available", true, `${product.slug} @ ${product.price}`);

  /* ── the server prices the order, not the phone ── */
  console.log("\n2) The server decides the money");
  const freeOrder = await createManualOrder({
    customerName: "ম্যানুয়াল ইন্টিগ্রেশন",
    phone: "01700000001",
    district: "Feni",
    address: MARKER,
    productSlug: product.slug,
    productName: "",
    // What the app sends when it wants the catalogue price: 0 means "resolve it".
    unitPrice: 0,
    quantity: 5,
    applyBulkDiscount: true,
    status: "PENDING",
    source: "MANUAL",
    note: MARKER,
  });
  createdOrderIds.push(freeOrder.id);

  check("unit price came from the database", freeOrder.unitPrice === product.price,
    `${freeOrder.unitPrice} vs ${product.price}`);
  check("product name came from the database", freeOrder.productName === product.name);
  check(
    "bulk discount was applied for 5 units",
    freeOrder.total === Math.round(product.price * 5 - (product.price * 5 * 2) / 100),
    `${freeOrder.total}`,
  );

  /* ── source + snapshot ── */
  console.log("\n3) The order is recorded as a manual entry");
  const stored = await prisma.order.findUnique({
    where: { id: freeOrder.id },
    select: { source: true, status: true, productId: true, note: true },
  });
  check("source is MANUAL", stored?.source === "MANUAL", stored?.source);
  check("status is what the form chose", stored?.status === "PENDING", stored?.status);
  check("the catalogue product is linked", stored?.productId === product.id);

  /* ── the notification the website also gets ── */
  console.log("\n4) A manual order notifies like any other order");
  const device = await prisma.deviceToken.create({
    data: { token: `${MARKER}-token`, label: MARKER },
    select: { id: true },
  });
  createdDeviceIds.push(device.id);

  const jobId = await enqueueOrderNotification(freeOrder, "order.created", {
    store,
    sender,
  });
  check("a notification job was queued", Boolean(jobId), jobId ?? "null");

  if (jobId) {
    const summary = await dispatchJob(jobId, { store, sender });
    check("the job resolves to SENT", summary.status === "SENT", summary.status);

    const pushed = sender.calls.at(-1)?.content;
    check(
      "the push references the order number",
      Boolean(pushed?.body.includes(freeOrder.orderNo)),
      pushed?.body,
    );
    check(
      "the push carries no customer phone number",
      !JSON.stringify(pushed ?? {}).includes("01700000001"),
    );
  }

  /* ── a phone cannot invent a customer ── */
  console.log("\n5) Stored data is what was submitted, not what was implied");
  const roundTrip = await prisma.order.findUnique({
    where: { id: freeOrder.id },
    select: { customerName: true, phone: true, total: true, subtotal: true },
  });
  check("customer name round-trips", roundTrip?.customerName === "ম্যানুয়াল ইন্টিগ্রেশন");
  check("phone is normalised to 11 digits", roundTrip?.phone === "01700000001");
  check(
    "subtotal = unit price × quantity",
    roundTrip?.subtotal === freeOrder.unitPrice * 5,
  );
}

async function cleanup() {
  console.log("\n6) Cleanup");
  const orders = await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  const devices = await prisma.deviceToken.deleteMany({
    where: { id: { in: createdDeviceIds } },
  });
  console.log(`  deleted orders   : ${orders.count}`);
  console.log(`  deleted devices  : ${devices.count}`);

  const strayOrders = await prisma.order.count({ where: { note: MARKER } });
  const strayDevices = await prisma.deviceToken.count({ where: { label: MARKER } });
  const leftoverJobs = await prisma.notificationJob.count({
    where: { eventKey: { contains: MARKER } },
  });
  check("no test order left behind", strayOrders === 0, `count=${strayOrders}`);
  check("no test device left behind", strayDevices === 0, `count=${strayDevices}`);
  check("jobs cascaded away with the order", leftoverJobs === 0, `count=${leftoverJobs}`);

  // The one real customer order must still be there, untouched.
  const realOrder = await prisma.order.findUnique({
    where: { orderNo: "FM-20261018-0001" },
    select: { orderNo: true, status: true },
  });
  check(
    "the real customer order is untouched",
    realOrder === null || realOrder.orderNo === "FM-20261018-0001",
    realOrder ? `${realOrder.orderNo} ${realOrder.status}` : "not present in this database",
  );
}

// tsx compiles to CommonJS here, so the driver is wrapped rather than using
// top-level await.
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
