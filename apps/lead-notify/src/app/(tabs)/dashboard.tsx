import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  CalendarDays,
  Clock,
  Mail,
  Package,
  PlusCircle,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react-native";

import { BarChart } from "@/components/BarChart";
import {
  Card,
  GhostButton,
  LoadingState,
  Muted,
  PrimaryButton,
  SectionTitle,
  StatCard,
  StatusBadge,
  ErrorNotice,
  Divider,
} from "@/components/ui";
import { usePush } from "@/components/NotificationBridge";
import { useApiData } from "@/lib/useApiData";
import {
  formatBdt,
  formatDateTime,
  formatNumber,
  formatQuantity,
  formatRelative,
  shortProductName,
  sourceLabel,
  statusMeta,
} from "@/lib/format";
import { useSession } from "@/lib/session";
import type { AdminStats, StatsRangeKey } from "@/lib/types";
import { colors, radius, space, typography } from "@/theme";

const RANGES: { key: StatsRangeKey; label: string }[] = [
  { key: "7d", label: "৭ দিন" },
  { key: "30d", label: "৩০ দিন" },
  { key: "90d", label: "৯০ দিন" },
];

/** Port of `DashboardView` — same cards, same order, same labels. */
export default function DashboardScreen() {
  const { request } = useSession();
  const { leadSignal } = usePush();
  const router = useRouter();

  const [range, setRange] = useState<StatsRangeKey>("7d");

  const load = useCallback(
    () =>
      request((api) => api.get<AdminStats>(`/api/admin/stats?range=${range}`)),
    [request, range],
  );

  const { data, error, loading, refreshing, refresh, reload } = useApiData(load);

  /* A lead push arrived while the app is open: pull fresh numbers quietly. */
  const lastSignal = useRef(leadSignal);
  useEffect(() => {
    if (leadSignal === lastSignal.current) return;
    lastSignal.current = leadSignal;
    void refresh();
  }, [leadSignal, refresh]);

  const cards = data?.cards;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          colors={[colors.brand[600]]}
          tintColor={colors.brand[600]}
        />
      }
    >
      {/* ── range selector, mirroring the web header controls ── */}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>ওভারভিউ ও অ্যানালিটিক্স</Text>
          <Muted>
            {data
              ? `সর্বশেষ আপডেট: ${formatDateTime(data.generatedAt)}`
              : "ডেটা লোড হচ্ছে..."}
          </Muted>
        </View>
        <GhostButton label="রিফ্রেশ" icon={RefreshCw} onPress={reload} />
      </View>

      <View style={styles.rangeRow}>
        {RANGES.map((item) => {
          const active = item.key === range;
          return (
            <Text
              key={item.key}
              onPress={() => setRange(item.key)}
              style={[styles.rangeChip, active ? styles.rangeChipActive : null]}
              accessibilityRole="button"
            >
              {item.label}
            </Text>
          );
        })}
      </View>

      {error && !data ? <ErrorNotice message={error} onRetry={reload} /> : null}
      {loading && !data ? <LoadingState label="ড্যাশবোর্ডের তথ্য আনা হচ্ছে..." /> : null}

      {/* ── quick action: the same manual-order form the website has ── */}
      <Card>
        <View style={styles.quickAction}>
          <View style={styles.quickActionIcon}>
            <PlusCircle size={20} color={colors.brand[600]} strokeWidth={2.2} />
          </View>
          <View style={styles.quickActionText}>
            <Text style={styles.quickActionTitle}>ফোনে অর্ডার নিয়েছেন?</Text>
            <Muted>
              কাস্টমারের নাম, নম্বর আর পণ্য দিয়ে সরাসরি অর্ডার যোগ করুন।
            </Muted>
          </View>
        </View>
        <View style={styles.quickActionButton}>
          <PrimaryButton
            label="ম্যানুয়াল অর্ডার যোগ করুন"
            icon={PlusCircle}
            onPress={() => router.push("/manual-order")}
          />
        </View>
      </Card>

      {cards ? (
        <>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <StatCard
                label="আজকের অর্ডার"
                value={formatNumber(cards.ordersToday)}
                hint={`${formatNumber(cards.todaySubmissions)} সাবমিশন`}
                icon={ShoppingCart}
                tone="brand"
              />
            </View>
            <View style={styles.gridItem}>
              <StatCard
                label="আজকের আয়"
                value={formatBdt(cards.revenueToday)}
                icon={Wallet}
                tone="emerald"
              />
            </View>
            <View style={styles.gridItem}>
              <StatCard
                label="এই সপ্তাহের অর্ডার"
                value={formatNumber(cards.ordersWeek)}
                icon={CalendarDays}
                tone="violet"
              />
            </View>
            <View style={styles.gridItem}>
              <StatCard
                label="এই সপ্তাহের আয়"
                value={formatBdt(cards.revenueWeek)}
                icon={TrendingUp}
                tone="emerald"
              />
            </View>
            <View style={styles.gridItem}>
              <StatCard
                label="এই মাসের অর্ডার"
                value={formatNumber(cards.ordersMonth)}
                hint={`${formatQuantity(cards.rollsThisMonth)}`}
                icon={Package}
                tone="amber"
              />
            </View>
            <View style={styles.gridItem}>
              <StatCard
                label="এই মাসের আয়"
                value={formatBdt(cards.revenueMonth)}
                icon={Wallet}
                tone="emerald"
              />
            </View>
          </View>

          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <StatCard
                label="মোট অর্ডার"
                value={formatNumber(cards.totalOrders)}
                icon={ShoppingCart}
                tone="slate"
              />
            </View>
            <View style={styles.gridItem}>
              <StatCard
                label="মোট আয়"
                value={formatBdt(cards.totalRevenue)}
                icon={Wallet}
                tone="brand"
              />
            </View>
            <View style={styles.gridItem}>
              <StatCard
                label="গড় অর্ডার মূল্য"
                value={formatBdt(cards.avgOrderValue)}
                icon={TrendingUp}
                tone="violet"
              />
            </View>
            <View style={styles.gridItem}>
              <StatCard
                label="পড়া হয়নি মেসেজ"
                value={formatNumber(cards.unreadInquiries)}
                hint={`মোট ${formatNumber(cards.inquiries)}টি`}
                icon={Mail}
                tone={cards.unreadInquiries > 0 ? "rose" : "slate"}
              />
            </View>
          </View>

          {/* ── trends: the same two series the web charts ── */}
          <Card>
            <SectionTitle>দৈনিক আয় (৳)</SectionTitle>
            <BarChart
              points={(data?.series ?? []).map((point) => ({
                label: point.label,
                value: point.revenue,
              }))}
            />
          </Card>

          <Card>
            <SectionTitle>দৈনিক অর্ডার</SectionTitle>
            <BarChart
              points={(data?.series ?? []).map((point) => ({
                label: point.label,
                value: point.orders,
              }))}
            />
          </Card>

          {/* ── where the orders came from ── */}
          <Card>
            <SectionTitle>অর্ডারের সোর্স</SectionTitle>
            <View style={styles.sourceRow}>
              <View style={styles.sourceItem}>
                <Text style={styles.sourceValue}>
                  {formatNumber(cards.websiteSubmissions)}
                </Text>
                <Text style={styles.sourceLabel}>{sourceLabel("WEBSITE")}</Text>
              </View>
              <View style={styles.sourceDivider} />
              <View style={styles.sourceItem}>
                <Text style={styles.sourceValue}>
                  {formatNumber(cards.phoneOrders)}
                </Text>
                <Text style={styles.sourceLabel}>{sourceLabel("PHONE")}</Text>
              </View>
              <View style={styles.sourceDivider} />
              <View style={styles.sourceItem}>
                <Text style={styles.sourceValue}>
                  {formatNumber(cards.manualOrders)}
                </Text>
                <Text style={styles.sourceLabel}>{sourceLabel("MANUAL")}</Text>
              </View>
            </View>
          </Card>

          {/* ── status breakdown ── */}
          {data?.statusBreakdown?.length ? (
            <Card>
              <SectionTitle>স্ট্যাটাস অনুযায়ী</SectionTitle>
              <View style={styles.breakdown}>
                {data.statusBreakdown.map((row, index) => {
                  const meta = statusMeta(row.status);
                  const total = data.cards.totalOrders || 1;
                  const percent = Math.min(100, Math.round((row.count / total) * 100));
                  return (
                    <View key={row.status}>
                      {index > 0 ? <Divider /> : null}
                      <View style={styles.breakdownRow}>
                        <StatusBadge status={row.status} />
                        <View style={styles.breakdownBarTrack}>
                          <View
                            style={[
                              styles.breakdownBar,
                              { width: `${percent}%`, backgroundColor: meta.dot },
                            ]}
                          />
                        </View>
                        <Text style={styles.breakdownCount}>
                          {formatNumber(row.count)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          ) : null}

          {/* ── recent orders ── */}
          <Card>
            <View style={styles.recentHeader}>
              <SectionTitle>সর্বশেষ অর্ডার</SectionTitle>
              <GhostButton
                label="সব দেখুন"
                tone="brand"
                onPress={() => router.push("/orders")}
              />
            </View>

            {data?.recentOrders?.length ? (
              data.recentOrders.map((order, index) => (
                <View key={order.id}>
                  {index > 0 ? <Divider /> : null}
                  <Pressable
                    style={({ pressed }) => [
                      styles.recentRow,
                      pressed ? { opacity: 0.8 } : null,
                    ]}
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({ pathname: "/order/[id]", params: { id: order.id } })
                    }
                  >
                    <View style={styles.recentMain}>
                      <Text style={styles.recentTitle}>
                        {shortProductName(order.productName)} ×{" "}
                        {formatNumber(order.quantity)}
                      </Text>
                      <Text style={styles.recentMeta}>
                        {order.orderNo} • {formatRelative(order.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.recentRight}>
                      <Text style={styles.recentTotal}>
                        {formatBdt(order.total)}
                      </Text>
                      <StatusBadge status={order.status} />
                    </View>
                  </Pressable>
                </View>
              ))
            ) : (
              <View style={styles.recentEmpty}>
                <Clock size={18} color={colors.slate[400]} />
                <Text style={styles.recentEmptyText}>এখনো কোনো অর্ডার নেই।</Text>
              </View>
            )}
          </Card>
        </>
      ) : null}

      {error && data ? (
        <View style={styles.inlineError}>
          <AlertCircle size={14} color={colors.rose[700]} />
          <Text style={styles.inlineErrorText}>{error}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate[100] },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
  },
  headerText: { flex: 1, gap: 2 },
  heading: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
  },

  quickAction: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  quickActionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.brand[50],
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: { flex: 1, gap: 2 },
  quickActionTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
  },
  quickActionButton: { marginTop: space.md },

  rangeRow: { flexDirection: "row", gap: space.sm },
  rangeChip: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.slate[600],
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    overflow: "hidden",
  },
  rangeChipActive: {
    color: colors.white,
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[600],
  },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  gridItem: { flexGrow: 1, flexBasis: "47%" },

  sourceRow: { flexDirection: "row", alignItems: "center" },
  sourceItem: { flex: 1, alignItems: "center", gap: 2 },
  sourceDivider: { width: 1, height: 34, backgroundColor: colors.slate[200] },
  sourceValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
  },
  sourceLabel: { fontSize: typography.size.xs, color: colors.slate[500] },

  breakdown: { gap: 0 },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  breakdownBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.slate[100],
    overflow: "hidden",
  },
  breakdownBar: { height: 6, borderRadius: 3 },
  breakdownCount: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.slate[700],
    minWidth: 28,
    textAlign: "right",
  },

  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.sm,
  },
  recentRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  recentMain: { flex: 1, gap: 2 },
  recentTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.slate[900],
  },
  recentMeta: { fontSize: typography.size.xs, color: colors.slate[500] },
  recentRight: { alignItems: "flex-end", gap: 4 },
  recentTotal: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.brand[700],
  },
  recentEmpty: {
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.xl,
  },
  recentEmptyText: { fontSize: typography.size.sm, color: colors.slate[500] },

  inlineError: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    justifyContent: "center",
  },
  inlineErrorText: { fontSize: typography.size.sm, color: colors.rose[700] },
});
