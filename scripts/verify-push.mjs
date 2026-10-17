/**
 * Production smoke test for the lead-notification backend.
 *
 *   npm run verify:push                       # against https://fiber-mesh.vercel.app
 *   npm run verify:push -- https://host       # against any other deployment
 *
 * Unlike `src`-level unit tests, this exercises the **deployed** system over the
 * network, against the **real** database. It is opt-in and must be pointed at a
 * base URL deliberately — it is never run by `npm test`.
 *
 * Everything it creates is marked and deleted again, including the outbox job
 * (deleting the order cascades to its jobs and deliveries). It refuses to finish
 * quietly if anything is left behind, and it asserts that the real customer order
 * was never touched.
 *
 * It needs `ADMIN_PASSWORD` and `DATABASE_URL` from `.env`.
 */

import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;

const BASE = (process.argv[2] ?? "https://fiber-mesh.vercel.app").replace(/\/$/, "");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const STAMP = `${Date.now()}`.slice(-8);
const MARKET = `PUSHVERIFY-${STAMP}`;

/** A value that must never appear in a push payload or body. */
const SECRET_NAME = `PUSHVERIFY ক্রেতা ${STAMP}`;
const SECRET_PHONE = "01711111111";

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  ok ? (pass += 1) : (fail += 1);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!ADMIN_PASSWORD) {
  console.error("ADMIN_PASSWORD is not set. Run with: node --env-file=.env scripts/verify-push.mjs");
  process.exit(1);
}

const prisma = new PrismaClient({ log: [] });

console.log(`Push verification: ${BASE}`);
console.log(`marker: ${MARKET}\n`);

