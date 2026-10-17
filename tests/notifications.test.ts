/**
 * Unit tests for the lead-notification pipeline.
 *
 * Everything here runs against an in-memory store and a stub sender: no
 * database, no Firebase credentials, no network, and never a real customer
 * notification.
 *
 *   npm test
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  dispatchJob,
  dispatchPendingJobs,
  enqueueInquiryNotification,
  enqueueOrderNotification,
} from "@/lib/notifications/dispatch";
import {
  buildInquiryNotification,
  buildOrderNotification,
  eventKeyFor,
} from "@/lib/notifications/payload";
import { classifyFirebaseError } from "@/lib/notifications/sender";
import type { OrderNotificationSource } from "@/lib/notifications/payload";
import { MemoryStore } from "./helpers/memory-store";
import { ExplodingSender, StubSender } from "./helpers/stub-sender";

const ORDER: OrderNotificationSource = {
  id: "ord_1",
  orderNo: "FM-20261018-0001",
  productName: "বিগ রোল (Big Roll) — ৫০ × ১ মিটার",
  quantity: 5,
  total: 36750,
  district: "Feni",
  source: "WEBSITE",
};

/** Run a block with `NOTIFY_EVENTS` overridden, restoring it afterwards. */
async function withEvents(events: string, fn: () => Promise<void>): Promise<void> {
  const original = process.env.NOTIFY_EVENTS;
  process.env.NOTIFY_EVENTS = events;
  try {
    await fn();
  } finally {
    if (original === undefined) delete process.env.NOTIFY_EVENTS;
    else process.env.NOTIFY_EVENTS = original;
  }
}

let store: MemoryStore;
let sender: StubSender;

beforeEach(() => {
  store = new MemoryStore();
  sender = new StubSender();
});

/* ────────────────────────────── payload ────────────────────────────── */

describe("notification payload", () => {
  it("keys an event by type and entity so replays collapse into one job", () => {
    assert.equal(eventKeyFor("order.created", "ord_1"), "order.created:ord_1");
    assert.notEqual(
      eventKeyFor("order.created", "ord_1"),
      eventKeyFor("order.confirmed", "ord_1"),
    );
  });

  it("summarises an order without leaking customer personal data", () => {
    const content = buildOrderNotification(ORDER, "order.created");

    assert.match(content.title, /নতুন অর্ডার/);
    assert.ok(content.body.includes("FM-20261018-0001"));
    assert.ok(content.body.includes("× 5"));
    assert.ok(content.body.includes("৳36,750"));

    // The phone is a lock-screen-visible channel: no name, phone or address.
    const serialized = JSON.stringify(content);
    assert.ok(!serialized.includes("01711223344"));
    assert.ok(!/Nomayen|নাম|ঠিকানা/.test(serialized));
  });

  it("emits an FCM data payload with string values only", () => {
    const content = buildOrderNotification(ORDER, "order.created");
    assert.equal(content.data.orderId, "ord_1");
    assert.equal(content.data.type, "order.created");
    assert.equal(content.data.screen, "order");
    for (const [key, value] of Object.entries(content.data)) {
      assert.equal(typeof value, "string", `${key} must be a string`);
    }
  });

  it("uses a distinct title for a confirmed order", () => {
    const created = buildOrderNotification(ORDER, "order.created");
    const confirmed = buildOrderNotification(ORDER, "order.confirmed");
    assert.notEqual(created.title, confirmed.title);
    assert.match(confirmed.title, /কনফার্ম/);
  });

  it("builds an inquiry notification from the subject", () => {
    const content = buildInquiryNotification({
      id: "inq_1",
      name: "করিম",
      subject: "রোলের দাম জানতে চাই",
    });
    assert.match(content.title, /গ্রাহক মেসেজ/);
    assert.ok(content.body.includes("রোলের দাম"));
    assert.equal(content.data.entity, "inquiry");
  });
});

/* ────────────────────────────── enqueue ────────────────────────────── */

