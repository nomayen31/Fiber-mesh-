/**
 * In-memory stand-in for `NotificationStore`.
 *
 * Reproduces the two behaviours the real database provides that the delivery
 * logic depends on:
 *   - the `eventKey` unique constraint (a duplicate enqueue returns `null`);
 *   - a single delivery row per (job, device), so a retry cannot double-send.
 */

import type {
  CreateJobInput,
  DeviceRecord,
  JobPatch,
  NotificationJobRecord,
  NotificationStore,
  UpsertDeliveryInput,
} from "@/lib/notifications/store";
import { STALE_PROCESSING_MS } from "@/lib/notifications/config";

export type DeliveryRow = UpsertDeliveryInput & { id: string };

export class MemoryStore implements NotificationStore {
  readonly jobs = new Map<string, NotificationJobRecord>();
  readonly devices: DeviceRecord[] = [];
  readonly deliveries = new Map<string, DeliveryRow>();
  /** Set to make `deactivateDevice` blow up, to test error isolation. */
  failOnDeactivate = false;

  private seq = 0;

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  addDevice(partial: Partial<DeviceRecord> & { token: string }): DeviceRecord {
    const device: DeviceRecord = {
      id: partial.id ?? this.nextId("dev"),
      token: partial.token,
      adminId: partial.adminId ?? "admin",
      isActive: partial.isActive ?? true,
    };
    this.devices.push(device);
    return device;
  }

  async createJob(input: CreateJobInput): Promise<NotificationJobRecord | null> {
    for (const job of this.jobs.values()) {
      if (job.eventKey === input.eventKey) return null;
    }
    const job: NotificationJobRecord = {
      id: this.nextId("job"),
      eventKey: input.eventKey,
      eventType: input.eventType,
      title: input.title,
      body: input.body,
      payload: input.payload,
      status: "PENDING",
      attempts: 0,
      sentCount: 0,
      failedCount: 0,
      updatedAt: new Date(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async getJob(id: string): Promise<NotificationJobRecord | null> {
    return this.jobs.get(id) ?? null;
  }

  async updateJob(id: string, patch: JobPatch): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;
    Object.assign(job, patch);
    job.updatedAt = new Date();
  }

  async listActiveDevices(): Promise<DeviceRecord[]> {
    return this.devices.filter((device) => device.isActive);
  }

  async getDeliveryStatus(jobId: string, deviceTokenId: string) {
    return this.deliveries.get(`${jobId}:${deviceTokenId}`)?.status ?? null;
  }

  async upsertDelivery(input: UpsertDeliveryInput): Promise<void> {
    const key = `${input.jobId}:${input.deviceTokenId}`;
    this.deliveries.set(key, { ...input, id: this.deliveries.get(key)?.id ?? this.nextId("dlv") });
  }

  async deactivateDevice(id: string): Promise<void> {
    if (this.failOnDeactivate) throw new Error("deactivate exploded");
    const device = this.devices.find((candidate) => candidate.id === id);
    if (device) device.isActive = false;
  }

  /**
   * Mirrors the Prisma store: a `PROCESSING` row older than
   * `STALE_PROCESSING_MS` is orphaned and offered again, because the instance
   * that claimed it can be reclaimed mid-send without writing a terminal status.
   */
  async listRetryableJobIds({
    maxAttempts,
    limit,
  }: {
    since: Date;
    maxAttempts: number;
    limit: number;
  }): Promise<string[]> {
    const orphanedBefore = Date.now() - STALE_PROCESSING_MS;
    return [...this.jobs.values()]
      .filter((job) => {
        if (job.attempts >= maxAttempts) return false;
        if (job.status === "PENDING" || job.status === "FAILED") return true;
        if (job.status !== "PROCESSING") return false;
        return (job.updatedAt?.getTime() ?? 0) < orphanedBefore;
      })
      .slice(0, limit)
      .map((job) => job.id);
  }
}
