import { prisma } from "@/lib/prisma";
import {
  addDhakaDays,
  dhakaDayKey,
  formatShortDate,
  startOfDhakaDay,
} from "@/lib/utils";

export type StatsRange = "7d" | "30d" | "90d";

export const statsRanges: { key: StatsRange; label: string; days: number }[] = [
  { key: "7d", label: "৭ দিন", days: 7 },
  { key: "30d", label: "৩০ দিন", days: 30 },
  { key: "90d", label: "৯০ দিন", days: 90 },
];

export function rangeDays(range: StatsRange): number {
  return statsRanges.find((item) => item.key === range)?.days ?? 7;
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;

export async function getDashboardStats(range: StatsRange = "7d") {
  const days = rangeDays(range);
  const now = new Date();
  const todayStart = startOfDhakaDay(now);
  const windowStart = addDhakaDays(todayStart, -(days - 1));
  const ninetyStart = addDhakaDays(todayStart, -89);

  const [
    // Everything from the last 90 days: used for the trend chart, and for the
    // today / 7-day / 30-day cards regardless of the selected range.
    recentOrders,
    allTimeAggregate,
    allTimeCount,
    statusGroups,
    sourceGroups,
    topProductGroups,
    inquiryCount,
    unreadInquiries,
    recentOrdersList,
    todayOrders,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: ninetyStart } },
      select: { createdAt: true, total: true, status: true, quantity: true },
    }),
    prisma.order.aggregate({
      where: { status: { not: "CANCELLED" } },
      _sum: { total: true, quantity: true },
    }),
    prisma.order.count(),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.groupBy({ by: ["source"], _count: { _all: true } }),
    prisma.order.groupBy({
      by: ["productName"],
      where: { status: { not: "CANCELLED" } },
      _sum: { total: true, quantity: true },
      _count: { _all: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }),
    prisma.inquiry.count(),
    prisma.inquiry.count({ where: { isRead: false } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        orderNo: true,
        customerName: true,
        phone: true,
        productName: true,
        quantity: true,
        total: true,
        status: true,
        source: true,
        createdAt: true,
      },
    }),
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
  ]);

  const paid = recentOrders.filter((order) => order.status !== "CANCELLED");
  const sumBetween = (from: Date) => {
    const rows = paid.filter((order) => order.createdAt >= from);
    return {
      orders: rows.length,
      revenue: rows.reduce((total, order) => total + order.total, 0),
      rolls: rows.reduce((total, order) => total + order.quantity, 0),
    };
  };

  const today = sumBetween(todayStart);
  const last7 = sumBetween(addDhakaDays(todayStart, -6));
  const last30 = sumBetween(addDhakaDays(todayStart, -29));

  // Build a dense daily series (days with no orders show as zero).
  const buckets = new Map<string, { date: string; label: string; orders: number; revenue: number; rolls: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const day = addDhakaDays(todayStart, -i);
    const key = dhakaDayKey(day);
    buckets.set(key, {
      date: key,
      label: formatShortDate(day),
      orders: 0,
      revenue: 0,
      rolls: 0,
    });
  }
  for (const order of paid) {
    const key = dhakaDayKey(order.createdAt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.revenue += order.total;
    bucket.rolls += order.quantity;
  }
  const series = [...buckets.values()];

  const statusCounts = {
    PENDING: 0,
    CONFIRMED: 0,
    PROCESSING: 0,
    SHIPPED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  } as Record<string, number>;
  for (const group of statusGroups) {
    statusCounts[group.status] = group._count._all;
  }

  const sourceCounts: Record<string, number> = {};
  for (const group of sourceGroups) {
    sourceCounts[group.source] = group._count._all;
  }

  const websiteSubmissions = sourceCounts.WEBSITE ?? 0;

  return {
    range,
    days,
    windowStart: windowStart.toISOString(),
    generatedAt: now.toISOString(),
    cards: {
      ordersToday: today.orders,
      ordersWeek: last7.orders,
      ordersMonth: last30.orders,
      revenueToday: today.revenue,
      revenueWeek: last7.revenue,
      revenueMonth: last30.revenue,
      rollsThisMonth: last30.rolls,
      totalOrders: allTimeCount,
      totalRevenue: allTimeAggregate._sum.total ?? 0,
      totalRolls: allTimeAggregate._sum.quantity ?? 0,
      avgOrderValue: allTimeCount
        ? Math.round((allTimeAggregate._sum.total ?? 0) / allTimeCount)
        : 0,
      websiteSubmissions,
      manualOrders: sourceCounts.MANUAL ?? 0,
      phoneOrders: sourceCounts.PHONE ?? 0,
      totalFormSubmissions: websiteSubmissions + inquiryCount,
      inquiries: inquiryCount,
      unreadInquiries,
      todaySubmissions: todayOrders,
    },
    series,
    statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    })),
    sourceBreakdown: Object.entries(sourceCounts).map(([source, count]) => ({
      source,
      count,
    })),
    topProducts: topProductGroups.map((group) => ({
      productName: group.productName,
      orders: group._count._all,
      rolls: group._sum.quantity ?? 0,
      revenue: group._sum.total ?? 0,
    })),
    recentOrders: recentOrdersList.map((order) => ({
      ...order,
      createdAt: order.createdAt.toISOString(),
    })),
  };
}
