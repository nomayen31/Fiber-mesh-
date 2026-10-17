/**
 * Persistence boundary for the notification outbox.
 *
 * The dispatcher talks to this narrow interface rather than to Prisma directly,
 * for two reasons:
 *   1. the delivery rules (idempotency, dead-token handling, retry classification)
 *      become testable with an in-memory store and no database;
 *   2. it documents exactly which queries the pipeline is allowed to run.
 *
 * `createJob` returning `null` is the idempotency signal: the `eventKey` unique
 * constraint rejected the insert because that event was already queued.
 */

import { Prisma, type DeliveryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type NotificationJobRecord = {
  id: string;
  eventKey: string;
  eventType: string;
  title: string;
  body: string;
  payload: Record<string, string>;
  status: DeliveryStatus;
  attempts: number;
  sentCount: number;
  failedCount: number;
  /**
   * The last dispatch failure reason, written by `updateJob`. Optional because
   * `JOB_SELECT` intentionally does not fetch it — dispatch only ever writes it,
   * never reads it back.
   */
  lastError?: string | null;
};

export type DeviceRecord = {
  id: string;
  token: string;
  adminId: string;
  isActive: boolean;
};

export type CreateJobInput = {
  eventKey: string;
  eventType: string;
  orderId: string | null;
  title: string;
  body: string;
  payload: Record<string, string>;
};

export type UpsertDeliveryInput = {
  jobId: string;
  deviceTokenId: string;
  status: DeliveryStatus;
  error?: string | null;
  messageId?: string | null;
};

export type JobPatch = {
  status?: DeliveryStatus;
  attempts?: number;
  sentCount?: number;
  failedCount?: number;
  lastError?: string | null;
  processedAt?: Date | null;
};

export interface NotificationStore {
  /** Returns `null` when the event was already queued (idempotent no-op). */
  createJob(input: CreateJobInput): Promise<NotificationJobRecord | null>;
  getJob(id: string): Promise<NotificationJobRecord | null>;
  updateJob(id: string, patch: JobPatch): Promise<void>;
  listActiveDevices(): Promise<DeviceRecord[]>;
  getDeliveryStatus(jobId: string, deviceTokenId: string): Promise<DeliveryStatus | null>;
  upsertDelivery(input: UpsertDeliveryInput): Promise<void>;
  deactivateDevice(id: string): Promise<void>;
  /** Ids of jobs that still deserve an attempt, oldest first. */
  listRetryableJobIds(options: {
    since: Date;
    maxAttempts: number;
    limit: number;
  }): Promise<string[]>;
}

const JOB_SELECT = {
  id: true,
  eventKey: true,
  eventType: true,
  title: true,
  body: true,
  payload: true,
  status: true,
  attempts: true,
  sentCount: true,
  failedCount: true,
} as const;

function asPayload(value: Prisma.JsonValue): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string>;
  }
  return {};
}

export const prismaNotificationStore: NotificationStore = {
  async createJob(input) {
    try {
      const job = await prisma.notificationJob.create({
        data: {
          eventKey: input.eventKey,
          eventType: input.eventType,
          orderId: input.orderId,
          title: input.title,
          body: input.body,
          payload: input.payload as Prisma.InputJsonValue,
        },
        select: JOB_SELECT,
      });
      return { ...job, payload: asPayload(job.payload) };
    } catch (error) {
      // P2002 = unique violation on `eventKey` → already queued, nothing to do.
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { code?: string }).code === "P2002"
      ) {
        return null;
      }
      throw error;
    }
  },

  async getJob(id) {
    const job = await prisma.notificationJob.findUnique({
      where: { id },
      select: JOB_SELECT,
    });
    return job ? { ...job, payload: asPayload(job.payload) } : null;
  },

  async updateJob(id, patch) {
    await prisma.notificationJob.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.attempts !== undefined ? { attempts: patch.attempts } : {}),
        ...(patch.sentCount !== undefined ? { sentCount: patch.sentCount } : {}),
        ...(patch.failedCount !== undefined ? { failedCount: patch.failedCount } : {}),
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.processedAt !== undefined ? { processedAt: patch.processedAt } : {}),
      },
    });
  },

  async listActiveDevices() {
    return prisma.deviceToken.findMany({
      where: { isActive: true },
      select: { id: true, token: true, adminId: true, isActive: true },
      orderBy: { createdAt: "asc" },
    });
  },

  async getDeliveryStatus(jobId, deviceTokenId) {
    const row = await prisma.notificationDelivery.findUnique({
      where: { jobId_deviceTokenId: { jobId, deviceTokenId } },
      select: { status: true },
    });
    return row?.status ?? null;
  },

  async upsertDelivery(input) {
    await prisma.notificationDelivery.upsert({
      where: {
        jobId_deviceTokenId: {
          jobId: input.jobId,
          deviceTokenId: input.deviceTokenId,
        },
      },
      create: {
        jobId: input.jobId,
        deviceTokenId: input.deviceTokenId,
        status: input.status,
        error: input.error ?? null,
        messageId: input.messageId ?? null,
      },
      update: {
        status: input.status,
        error: input.error ?? null,
        messageId: input.messageId ?? null,
      },
    });
  },

  async deactivateDevice(id) {
    await prisma.deviceToken.update({
      where: { id },
      data: { isActive: false },
    });
  },

  async listRetryableJobIds({ since, maxAttempts, limit }) {
    const rows = await prisma.notificationJob.findMany({
      where: {
        status: { in: ["PENDING", "FAILED"] },
        attempts: { lt: maxAttempts },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  },
};