describe("enqueue idempotency", () => {
  it("creates exactly one job per order event", async () => {
    const first = await enqueueOrderNotification(ORDER, "order.created", {
      store,
      sender,
    });
    const second = await enqueueOrderNotification(ORDER, "order.created", {
      store,
      sender,
    });

    assert.ok(first, "first enqueue returns a job id");
    assert.equal(second, null, "duplicate enqueue is a no-op");
    assert.equal(store.jobs.size, 1);
  });

  it("allows a confirmed event alongside the created event", async () => {
    // `order.confirmed` is implemented but off by default, so enable it here.
    await withEvents("order.created,order.confirmed", async () => {
      await enqueueOrderNotification(ORDER, "order.created", { store, sender });
      const confirmed = await enqueueOrderNotification(ORDER, "order.confirmed", {
        store,
        sender,
      });
      assert.ok(confirmed);
      assert.equal(store.jobs.size, 2);
    });
  });

  it("enqueues an inquiry once", async () => {
    const payload = { id: "inq_1", name: "করিম", subject: "দাম" };
    assert.ok(await enqueueInquiryNotification(payload, { store, sender }));
    assert.equal(await enqueueInquiryNotification(payload, { store, sender }), null);
  });

  describe("when the event is not enabled", () => {
    it("queues nothing at all", async () => {
      await withEvents("order.confirmed", async () => {
        const jobId = await enqueueOrderNotification(ORDER, "order.created", {
          store,
          sender,
        });
        assert.equal(jobId, null);
        assert.equal(store.jobs.size, 0);
      });
    });

    it("can be switched off entirely with NOTIFY_EVENTS=none", async () => {
      await withEvents("none", async () => {
        assert.equal(
          await enqueueOrderNotification(ORDER, "order.created", { store, sender }),
          null,
        );
        assert.equal(
          await enqueueInquiryNotification({ id: "i", name: "n" }, { store, sender }),
          null,
        );
      });
    });
  });
});

/* ───────────────────────────── dispatch ───────────────────────────── */

async function enqueuedJobId(): Promise<string> {
  const jobId = await enqueueOrderNotification(ORDER, "order.created", {
    store,
    sender,
  });
  assert.ok(jobId, "expected a job id");
  return jobId;
}

