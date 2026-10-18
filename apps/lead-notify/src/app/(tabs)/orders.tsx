import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Inbox, MapPin, PlusCircle, Search, X } from "lucide-react-native";

import {
  Card,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PrimaryButton,
  StatusBadge,
} from "@/components/ui";
import { usePush } from "@/components/NotificationBridge";
import {
  ORDER_STATUSES,
  formatBdt,
  formatNumber,
  formatRelative,
  shortProductName,
  sourceLabel,
  statusMeta,
  type OrderStatusKey,
} from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Order, OrderListResponse } from "@/lib/types";
import { colors, radius, space, typography } from "@/theme";

const PAGE_SIZE = 15;

type StatusFilter = OrderStatusKey | "ALL";

/** Port of the web `OrdersView` list, adapted to a single scrolling column. */
export default function OrdersScreen() {
  const { request } = useSession();
  const { leadSignal } = usePush();
  const router = useRouter();

  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Guards against an out-of-order response overwriting a newer one. */
  const requestId = useRef(0);

  /* Debounce the search box so typing does not fire a request per keystroke. */
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const buildPath = useCallback(
    (pageNumber: number) => {
      const params = [`page=${pageNumber}`, `pageSize=${PAGE_SIZE}`];
      if (status !== "ALL") params.push(`status=${status}`);
      if (query) params.push(`q=${encodeURIComponent(query)}`);
      return `/api/admin/orders?${params.join("&")}`;
    },
    [status, query],
  );

  const loadFirstPage = useCallback(
    async (mode: "initial" | "refresh") => {
      const id = ++requestId.current;
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const data = await request((api) =>
          api.get<OrderListResponse>(buildPath(1)),
        );
        if (id !== requestId.current) return;
        setOrders(data.orders);
        setTotal(data.total);
        setRevenue(data.filteredRevenue);
        setPage(data.page);
        setTotalPages(data.totalPages);
      } catch (caught) {
        if (id !== requestId.current) return;
        setError(caught instanceof Error ? caught.message : "অর্ডার আনা যায়নি।");
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [request, buildPath],
  );

  /* Filters changed → back to page 1. */
  useEffect(() => {
    void loadFirstPage("initial");
  }, [loadFirstPage]);

  /* A new lead arrived → refresh the top of the list. */
  const lastSignal = useRef(leadSignal);
  useEffect(() => {
    if (leadSignal === lastSignal.current) return;
    lastSignal.current = leadSignal;
    void loadFirstPage("refresh");
  }, [leadSignal, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || refreshing) return;
    if (page >= totalPages) return;

    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await request((api) =>
        api.get<OrderListResponse>(buildPath(nextPage)),
      );
      setOrders((current) => {
        const seen = new Set(current.map((order) => order.id));
        return [...current, ...data.orders.filter((order) => !seen.has(order.id))];
      });
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "আরও অর্ডার আনা যায়নি।");
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, refreshing, page, totalPages, request, buildPath]);

  const header = (
    <View style={styles.header}>
      {/* The website's manual-order form, as a native screen. */}
      <PrimaryButton
        label="ম্যানুয়াল অর্ডার যোগ করুন"
        icon={PlusCircle}
        onPress={() => router.push("/manual-order")}
      />

      <View style={styles.searchWrapper}>
        <Search size={16} color={colors.slate[400]} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="নাম, ফোন, অর্ডার নম্বর বা পণ্য"
          placeholderTextColor={colors.slate[400]}
          style={styles.searchInput}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {search.length > 0 ? (
          <Pressable
            onPress={() => setSearch("")}
            accessibilityRole="button"
            accessibilityLabel="সার্চ মুছুন"
            hitSlop={8}
          >
            <X size={16} color={colors.slate[400]} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <Text
          onPress={() => setStatus("ALL")}
          style={[styles.chip, status === "ALL" ? styles.chipActive : null]}
        >
          সব
        </Text>
        {ORDER_STATUSES.map((key) => {
          const active = status === key;
          return (
            <Text
              key={key}
              onPress={() => setStatus(key)}
              style={[
                styles.chip,
                active ? styles.chipActive : null,
              ]}
            >
              {statusMeta(key).label}
            </Text>
          );
        })}
      </ScrollView>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {formatNumber(total)}টি অর্ডার • {formatBdt(revenue)}
        </Text>
      </View>

      {error ? <ErrorNotice message={error} onRetry={() => loadFirstPage("initial")} /> : null}
    </View>
  );

  if (loading && orders.length === 0) {
    return (
      <View style={styles.screenCentered}>
        {header}
        <LoadingState label="অর্ডার আনা হচ্ছে..." />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={orders}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadFirstPage("refresh")}
          colors={[colors.brand[600]]}
          tintColor={colors.brand[600]}
        />
      }
      onEndReachedThreshold={0.4}
      onEndReached={loadMore}
      ListEmptyComponent={
        error ? undefined : (
          <EmptyState
            icon={Inbox}
            title="কোনো অর্ডার পাওয়া যায়নি"
            description={
              query || status !== "ALL"
                ? "ফিল্টার বদলে আবার দেখুন।"
                : "নতুন অর্ডার এলে এখানে দেখা যাবে।"
            }
          />
        )
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator
            color={colors.brand[600]}
            style={styles.footerSpinner}
          />
        ) : orders.length > 0 && page >= totalPages ? (
          <Text style={styles.footerText}>সব অর্ডার দেখা হয়ে গেছে</Text>
        ) : undefined
      }
      renderItem={({ item }) => <OrderRowItem order={item} onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })} />}
    />
  );
}