try {
  /* ── 0. wait for the deployment carrying the new routes ── */
  console.log("0) Deployment readiness");
  let deployed = false;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const probe = await fetch(`${BASE}/api/admin/mobile/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "__probe__" }),
    });
    if (probe.status !== 404) {
      deployed = true;
      check("new routes are live (mobile login is not 404)", true, `attempt ${attempt}, status=${probe.status}`);
      break;
    }
    if (attempt < 30) await sleep(10_000);
  }
  if (!deployed) {
    check("new routes are live", false, "still 404 after 5 minutes — is the deployment finished?");
  }

  /* ── 1. mobile login ── */
  console.log("\n1) POST /api/admin/mobile/login");
  const badLogin = await fetch(`${BASE}/api/admin/mobile/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "definitely-wrong" }),
  });
  check("wrong password is rejected", badLogin.status === 401, `status=${badLogin.status}`);
  check("no cookie is set by the app login", !badLogin.headers.get("set-cookie"));

  const login = await fetch(`${BASE}/api/admin/mobile/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  const loginJson = await login.json();
  const token = loginJson.token;
  check("correct password returns a token", login.status === 200 && typeof token === "string", `status=${login.status}`);
  if (!token) {
    throw new Error(
      "no token was issued, so the rest cannot run. When verifying a DEPLOYMENT, " +
        "ADMIN_PASSWORD must be that deployment's password, not your local .env value. " +
        'Override it for one run:  $env:ADMIN_PASSWORD = "…"; npm run verify:push',
    );
  }
  check("token is a three-part JWT", /^[\w-]+\.[\w-]+\.[\w-]+$/.test(token ?? ""));
  check("tokenType is Bearer", loginJson.tokenType === "Bearer");
  check("expiresIn looks like a long app session", loginJson.expiresIn > 86_400, `${loginJson.expiresIn}s`);
  check("the login response leaks no password/secret", !JSON.stringify(loginJson).includes(ADMIN_PASSWORD));

  const bearer = (path, init = {}) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    });

  /* ── 2. bearer authorisation ── */
  console.log("\n2) Bearer authorisation on the admin API");
  const stats = await bearer("/api/admin/stats?range=7d");
  check("bearer token is accepted on /api/admin/stats", stats.status === 200, `status=${stats.status}`);

  const statsJson = await stats.json();
  check("stats still aggregate real data", statsJson.cards?.totalOrders >= 1, `totalOrders=${statsJson.cards?.totalOrders}`);

  const bogus = await fetch(`${BASE}/api/admin/stats?range=7d`, {
    headers: { Authorization: "Bearer not.a.real.token" },
  });
  check("an invalid bearer is 401 — never a silent cookie fallback", bogus.status === 401, `status=${bogus.status}`);

  const anonymous = await fetch(`${BASE}/api/admin/stats?range=7d`);
  check("no credentials at all is 401", anonymous.status === 401, `status=${anonymous.status}`);

  const cookieStillWorks = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  const cookie = (cookieStillWorks.headers.get("set-cookie") ?? "").split(";")[0];
  const viaCookie = await fetch(`${BASE}/api/admin/stats?range=7d`, { headers: { cookie } });
  check("browser cookie auth still works (not broken by the bearer change)", viaCookie.status === 200, `status=${viaCookie.status}`);

  /* ── 3. device registration ── */
  console.log("\n3) Device registration");
  const fakeToken = `PUSHVERIFY_FCM_TOKEN_${STAMP}_XXXXXXXXXXXXXXXXXXXX`;

  const devicesBefore = await (await bearer("/api/admin/devices")).json();
  check("GET /api/admin/devices reports 200 with a shape the app can use", Array.isArray(devicesBefore.devices));
  check(
    "server push state is reported as a boolean",
    typeof devicesBefore.pushConfigured === "boolean",
    `pushConfigured=${devicesBefore.pushConfigured}`,
  );
  check(
    "missing server keys are listed as NAMES, never values",
    Array.isArray(devicesBefore.missingServerKeys) &&
      devicesBefore.missingServerKeys.every((k) => /^[A-Z_]+$/.test(k)),
    devicesBefore.missingServerKeys?.join(",") || "(none missing)",
  );
  check(
    "default enabled events are the two inbound lead events",
    devicesBefore.enabledEvents?.includes("order.created") &&
      devicesBefore.enabledEvents?.includes("inquiry.created"),
    devicesBefore.enabledEvents?.join(",") ?? "(none reported)",
  );

  const reg = await bearer("/api/admin/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: fakeToken, platform: "ANDROID", label: MARKET }),
  });
  const regJson = await reg.json();
  const regText = JSON.stringify(regJson);
  check("device registration succeeds", reg.status === 200, `status=${reg.status}`);
  check("the FULL token is never echoed back", !regText.includes(fakeToken));
  check("only a masked preview is returned", regText.includes("••••") && regText.includes(fakeToken.slice(-6)));

  const devicesAfter = await (await bearer("/api/admin/devices")).json();
  const registered = devicesAfter.devices.find((d) => d.tokenPreview?.endsWith(fakeToken.slice(-6)));
  check("the device now appears in the list as active", Boolean(registered?.isActive));

  const deactivated = await bearer(`/api/admin/devices?token=${encodeURIComponent(fakeToken)}`, { method: "DELETE" });
  check("logout-style deactivation succeeds", deactivated.status === 200, `status=${deactivated.status}`);
  const devicesAfterDelete = await (await bearer("/api/admin/devices")).json();
  const stillListed = devicesAfterDelete.devices.find((d) => d.tokenPreview?.endsWith(fakeToken.slice(-6)));
  check("the device is deactivated, not deleted (history kept)", stillListed && stillListed.isActive === false);

  /* ── 4. an order creates a durable outbox job ── */
  console.log("\n4) Order -> outbox job (the core pipeline)");
  const products = await (await fetch(`${BASE}/api/products`)).json();
  const product = products.products.find((p) => p.slug === "fiberglass-mesh-small-roll") ?? products.products[0];

  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: SECRET_NAME,
      phone: SECRET_PHONE,
      district: "Feni",
      address: `টেস্ট ঠিকানা ${STAMP}`,
      productSlug: product.slug,
      quantity: 1,
      note: MARKET,
    }),
  });
  const orderJson = await orderRes.json();
  const createdOrderNo = orderJson.order?.orderNo;
  check("POST /api/orders succeeds", orderRes.status === 200, `status=${orderRes.status}`);
  check("order number issued", /^FM-\d{8}-\d{4}$/.test(createdOrderNo ?? ""), createdOrderNo);
  check(
    "the PUBLIC response does not leak the internal id",
    orderJson.order && !("id" in orderJson.order),
  );

  // The public endpoint deliberately returns no internal id, so resolve it the
  // way an admin would: look the order up by its number.
  const listed = await (await bearer(
    `/api/admin/orders?q=${encodeURIComponent(createdOrderNo)}&page=1&pageSize=5`,
  )).json();
  const order = listed.orders?.find((o) => o.orderNo === createdOrderNo);
  check("the new order is reachable through the admin list", Boolean(order?.id), order ? `id=${order.id}` : "NOT FOUND");
  if (!order?.id) throw new Error("cannot continue without the created order's id");

  const job = await prisma.notificationJob.findUnique({ where: { eventKey: `order.created:${order.id}` } });
  check("exactly one outbox job was committed with the order", Boolean(job), job ? `id=${job.id}` : "NOT FOUND");
  check("eventKey uses the documented <eventType>:<entityId> form", job?.eventKey === `order.created:${order.id}`);
  check("job eventType is order.created", job?.eventType === "order.created");

  const payload = (job?.payload ?? {});
  check("payload says it is an order and names the route", payload.entity === "order" && payload.screen === "order");
  check("payload carries the order id the app deep-links with", payload.orderId === order.id);
  check("job body references the order number", (job?.body ?? "").includes(order.orderNo));

  const scanned = `${job?.title ?? ""} ${job?.body ?? ""} ${JSON.stringify(payload)}`;
  check("NO customer name in the push", !scanned.includes(SECRET_NAME) && !scanned.includes(STAMP));
  check("NO customer phone in the push", !scanned.includes(SECRET_PHONE));
  check("NO delivery address in the push", !scanned.includes("টেস্ট ঠিকানা"));

  // Delivery is attempted via after(), so give it a moment to leave PENDING.
  let settled = job;
  for (let attempt = 0; attempt < 15 && settled?.status === "PENDING"; attempt += 1) {
    await sleep(1_000);
    settled = await prisma.notificationJob.findUnique({ where: { eventKey: `order.created:${order.id}` } });
  }
  check(
    "the job settles instead of sitting PENDING forever",
    settled && settled.status !== "PENDING",
    `status=${settled?.status}${settled?.lastError ? ` lastError=${settled.lastError}` : ""}`,
  );
  check(
    "with no Firebase credentials it degrades to SKIPPED (never FAILED)",
    settled?.status === "SKIPPED" || settled?.status === "SENT",
    `status=${settled?.status}`,
  );

  /* ── 5. idempotency ── */
  console.log("\n5) Idempotency");
  const jobCount = await prisma.notificationJob.count({ where: { orderId: order.id } });
  check("one order produced exactly one job row", jobCount === 1, `count=${jobCount}`);

  /* ── 6. order detail (the push-tap target) ── */
  console.log("\n6) GET /api/admin/orders/:id");
  const detail = await bearer(`/api/admin/orders/${order.id}`);
  const detailJson = await detail.json();
  check("detail returns 200", detail.status === 200, `status=${detail.status}`);
  check("detail returns the same order", detailJson.order?.orderNo === order.orderNo);
  check(
    "dates are ISO strings, identical to the list endpoint's shape",
    typeof detailJson.order?.createdAt === "string" && !Number.isNaN(Date.parse(detailJson.order.createdAt)),
  );
  check("detail exposes the customer fields the app renders", Boolean(detailJson.order?.customerName && detailJson.order?.phone));

  const missing = await bearer(`/api/admin/orders/definitely-not-an-order-id`);
  check("a missing order is 404, not a 500", missing.status === 404, `status=${missing.status}`);

  /* ── 7. cron guard ── */
  console.log("\n7) /api/cron/notifications guard");
  const cron = await fetch(`${BASE}/api/cron/notifications`);
  check(
    "an unauthenticated cron call is refused (503 when CRON_SECRET is unset, else 401)",
    cron.status === 503 || cron.status === 401,
    `status=${cron.status}`,
  );
  check("it is never an open notify-everyone button", cron.status !== 200);

  /* ── 8. the real customer order is untouched ── */
  console.log("\n8) Real data safety");
  const real = await prisma.order.findFirst({ where: { orderNo: "FM-20261018-0001" }, select: { id: true, status: true } });
  check("the genuine customer order FM-20261018-0001 still exists", Boolean(real), real ? `status=${real.status}` : "MISSING");

  /* ── 9. cleanup ── */
  console.log("\n9) Cleanup");
  const del = await bearer(`/api/admin/orders/${order.id}`, { method: "DELETE" });
  check("test order removed via the admin API", del.status === 200, `status=${del.status}`);

  // The device row is deactivated rather than deleted by design, so remove the
  // test row directly; its deliveries cascade.
  await prisma.deviceToken.deleteMany({ where: { token: fakeToken } });

  const leftovers = {
    orders: await prisma.order.count({ where: { note: MARKET } }),
    jobs: await prisma.notificationJob.count({ where: { orderId: order.id } }),
    devices: await prisma.deviceToken.count({ where: { token: fakeToken } }),
  };
  check("no test order left behind", leftovers.orders === 0, `count=${leftovers.orders}`);
  check("the order's outbox job was cascaded away", leftovers.jobs === 0, `count=${leftovers.jobs}`);
  check("no test device left behind", leftovers.devices === 0, `count=${leftovers.devices}`);

  const production = await prisma.order.count();
  console.log(`\n  production order count: ${production}`);
} catch (error) {
  fail += 1;
  console.error(`\n  FAIL  ${error?.message ?? error}`);
  if (error?.stack) console.error(`\n${error.stack}`);
} finally {
  await prisma.$disconnect();
}

console.log(`\n──────── ${pass} passed, ${fail} failed ────────`);
process.exitCode = fail === 0 ? 0 : 1;
