/**
 * Pure builders for notification content. No database, no network, no env —
 * which makes every rule below directly unit-testable.
 *
 * Privacy rule: the push payload is rendered on a locked phone screen, so the
 * title/body carry only a *safe order reference* (order number, product name,
 * quantity, total). Customer name, phone number and delivery address are never
 * put in a push — the app fetches those from the authenticated API after a tap.
 */

import { formatBdt } from "@/lib/utils";
import type { NotifyEventType } from "@/lib/notifications/config";

/** Shape needed to build an order notification. */
export type OrderNotificationSource = {
  id: string;
  orderNo: string;
  productName: string;
  quantity: number;
  total: number;
  district?: string | null;
  source?: string | null;
};

export type InquiryNotificationSource = {
  id: string;
  name: string;
  subject?: string | null;
};

export type NotificationContent = {
  title: string;
  body: string;
  /** FCM `data` — every value must be a string. */
  data: Record<string, string>;
};

/**
 * Idempotency key. One row per (event, entity), forever: re-processing the same
 * confirmation can never produce a second push.
 */
export function eventKeyFor(eventType: NotifyEventType, entityId: string): string {
  return `${eventType}:${entityId}`;
}

const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "ওয়েবসাইট",
  PHONE: "ফোন",
  MANUAL: "ম্যানুয়াল",
};

export function buildOrderNotification(
  order: OrderNotificationSource,
  eventType: "order.created" | "order.confirmed" = "order.created",
): NotificationContent {
  const confirmed = eventType === "order.confirmed";
  const sourceLabel = order.source ? SOURCE_LABEL[order.source] : undefined;
  const summary = `${order.productName} × ${order.quantity}`;

  return {
    title: confirmed ? "অর্ডার কনফার্ম করা হয়েছে" : "নতুন অর্ডার এসেছে",
    body: `${order.orderNo} • ${summary} • ${formatBdt(order.total)}`,
    data: {
      type: eventType,
      entity: "order",
      orderId: order.id,
      orderNo: order.orderNo,
      screen: "order",
      ...(sourceLabel ? { sourceLabel } : {}),
      ...(order.district ? { district: order.district } : {}),
    },
  };
}

export function buildInquiryNotification(
  inquiry: InquiryNotificationSource,
): NotificationContent {
  const subject = inquiry.subject?.trim();
  return {
    title: "নতুন গ্রাহক মেসেজ",
    body: subject ? subject.slice(0, 120) : "ওয়েবসাইটের যোগাযোগ ফর্ম থেকে নতুন বার্তা",
    data: {
      type: "inquiry.created",
      entity: "inquiry",
      inquiryId: inquiry.id,
      screen: "inquiry",
    },
  };
}

/** Stable JSON shape stored on `NotificationJob.payload`. */
export function toJobPayload(content: NotificationContent, eventType: NotifyEventType) {
  return { ...content.data, eventType };
}