function OrderRowItem({ order, onPress }: { order: Order; onPress: () => void }) {
  const meta = statusMeta(order.status);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.rowPressable, pressed ? { opacity: 0.8 } : null]}
    >
      <Card style={styles.rowCard}>
        <View style={styles.rowTop}>
          <View style={styles.rowTitleBlock}>
            <Text style={styles.rowOrderNo}>{order.orderNo}</Text>
            <Text style={styles.rowCustomer} numberOfLines={1}>
              {order.customerName}
            </Text>
          </View>
          <StatusBadge status={order.status} />
        </View>

        <Text style={styles.rowProduct} numberOfLines={1}>
          {shortProductName(order.productName)} × {formatNumber(order.quantity)}
        </Text>

        <View style={styles.rowBottom}>
          <View style={styles.rowMetaBlock}>
            <View style={styles.rowMetaLine}>
              <MapPin size={12} color={colors.slate[400]} />
              <Text style={styles.rowMeta} numberOfLines={1}>
                {order.district ?? "—"} • {sourceLabel(order.source)}
              </Text>
            </View>
            <Text style={styles.rowMeta}>{formatRelative(order.createdAt)}</Text>
          </View>
          <Text style={[styles.rowTotal, { color: meta.text }]}>
            {formatBdt(order.total)}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate[100] },
  screenCentered: { flex: 1, backgroundColor: colors.slate[100] },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

  header: { gap: space.md, marginBottom: space.md },

  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: typography.size.sm,
    color: colors.slate[900],
  },

  chipRow: { gap: space.sm, paddingRight: space.lg },
  chip: {
    fontSize: typography.size.xs,
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
  chipActive: {
    color: colors.white,
    backgroundColor: colors.brand[600],
    borderColor: colors.brand[600],
  },

  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryText: { fontSize: typography.size.xs, color: colors.slate[500] },

  rowPressable: { marginBottom: space.md },
  rowCard: { gap: space.sm },
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.sm,
  },
  rowTitleBlock: { flex: 1, gap: 2 },
  rowOrderNo: {
    fontSize: typography.size.xs,
    color: colors.brand[700],
    fontWeight: typography.weight.semibold,
  },
  rowCustomer: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
  },
  rowProduct: { fontSize: typography.size.sm, color: colors.slate[700] },
  rowBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.sm,
  },
  rowMetaBlock: { flex: 1, gap: 2 },
  rowMetaLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowMeta: { fontSize: typography.size.xs, color: colors.slate[500] },
  rowTotal: { fontSize: typography.size.base, fontWeight: typography.weight.bold },

  footerSpinner: { paddingVertical: space.lg },
  footerText: {
    textAlign: "center",
    fontSize: typography.size.xs,
    color: colors.slate[400],
    paddingVertical: space.lg,
  },
});
