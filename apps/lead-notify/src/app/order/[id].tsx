import { useCallback, useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  Copy,
  Info,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Receipt,
  StickyNote,
  User,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";

import {
  Card,
  DetailRow,
  Divider,
  EmptyState,
  ErrorNotice,
  LoadingState,
  Muted,
  SectionTitle,
  StatusBadge,
} from "@/components/ui";
import {
  ORDER_STATUSES,
  displayPhone,
  formatBdt,
  formatDateTime,
  formatNumber,
  formatQuantity,
  sourceLabel,
  statusMeta,
  type OrderStatusKey,
} from "@/lib/format";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Order, SingleOrderResponse } from "@/lib/types";
import { colors, radius, space, typography } from "@/theme";

/**
 * Order detail — the screen a push notification opens.
 *
 * Reads the existing `GET /api/admin/orders/:id` endpoint with the bearer
 * session and can move the order through the same six statuses the web
 * dashboard offers, via the same `PATCH` endpoint.
 */
export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { request } = useSession();

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<OrderStatusKey | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!id) {
        setError("অর্ডার আইডি পাওয়া যায়নি।");
        setLoading(false);
        return;
      }
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const data = await request((api) =>
          api.get<SingleOrderResponse>(`/api/admin/orders/${id}`),
        );
        setOrder(data.order);
      } catch (caught) {
        setError(
          caught instanceof ApiError && caught.status === 404
            ? "এই অর্ডারটি পাওয়া যায়নি। সম্ভবত ডিলিট করা হয়েছে।"
            : caught instanceof Error
              ? caught.message
              : "অর্ডার আনা যায়নি।",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, request],
  );

  /* Load once per order id (and again if the bearer session is replaced). */
  useEffect(() => {
    void load("initial");
  }, [load]);

  const changeStatus = useCallback(
    async (next: OrderStatusKey) => {
      if (!order || order.status === next || saving) return;
      setSaving(next);
      setError(null);
      try {
        await request((api) =>
          api.patch(`/api/admin/orders/${order.id}`, { status: next }),
        );
        setOrder({ ...order, status: next });
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "স্ট্যাটাস আপডেট করা যায়নি।",
        );
      } finally {
        setSaving(null);
      }
    },
    [order, request, saving],
  );

  const meta = order ? statusMeta(order.status) : null;

  return (
    <>
      <Stack.Screen options={{ title: order?.orderNo ?? "অর্ডার বিবরণ" }} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load("refresh")}
            colors={[colors.brand[600]]}
            tintColor={colors.brand[600]}
          />
        }
      >
        {loading && !order ? <LoadingState label="অর্ডার আনা হচ্ছে..." /> : null}

        {error && !order ? (
          <>
            <ErrorNotice message={error} onRetry={() => void load("initial")} />
            <EmptyState
              icon={Info}
              title="অর্ডার দেখানো যাচ্ছে না"
              description="নোটিফিকেশন থেকে আসা আইডিটি হয়তো মেয়াদোত্তীর্ণ। অর্ডার তালিকা থেকে আবার চেষ্টা করুন।"
            />
          </>
        ) : null}

        {order && meta ? (
          <>
            {/* ── headline ── */}
            <Card>
              <View style={styles.headRow}>
                <View style={styles.headText}>
                  <Text style={styles.orderNo}>{order.orderNo}</Text>
                  <Muted>{formatDateTime(order.createdAt)}</Muted>
                </View>
                <StatusBadge status={order.status} />
              </View>

              <Divider />

              <View style={styles.totalRow}>
                <View>
                  <Text style={styles.totalLabel}>সর্বমোট</Text>
                  <Text style={[styles.totalValue, { color: meta.text }]}>
                    {formatBdt(order.total)}
                  </Text>
                </View>
                <View style={styles.totalRight}>
                  <Text style={styles.totalLabel}>সোর্স</Text>
                  <Text style={styles.totalSource}>{sourceLabel(order.source)}</Text>
                </View>
              </View>
            </Card>

            {error ? <ErrorNotice message={error} onRetry={() => void load("refresh")} /> : null}

            {/* ── status control ── */}
            <Card>
              <SectionTitle>স্ট্যাটাস পরিবর্তন</SectionTitle>
              <View style={styles.statusGrid}>
                {ORDER_STATUSES.map((key) => {
                  const active = key === order.status;
                  const tone = statusMeta(key);
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active, busy: saving === key }}
                      disabled={Boolean(saving)}
                      onPress={() => void changeStatus(key)}
                      style={({ pressed }) => [
                        styles.statusChip,
                        active
                          ? { backgroundColor: tone.dot, borderColor: tone.dot }
                          : { backgroundColor: colors.white, borderColor: colors.slate[200] },
                        pressed ? { opacity: 0.75 } : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          { color: active ? colors.white : colors.slate[700] },
                        ]}
                      >
                        {saving === key ? "সংরক্ষণ..." : tone.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Muted>স্ট্যাটাস বদলালে সাথে সাথে সার্ভারে সংরক্ষণ হয়।</Muted>
            </Card>

            {/* ── customer ── */}
            <Card>
              <View style={styles.sectionHead}>
                <User size={16} color={colors.slate[700]} />
                <Text style={styles.sectionTitleText}>গ্রাহকের তথ্য</Text>
              </View>

              <DetailRow label="নাম" value={order.customerName} />
              <Divider />
              <DetailRow label="ফোন" value={displayPhone(order.phone)} />
              <Divider />
              <DetailRow
                label="জেলা"
                value={
                  <View style={styles.locationValue}>
                    <MapPin size={13} color={colors.slate[400]} />
                    <Text style={styles.locationText}>{order.district ?? "—"}</Text>
                  </View>
                }
              />
              <Divider />
              <DetailRow label="ঠিকানা" value={order.address ?? "—"} />

              <View style={styles.contactRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void Linking.openURL(`tel:${order.phone}`)}
                  style={({ pressed }) => [
                    styles.contactButton,
                    { backgroundColor: colors.brand[50] },
                    pressed ? { opacity: 0.75 } : null,
                  ]}
                >
                  <Phone size={16} color={colors.brand[700]} />
                  <Text style={[styles.contactText, { color: colors.brand[700] }]}>
                    কল করুন
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => void Linking.openURL(whatsappUrl(order.phone))}
                  style={({ pressed }) => [
                    styles.contactButton,
                    { backgroundColor: colors.emerald[50] },
                    pressed ? { opacity: 0.75 } : null,
                  ]}
                >
                  <MessageCircle size={16} color={colors.emerald[700]} />
                  <Text style={[styles.contactText, { color: colors.emerald[700] }]}>
                    হোয়াটসঅ্যাপ
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    void Clipboard.setStringAsync(order.phone);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  }}
                  style={({ pressed }) => [
                    styles.contactButton,
                    { backgroundColor: colors.slate[100] },
                    pressed ? { opacity: 0.75 } : null,
                  ]}
                >
                  <Copy size={16} color={colors.slate[700]} />
                  <Text style={[styles.contactText, { color: colors.slate[700] }]}>
                    {copied ? "কপি হয়েছে" : "কপি"}
                  </Text>
                </Pressable>
              </View>
            </Card>

            {/* ── product & money ── */}
            <Card>
              <View style={styles.sectionHead}>
                <Package size={16} color={colors.slate[700]} />
                <Text style={styles.sectionTitleText}>পণ্য</Text>
              </View>

              <DetailRow label="পণ্য" value={order.productName} />
              <Divider />
              <DetailRow label="পরিমাণ" value={formatQuantity(order.quantity)} />
              <Divider />
              <DetailRow label="একক দাম" value={formatBdt(order.unitPrice)} />
              <Divider />
              <DetailRow label="সাবটোটাল" value={formatBdt(order.subtotal)} />
              <Divider />
              <DetailRow
                label="ছাড়"
                value={order.discount > 0 ? `- ${formatBdt(order.discount)}` : formatBdt(0)}
              />
              <Divider />
              <DetailRow
                label="সর্বমোট"
                value={formatBdt(order.total)}
                valueStyle={{ fontSize: typography.size.base, color: colors.brand[700] }}
              />
            </Card>

            {order.note ? (
              <Card>
                <View style={styles.sectionHead}>
                  <StickyNote size={16} color={colors.slate[700]} />
                  <Text style={styles.sectionTitleText}>বিশেষ নির্দেশনা</Text>
                </View>
                <Text style={styles.noteText}>{order.note}</Text>
              </Card>
            ) : null}

            {/* ── audit ── */}
            <Card>
              <View style={styles.sectionHead}>
                <Receipt size={16} color={colors.slate[700]} />
                <Text style={styles.sectionTitleText}>রেকর্ড</Text>
              </View>
              <DetailRow label="অর্ডার নম্বর" value={order.orderNo} />
              <Divider />
              <DetailRow label="তৈরি" value={formatDateTime(order.createdAt)} />
              <Divider />
              <DetailRow label="সর্বশেষ পরিবর্তন" value={formatDateTime(order.updatedAt)} />
              <Divider />
              <DetailRow label="মোট রোল" value={formatNumber(order.quantity)} />
            </Card>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

/** `01581190839` → `https://wa.me/8801581190839` (WhatsApp needs the country code). */
function whatsappUrl(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "").replace(/^00/, "");
  const international = digits.startsWith("880")
    ? digits
    : digits.startsWith("0")
      ? `880${digits.slice(1)}`
      : digits;
  return `https://wa.me/${international}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate[100] },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },

  headRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md },
  headText: { flex: 1, gap: 2 },
  orderNo: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
  },

  totalRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.md, paddingTop: space.sm },
  totalLabel: { fontSize: typography.size.xs, color: colors.slate[500] },
  totalValue: { fontSize: typography.size.xl, fontWeight: typography.weight.bold },
  totalRight: { alignItems: "flex-end" },
  totalSource: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.slate[700],
  },

  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.md },
  statusChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  statusChipText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },

  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: space.sm },
  sectionTitleText: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
  },

  locationValue: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.slate[900],
  },

  contactRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  contactText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },

  noteText: { fontSize: typography.size.sm, color: colors.slate[700], lineHeight: 21 },
});
