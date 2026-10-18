/**
 * Tests for the two things the Android app added on top of the existing
 * backend: the manual-order form's payload, and the admin-only diagnostics.
 *
 * Nothing here touches a real order or a real device: the schema/pricing tests
 * are pure, and the route tests only assert that unauthenticated callers are
 * turned away *before* any database or Firebase work could happen.
 *
 *   npm test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";

import { guardAdmin } from "@/lib/api";
import { bearerTokenFrom, createAdminToken } from "@/lib/session";
import { adminOrderSchema } from "@/lib/validators";
import { priceFor } from "@/lib/utils";

/* ─────────────────────────── helpers ─────────────────────────── */

function buildRequest(
  path: string,
  init: { method?: string; bearer?: string } = {},
): NextRequest {
  const headers = new Headers();
  if (init.bearer) headers.set("authorization", `Bearer ${init.bearer}`);
  return new NextRequest(new URL(`http://localhost${path}`), {
    method: init.method ?? "POST",
    headers,
  });
}

/** Parse and fail loudly, so a rejected payload prints its issues. */
function parseOk(input: unknown) {
  const parsed = adminOrderSchema.safeParse(input);
  assert.equal(
    parsed.success,
    true,
    parsed.success ? "" : JSON.stringify(parsed.error.issues),
  );
  return parsed.data;
}

/** The exact payload `apps/lead-notify/src/app/manual-order.tsx` sends. */
const APP_PAYLOAD = {
  customerName: "নোমায়েন হোসেন",
  phone: "01711223344",
  district: "Feni",
  address: "গ্রাম: দাগনভূঞা, ফেনী",
  productSlug: "big-roll",
  unitPrice: 2500,
  quantity: 5,
  applyBulkDiscount: true,
  status: "PENDING",
  source: "MANUAL",
};

/* ───────────────────────── payload validation ───────────────────────── */

describe("adminOrderSchema — manual order payload", () => {
  it("accepts the payload the Android form builds", () => {
    const parsed = parseOk({ ...APP_PAYLOAD });
    assert.equal(parsed.source, "MANUAL");
    assert.equal(parsed.status, "PENDING");
    assert.equal(parsed.quantity, 5);
    assert.equal(parsed.unitPrice, 2500);
  });

  it("defaults the source to MANUAL when the phone omits it", () => {
    const parsed = parseOk({ ...APP_PAYLOAD, source: undefined });
    assert.equal(parsed.source, "MANUAL");
  });

  it("normalises +880 / 880 phone numbers the way the server stores them", () => {
    for (const input of [
      "+8801711223344",
      "8801711223344",
      "01711-223344",
      "01711 223 344",
    ]) {
      assert.equal(parseOk({ ...APP_PAYLOAD, phone: input }).phone, "01711223344", input);
    }
  });

  it("rejects a phone number that is not a Bangladeshi mobile", () => {
    for (const input of [
      "01211223344",
      "0171122334",
      "not-a-phone",
      "+88017112233440",
      "",
    ]) {
      assert.equal(
        adminOrderSchema.safeParse({ ...APP_PAYLOAD, phone: input }).success,
        false,
        input,
      );
    }
  });

  it("rejects a district that is not in the district list", () => {
    assert.equal(
      adminOrderSchema.safeParse({ ...APP_PAYLOAD, district: "Atlantis" }).success,
      false,
    );
  });

  it("accepts an absent optional district/address/note", () => {
    const parsed = parseOk({
      customerName: APP_PAYLOAD.customerName,
      phone: APP_PAYLOAD.phone,
      unitPrice: 100,
      quantity: 1,
    });
    assert.equal(parsed.district, undefined);
    assert.equal(parsed.address, undefined);
    assert.equal(parsed.note, undefined);
  });

  it("bounds the money and quantity fields", () => {
    for (const bad of [
      { unitPrice: 1_000_001 },
      { unitPrice: -1 },
      { quantity: 0 },
      { quantity: 10001 },
      { quantity: 2.5 },
      { quantity: -3 },
    ]) {
      assert.equal(
        adminOrderSchema.safeParse({ ...APP_PAYLOAD, ...bad }).success,
        false,
        JSON.stringify(bad),
      );
    }
  });

  it("caps the free-text fields", () => {
    for (const bad of [
      { note: "ক".repeat(501) },
      { address: "ক".repeat(301) },
      { productName: "ক".repeat(121) },
      { customerName: "ক" },
      { customerName: "ক".repeat(81) },
    ]) {
      assert.equal(
        adminOrderSchema.safeParse({ ...APP_PAYLOAD, ...bad }).success,
        false,
        JSON.stringify(bad).slice(0, 40),
      );
    }
  });

  it("refuses a non-integer unit price, so a phone cannot submit 2500.5", () => {
    assert.equal(
      adminOrderSchema.safeParse({ ...APP_PAYLOAD, unitPrice: 2500.5 }).success,
      false,
    );
  });
});

