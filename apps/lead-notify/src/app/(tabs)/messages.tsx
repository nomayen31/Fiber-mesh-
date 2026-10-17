import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  CheckCircle2,
  Inbox,
  Mail,
  MailOpen,
  Phone,
  Search,
} from "lucide-react-native";

import {
  Card,
  EmptyState,
  ErrorNotice,
  GhostButton,
  LoadingState,
} from "@/components/ui";
import { usePush } from "@/components/NotificationBridge";
import { displayPhone, formatRelative } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Inquiry, InquiryListResponse } from "@/lib/types";
import { colors, radius, space, typography } from "@/theme";

const PAGE_SIZE = 15;

/** Port of the web `InquiriesView` — same rows, same unread treatment. */
export default function MessagesScreen() {
  const { request } = useSession();
  const { leadSignal } = usePush();

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [messages, setMessages] = useState<Inquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const buildPath = useCallback(
    (pageNumber: number) => {
      const params = [`page=${pageNumber}`, `pageSize=${PAGE_SIZE}`];
      if (unreadOnly) params.push("unread=1");
      if (query) params.push(`q=${encodeURIComponent(query)}`);
      return `/api/admin/inquiries?${params.join("&")}`;
    },
    [unreadOnly, query],
  );

  const loadFirstPage = useCallback(
    async (mode: "initial" | "refresh") => {
      const id = ++requestId.current;
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const data = await request((api) =>
          api.get<InquiryListResponse>(buildPath(1)),
        );
        if (id !== requestId.current) return;
        setMessages(data.inquiries);
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
        setUnreadCount(data.inquiries.filter((row) => !row.isRead).length);
      } catch (caught) {
        if (id !== requestId.current) return;
        setError(caught instanceof Error ? caught.message : "মেসেজ আনা যায়নি।");
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [request, buildPath],
  );

  useEffect(() => {
    void loadFirstPage("initial");
  }, [loadFirstPage]);

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
        api.get<InquiryListResponse>(buildPath(nextPage)),
      );
      setMessages((current) => {
        const seen = new Set(current.map((row) => row.id));
        return [...current, ...data.inquiries.filter((row) => !seen.has(row.id))];
      });
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "আরও মেসেজ আনা যায়নি।");
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, refreshing, page, totalPages, request, buildPath]);

  /** Optimistic read/unread toggle; rolls back if the server disagrees. */
  const toggleRead = useCallback(
    async (inquiry: Inquiry) => {
      const next = !inquiry.isRead;
      setMessages((current) =>
        current.map((row) => (row.id === inquiry.id ? { ...row, isRead: next } : row)),
      );
      setUnreadCount((value) => Math.max(0, value + (next ? -1 : 1)));

      try {
        await request((api) =>
          api.patch(`/api/admin/inquiries/${inquiry.id}`, { isRead: next }),
        );
      } catch (caught) {
        setMessages((current) =>
          current.map((row) =>
            row.id === inquiry.id ? { ...row, isRead: inquiry.isRead } : row,
          ),
        );
        setUnreadCount((value) => Math.max(0, value + (next ? 1 : -1)));
        setError(caught instanceof Error ? caught.message : "আপডেট করা যায়নি।");
      }
    },
    [request],
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.searchWrapper}>
        <Search size={16} color={colors.slate[400]} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="নাম, ফোন বা মেসেজ"
          placeholderTextColor={colors.slate[400]}
          style={styles.searchInput}
          returnKeyType="search"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.filterRow}>
        <Text
          onPress={() => setUnreadOnly(false)}
          style={[styles.chip, !unreadOnly ? styles.chipActive : null]}
        >
          সব মেসেজ
        </Text>
        <Text
          onPress={() => setUnreadOnly(true)}
          style={[styles.chip, unreadOnly ? styles.chipActive : null]}
        >
          {unreadCount > 0 ? `পড়া হয়নি (${unreadCount})` : "পড়া হয়নি"}
        </Text>
      </View>

      <Text style={styles.summaryText}>মোট {total}টি মেসেজ</Text>

      {error ? <ErrorNotice message={error} onRetry={() => loadFirstPage("initial")} /> : null}
    </View>
  );

  if (loading && messages.length === 0) {
    return (
      <View style={styles.screen}>
        {header}
        <LoadingState label="মেসেজ আনা হচ্ছে..." />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={messages}
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
            title="কোনো মেসেজ নেই"
            description={
              unreadOnly
                ? "সব মেসেজ পড়া হয়ে গেছে।"
                : "গ্রাহক যোগাযোগ ফর্ম পাঠালে এখানে দেখা যাবে।"
            }
          />
        )
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator color={colors.brand[600]} style={styles.footerSpinner} />
        ) : undefined
      }
      renderItem={({ item }) => {
        const isOpen = expanded === item.id;
        return (
          <Card style={[styles.messageCard, !item.isRead ? styles.messageUnread : null]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setExpanded(isOpen ? null : item.id);
                if (!item.isRead) void toggleRead(item);
              }}
              style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
            >
              <View style={styles.messageTop}>
                <View style={styles.messageTitleBlock}>
                  <View style={styles.messageNameRow}>
                    {item.isRead ? (
                      <MailOpen size={14} color={colors.slate[400]} />
                    ) : (
                      <Mail size={14} color={colors.brand[600]} />
                    )}
                    <Text style={styles.messageName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={styles.messageMeta}>
                    {formatRelative(item.createdAt)}
                    {item.subject ? ` • ${item.subject}` : ""}
                  </Text>
                </View>
                {!item.isRead ? <View style={styles.unreadDot} /> : null}
              </View>

              <Text
                style={[styles.messageBody, styles.messageBodySpacing]}
                numberOfLines={isOpen ? undefined : 2}
              >
                {item.message}
              </Text>
            </Pressable>

            {isOpen ? (
              <View style={styles.messageActions}>
                <View style={styles.messagePhone}>
                  <Phone size={13} color={colors.slate[500]} />
                  <Text style={styles.messagePhoneText}>
                    {displayPhone(item.phone)}
                  </Text>
                  {item.email ? (
                    <Text style={styles.messagePhoneText}> • {item.email}</Text>
                  ) : null}
                </View>
                <GhostButton
                  label={item.isRead ? "পড়া হয়নি হিসেবে চিহ্নিত" : "পড়া হয়েছে"}
                  icon={CheckCircle2}
                  tone={item.isRead ? "slate" : "brand"}
                  onPress={() => toggleRead(item)}
                />
              </View>
            ) : null}
          </Card>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate[100] },
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
  filterRow: { flexDirection: "row", gap: space.sm },
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
  summaryText: { fontSize: typography.size.xs, color: colors.slate[500] },

  messageCard: { gap: space.sm },
  messageUnread: { borderColor: colors.brand[200], backgroundColor: colors.brand[50] },
  messageTop: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  messageTitleBlock: { flex: 1, gap: 2 },
  messageNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  messageName: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
    flexShrink: 1,
  },
  messageMeta: { fontSize: typography.size.xs, color: colors.slate[500] },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand[600],
    marginTop: 5,
  },
  messageBody: {
    fontSize: typography.size.sm,
    color: colors.slate[700],
    lineHeight: 20,
  },
  /** Space between the tappable header block and the message body. */
  messageBodySpacing: { marginTop: space.sm },
  messageActions: { gap: space.sm, alignItems: "flex-start" },
  messagePhone: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  messagePhoneText: { fontSize: typography.size.sm, color: colors.slate[700], fontWeight: typography.weight.semibold },

  footerSpinner: { paddingVertical: space.lg },
});