describe("dispatchJob", () => {
  it("delivers to every active device and marks the job sent", async () => {
    const a = store.addDevice({ token: "token-a" });
    const b = store.addDevice({ token: "token-b" });
    store.addDevice({ token: "token-retired", isActive: false });
    const jobId = await enqueuedJobId();

    const summary = await dispatchJob(jobId, { store, sender });

    assert.equal(summary.status, "SENT");
    assert.equal(summary.sent, 2);
    assert.deepEqual(sender.tokensSentTo().sort(), [a.token, b.token]);
    assert.equal(await store.getDeliveryStatus(jobId, a.id), "SENT");
    assert.equal(store.jobs.get(jobId)?.attempts, 1);
  });

  it("carries the stored title/body/data into the push", async () => {
    store.addDevice({ token: "token-a" });
    const jobId = await enqueuedJobId();

    await dispatchJob(jobId, { store, sender });

    const call = sender.calls[0]!;
    assert.match(call.content.title, /নতুন অর্ডার/);
    assert.equal(call.content.data.orderId, "ord_1");
    assert.equal(call.content.data.orderNo, "FM-20261018-0001");
  });

  it("skips the job when no device is registered", async () => {
    const jobId = await enqueuedJobId();

    const summary = await dispatchJob(jobId, { store, sender });

    assert.equal(summary.status, "SKIPPED");
    assert.equal(sender.calls.length, 0);
    assert.equal(store.jobs.get(jobId)?.lastError, "no-active-device");
  });

  it("never sends to the same device twice, even if dispatched again", async () => {
    store.addDevice({ token: "token-a" });
    const jobId = await enqueuedJobId();

    await dispatchJob(jobId, { store, sender });
    const second = await dispatchJob(jobId, { store, sender });

    assert.equal(sender.calls.length, 1, "second dispatch must not re-send");
    assert.equal(second.alreadyDone, true);
  });

  it("deactivates a dead token and still delivers to the other devices", async () => {
    const good = store.addDevice({ token: "token-good" });
    const dead = store.addDevice({ token: "token-dead" });
    sender.behavior.set("token-dead", "invalid-token");
    const jobId = await enqueuedJobId();

    const summary = await dispatchJob(jobId, { store, sender });

    assert.equal(summary.sent, 1);
    assert.equal(summary.invalidTokens, 1);
    // A dead token is a *resolved* failure: the device is deactivated, so
    // retrying could never help. The job is therefore done, not retryable.
    assert.equal(summary.status, "SENT");
    assert.equal(store.jobs.get(jobId)?.failedCount, 1);
    assert.equal(store.devices.find((d) => d.id === dead.id)?.isActive, false);
    assert.equal(store.devices.find((d) => d.id === good.id)?.isActive, true);
  });

  it("resolves the job to SENT once the dead device is gone", async () => {
    const dead = store.addDevice({ token: "token-dead" });
    store.addDevice({ token: "token-good" });
    sender.behavior.set("token-dead", "invalid-token");
    const jobId = await enqueuedJobId();

    await dispatchJob(jobId, { store, sender });
    const retry = await dispatchJob(jobId, { store, sender });

    assert.equal(retry.status, "SENT");
    assert.equal(store.devices.find((d) => d.id === dead.id)?.isActive, false);
  });

  it("retries only the device that failed", async () => {
    store.addDevice({ token: "token-a" });
    store.addDevice({ token: "token-b" });
    sender.behavior.set("token-b", "failed");
    const jobId = await enqueuedJobId();

    const first = await dispatchJob(jobId, { store, sender });
    assert.equal(first.status, "FAILED");
    assert.equal(sender.calls.length, 2);

    sender.behavior.set("token-b", "sent");
    const second = await dispatchJob(jobId, { store, sender });

    assert.equal(second.status, "SENT");
    assert.equal(second.sent, 2);
    // token-a was already delivered: it must not have been contacted again.
    assert.deepEqual(sender.tokensSentTo(), [
      "token-a",
      "token-b", // first attempt
      "token-b", // retry only
    ]);
  });

  it("records SKIPPED deliveries when the transport is not configured", async () => {
    store.addDevice({ token: "token-a" });
    sender.defaultOutcome = "skipped";
    const jobId = await enqueuedJobId();

    const summary = await dispatchJob(jobId, { store, sender });

    assert.equal(summary.status, "SKIPPED");
    assert.equal(summary.skipped, 1);
  });

  it("contains a transport exception instead of throwing", async () => {
    store.addDevice({ token: "token-a" });
    const jobId = await enqueuedJobId();

    const summary = await dispatchJob(jobId, {
      store,
      sender: new ExplodingSender(),
    });

    assert.equal(summary.status, "FAILED");
    assert.ok(summary.error);
    // Still retryable, and the job row records the transport error (sanitized).
    assert.equal(store.jobs.get(jobId)?.status, "FAILED");
    assert.match(String(store.jobs.get(jobId)?.lastError), /transport exploded/);
  });

  it("returns MISSING for an unknown job rather than throwing", async () => {
    const summary = await dispatchJob("job_nope", { store, sender });
    assert.equal(summary.status, "MISSING");
    assert.equal(summary.error, "job-not-found");
  });
});

describe("dispatchPendingJobs", () => {
  it("picks up failed jobs and leaves delivered ones alone", async () => {
    store.addDevice({ token: "token-a" });
    const failing = await enqueuedJobId();

    sender.behavior.set("token-a", "failed");
    await dispatchJob(failing, { store, sender });

    sender.behavior.set("token-a", "sent");
    const result = await dispatchPendingJobs({ store, sender });

    assert.equal(result.processed, 1);
    assert.equal(result.summaries[0]?.jobId, failing);
    assert.equal(store.jobs.get(failing)?.status, "SENT");
  });

  it("is a no-op when there is nothing to retry", async () => {
    const result = await dispatchPendingJobs({ store, sender });
    assert.equal(result.processed, 0);
  });
});

/* ──────────────────────── FCM error classification ──────────────────────── */

describe("classifyFirebaseError", () => {
  it("treats an unregistered token as dead", () => {
    assert.equal(
      classifyFirebaseError({
        code: "messaging/registration-token-not-registered",
      }).outcome,
      "invalid-token",
    );
  });

  it("treats a malformed token as dead", () => {
    assert.equal(
      classifyFirebaseError({ code: "messaging/invalid-registration-token" })
        .outcome,
      "invalid-token",
    );
  });

  it("does NOT unregister a device for a generic invalid-argument", () => {
    // A bad payload must not silently delete a working phone.
    assert.equal(
      classifyFirebaseError({ code: "messaging/invalid-argument" }).outcome,
      "failed",
    );
  });

  it("treats an unknown error as retryable", () => {
    assert.equal(classifyFirebaseError(new Error("socket hang up")).outcome, "failed");
    assert.equal(classifyFirebaseError({ code: "messaging/internal-error" }).outcome, "failed");
  });
});