/* ─────────────────────────── pricing ─────────────────────────── */

describe("priceFor — the server-side total the app previews", () => {
  it("applies the documented bulk tiers at their thresholds", () => {
    assert.equal(priceFor(100, 4).discountPercent, 0);
    assert.equal(priceFor(100, 5).discountPercent, 2);
    assert.equal(priceFor(100, 9).discountPercent, 2);
    assert.equal(priceFor(100, 10).discountPercent, 5);
    assert.equal(priceFor(100, 24).discountPercent, 5);
    assert.equal(priceFor(100, 25).discountPercent, 10);
    assert.equal(priceFor(100, 500).discountPercent, 10);
  });

  it("computes discount and total from the subtotal, rounding to whole taka", () => {
    const five = priceFor(2500, 5);
    assert.deepEqual(
      { subtotal: five.subtotal, discount: five.discount, total: five.total },
      { subtotal: 12500, discount: 250, total: 12250 },
    );

    const odd = priceFor(333, 10);
    assert.equal(odd.subtotal, 3330);
    assert.equal(odd.discount, Math.round((3330 * 5) / 100)); // 167
    assert.equal(odd.total, odd.subtotal - odd.discount);
  });

  it("floors the quantity and never goes below one", () => {
    assert.equal(priceFor(100, 0).quantity, 1);
    assert.equal(priceFor(100, -5).quantity, 1);
    assert.equal(priceFor(100, 2.9).quantity, 2);
    assert.equal(priceFor(100, 2.9).total, 200);
  });

  it("is integer-stable: the same inputs always give the same total", () => {
    for (const qty of [1, 5, 10, 25, 100]) {
      const first = priceFor(1799, qty);
      const second = priceFor(1799, qty);
      assert.equal(first.total, second.total);
      assert.ok(Number.isInteger(first.total));
    }
  });
});

/* ─────────────────────── endpoint authorisation ─────────────────────── */

describe("admin endpoints reject anonymous callers", () => {
  it("refuses POST /api/admin/orders without a session", async () => {
    const { POST } = await import("@/app/api/admin/orders/route");
    const response = await POST(buildRequest("/api/admin/orders"));
    assert.equal(response.status, 401);
  });

  it("refuses POST /api/admin/notifications/test without a session", async () => {
    const { POST } = await import("@/app/api/admin/notifications/test/route");
    const response = await POST(buildRequest("/api/admin/notifications/test"));
    assert.equal(response.status, 401);
  });

  it("refuses GET /api/admin/meta without a session", async () => {
    const { GET } = await import("@/app/api/admin/meta/route");
    const response = await GET(buildRequest("/api/admin/meta", { method: "GET" }));
    assert.equal(response.status, 401);
  });

  it("refuses a forged bearer token and does not fall back to a cookie", async () => {
    const forged = `${await createAdminToken()}.tampered`;
    assert.equal(bearerTokenFrom(`Bearer ${forged}`), forged);

    const denied = await guardAdmin(
      buildRequest("/api/admin/orders", { bearer: forged }),
    );
    assert.notEqual(denied, null);
    assert.equal(denied?.status, 401);
  });

  it("accepts a real session token", async () => {
    const token = await createAdminToken();
    const denied = await guardAdmin(
      buildRequest("/api/admin/orders", { bearer: token }),
    );
    assert.equal(denied, null, "a valid admin token must not be denied");
  });
});

/* ──────────────────────── no credential leakage ──────────────────────── */

describe("the new endpoints never echo server secrets", () => {
  it("keeps Firebase Admin values out of every anonymous error body", async () => {
    const responses = [
      await (
        await import("@/app/api/admin/orders/route")
      ).POST(buildRequest("/api/admin/orders")),
      await (
        await import("@/app/api/admin/notifications/test/route")
      ).POST(buildRequest("/api/admin/notifications/test")),
      await (
        await import("@/app/api/admin/meta/route")
      ).GET(buildRequest("/api/admin/meta", { method: "GET" })),
    ];

    for (const response of responses) {
      const text = await response.text();
      for (const needle of [
        "FIREBASE_PRIVATE_KEY",
        "private_key",
        "BEGIN PRIVATE KEY",
        "service_account",
        "FIREBASE_CLIENT_EMAIL",
      ]) {
        assert.equal(text.includes(needle), false, `${needle} leaked in: ${text}`);
      }
    }
  });
});
