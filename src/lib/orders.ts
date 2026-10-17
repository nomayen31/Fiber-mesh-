import { Prisma, type OrderSource, type OrderStatus } from "@prisma/client";
import { isUniqueConstraintError, prisma } from "@/lib/prisma";
import { resolveOrderLine } from "@/lib/catalog";
import {
  addDhakaDays,
  dhakaDayKey,
  priceFor,
  startOfDhakaDay,
} from "@/lib/utils";
import type { AdminOrderInput, OrderCreateInput } from "@/lib/validators";

/* ─────────────────────────── order numbers ─────────────────────────── */

const ORDER_PREFIX = "FM";

/** `FM-20261017-0001` — human readable and unique per day. */
async function nextOrderNo(): Promise<string> {
  const dayKey = dhakaDayKey(new Date()).replace(/-/g, "");
  const prefix = `${ORDER_PREFIX}-${dayKey}-`;
  const last = await prisma.order.findFirst({
    where: { orderNo: { startsWith: prefix } },
    orderBy: { orderNo: "desc" },
    select: { orderNo: true },
  });
  const sequence = last
    ? Number.parseInt(last.orderNo.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(Number.isFinite(sequence) ? sequence : 1).padStart(4, "0")}`;
}

/* ─────────────────────────── create ─────────────────────────── */

export type CreatedOrder = {
  id: string;
  orderNo: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  status: OrderStatus;
  district: string | null;
  createdAt: Date;
};

/** Order placed by a customer through the website modal. */
export async function createWebsiteOrder(
  input: OrderCreateInput,
): Promise<CreatedOrder> {
  const line = await resolveOrderLine(input.productSlug);
  if (!line) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const pricing = priceFor(line.unitPrice, input.quantity);

  // Retry a couple of times in the unlikely event two orders are created in the
  // same millisecond and collide on the daily sequence number.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const order = await prisma.order.create({
        data: {
          orderNo: await nextOrderNo(),
          customerName: input.customerName,
          phone: input.phone,
          district: input.district,
          address: input.address,
          productId: line.productId,
          productName: line.productName,
          unitPrice: pricing.unitPrice,
          quantity: pricing.quantity,
          subtotal: pricing.subtotal,
          discount: pricing.discount,
          total: pricing.total,
          status: "PENDING",
          source: "WEBSITE",
          note: input.note ? input.note : null,
        },
        select: {
          id: true,
          orderNo: true,
          productName: true,
          quantity: true,
          unitPrice: true,
          discount: true,
          total: true,
          status: true,
          district: true,
          createdAt: true,
        },
      });
      return order;
    } catch (error) {
      if (isUniqueConstraintError(error) && attempt < 4) continue;
      throw error;
    }
  }

  throw new Error("ORDER_CREATE_FAILED");
}

/** Order typed in by the admin (phone sales, offline stock, back-dated sales). */
export async function createManualOrder(
  input: AdminOrderInput,
): Promise<CreatedOrder> {
  let productId: string | null = null;
  let productName = input.productName?.trim() ?? "";
  let unitPrice = input.unitPrice;

  if (input.productSlug) {
    const line = await resolveOrderLine(input.productSlug);
    if (line) {
      productId = line.productId;
      if (!productName) productName = line.productName;
      if (!unitPrice || unitPrice <= 0) unitPrice = line.unitPrice;
    }
  }

  if (!productName) productName = "কাস্টম আইটেম";

  const pricing = input.applyBulkDiscount
    ? priceFor(unitPrice, input.quantity)
    : {
        ...priceFor(unitPrice, input.quantity),
        discountPercent: 0,
        discount: 0,
        total: unitPrice * Math.max(1, Math.floor(input.quantity)),
      };

  const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.order.create({
        data: {
          orderNo: await nextOrderNo(),
          customerName: input.customerName,
          phone: input.phone,
          district: input.district ? input.district : null,
          address: input.address ? input.address : null,
          productId,
          productName,
          unitPrice: pricing.unitPrice,
          quantity: pricing.quantity,
          subtotal: pricing.subtotal,
          discount: pricing.discount,
          total: pricing.total,
          status: input.status,
          source: input.source,
          note: input.note ? input.note : null,
          createdBy: "admin",
          ...(input.createdAt && !Number.isNaN(createdAt.getTime())
            ? { createdAt }
            : {}),
        },
        select: {
          id: true,
          orderNo: true,
          productName: true,
          quantity: true,
          unitPrice: true,
          discount: true,
          total: true,
          status: true,
          district: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error) && attempt < 4) continue;
      throw error;
    }
  }

  throw new Error("ORDER_CREATE_FAILED");
}

/* ─────────────────────────── read / update ─────────────────────────── */

export type OrderListParams = {
  page: number;
  pageSize: number;
  status: OrderStatus | "ALL";
  source: OrderSource | "ALL";
  q: string;
  from: string;
  to: string;
};

function buildOrderWhere(params: {
  status: OrderStatus | "ALL";
  source: OrderSource | "ALL";
  q: string;
  from: string;
  to: string;
}): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  if (params.status !== "ALL") where.status = params.status;
  if (params.source !== "ALL") where.source = params.source;

  if (params.q) {
    where.OR = [
      { customerName: { contains: params.q, mode: "insensitive" } },
      { phone: { contains: params.q } },
      { orderNo: { contains: params.q, mode: "insensitive" } },
      { productName: { contains: params.q, mode: "insensitive" } },
      { address: { contains: params.q, mode: "insensitive" } },
      { district: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const createdAt: Prisma.DateTimeFilter = {};
  if (params.from) {
    const from = new Date(params.from);
    if (!Number.isNaN(from.getTime())) {
      createdAt.gte = startOfDhakaDay(from);
    }
  }
  if (params.to) {
    const to = new Date(params.to);
    if (!Number.isNaN(to.getTime())) {
      createdAt.lt = addDhakaDays(startOfDhakaDay(to), 1);
    }
  }
  if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;

  return where;
}

export async function listOrders(params: OrderListParams) {
  const where = buildOrderWhere(params);
  const skip = (params.page - 1) * params.pageSize;

  const [orders, total, aggregate] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: params.pageSize,
    }),
    prisma.order.count({ where }),
    prisma.order.aggregate({
      where: { ...where, status: { not: "CANCELLED" } },
      _sum: { total: true, quantity: true },
    }),
  ]);

  return {
    orders: orders.map((order) => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    })),
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    filteredRevenue: aggregate._sum.total ?? 0,
    filteredRolls: aggregate._sum.quantity ?? 0,
  };
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  return prisma.order.update({
    where: { id },
    data: { status },
    select: { id: true, orderNo: true, status: true },
  });
}

export async function deleteOrder(id: string) {
  return prisma.order.delete({ where: { id }, select: { id: true } });
}

/** Rows for the CSV export (capped so a huge export cannot exhaust memory). */
export async function exportOrders(limit = 5000) {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return orders.map((order) => ({
    ...order,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  }));
}
