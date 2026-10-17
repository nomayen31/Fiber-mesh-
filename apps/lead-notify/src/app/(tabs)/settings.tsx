import { useCallback } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AlertTriangle,
  BellRing,
  BellOff,
  CheckCircle2,
  Info,
  LogOut,
  RefreshCw,
  ServerCog,
  Smartphone,
} from "lucide-react-native";

import { usePush } from "@/components/NotificationBridge";
import {
  Card,
  DetailRow,
  Divider,
  ErrorNotice,
  GhostButton,
  LoadingState,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { ENV_LABEL, useSession } from "@/lib/session";
import { useApiData } from "@/lib/useApiData";
import type { DeviceListResponse } from "@/lib/types";
import { colors, radius, space, typography } from "@/theme";

/** Mobile-only screen: there is no equivalent on the website. */
export default function SettingsScreen() {
  const { request, baseUrl, signOut } = useSession();
  const { retry } = usePush();

  const load = useCallback(
    () => request((api) => api.get<DeviceListResponse>("/api/admin/devices")),
    [request],
  );

  const { data, error, loading, refresh, reload } = useApiData(load);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      {/* ── device-side push state ── */}
      <Card>
        <SectionTitle>এই ফোনে নোটিফিকেশন</SectionTitle>
        <PushStatusPanel />
        <View style={styles.actionRow}>
          <GhostButton label="আবার চালু করার চেষ্টা" icon={RefreshCw} tone="brand" onPress={retry} />
          <GhostButton
            label="ফোনের সেটিংস"
            icon={Smartphone}
            onPress={() => void Linking.openSettings()}
          />
        </View>
      </Card>

      {/* ── server-side push state: the usual reason push silently does nothing ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <View style={styles.titleRow}>
            <ServerCog size={16} color={colors.slate[700]} />
            <Text style={styles.cardTitle}>সার্ভারের অবস্থা</Text>
          </View>
          <GhostButton label="রিফ্রেশ" icon={RefreshCw} onPress={reload} />
        </View>

        {loading && !data ? <LoadingState label="সার্ভারের তথ্য আনা হচ্ছে..." /> : null}
        {error && !data ? <ErrorNotice message={error} onRetry={reload} /> : null}

        {data ? (
          <>
            {data.pushConfigured ? (
              <View style={styles.okBox}>
                <CheckCircle2 size={16} color={colors.emerald[700]} />
                <Text style={styles.okText}>
                  সার্ভারে পুশ পাঠানোর সেটআপ সম্পূর্ণ। নতুন অর্ডার এলে নোটিফিকেশন
                  আসবে।
                </Text>
              </View>
            ) : (
              <View style={styles.warnBox}>
                <AlertTriangle size={16} color={colors.amber[700]} />
                <Text style={styles.warnText}>
                  সার্ভারে Firebase Admin কী সেট করা নেই, তাই এখন কোনো পুশ পাঠানো
                  যাবে না। অ্যাডমিন ড্যাশবোর্ড ঠিকঠাক কাজ করবে।
                  {data.missingServerKeys.length > 0
                    ? ` অনুপস্থিত: ${data.missingServerKeys.join(", ")}`
                    : ""}
                </Text>
              </View>
            )}

            <Divider />

            <DetailRow label="সক্রিয় নোটিফিকেশন টাইপ" value={data.enabledEvents.join(", ") || "কোনোটিই নয়"} />
            <Divider />
            <DetailRow label="সার্ভার" value={baseUrl} />
            <Divider />
            <DetailRow label="পরিবেশ" value={ENV_LABEL} />
          </>
        ) : null}

        <View style={styles.refreshRow}>
          <GhostButton label="তালিকা রিফ্রেশ" icon={RefreshCw} onPress={() => void refresh()} />
        </View>
      </Card>

      {/* ── which phones are registered ── */}
      <Card>
        <SectionTitle>নিবন্ধিত ফোন</SectionTitle>
        {data?.devices.length ? (
          data.devices.map((device, index) => (
            <View key={device.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.deviceRow}>
                <View
                  style={[
                    styles.deviceChip,
                    {
                      backgroundColor: device.isActive
                        ? colors.brand[50]
                        : colors.slate[100],
                    },
                  ]}
                >
                  {device.isActive ? (
                    <BellRing size={15} color={colors.brand[600]} />
                  ) : (
                    <BellOff size={15} color={colors.slate[400]} />
                  )}
                </View>
                <View style={styles.deviceText}>
                  <Text style={styles.deviceLabel}>
                    {device.label ?? device.platform}
                  </Text>
                  <Text style={styles.deviceMeta}>
                    {device.tokenPreview} • সর্বশেষ {formatDateTime(device.lastSeenAt)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.deviceState,
                    { color: device.isActive ? colors.emerald[700] : colors.slate[400] },
                  ]}
                >
                  {device.isActive ? "সক্রিয়" : "নিষ্ক্রিয়"}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Muted>
            এখনো কোনো ফোন নিবন্ধিত হয়নি। উপরোক্ত অবস্থা দেখে নোটিফিকেশন চালু করুন।
          </Muted>
        )}
      </Card>

      {/* ── how to test ── */}
      <Card>
        <View style={styles.titleRow}>
          <Info size={16} color={colors.slate[700]} />
          <Text style={styles.cardTitle}>নোটিফিকেশন কীভাবে পরীক্ষা করবেন</Text>
        </View>
        <Text style={styles.helpText}>
          ১. লগইন করা অবস্থায় ফোনটি নিবন্ধিত হয়েছে কিনা উপরে দেখুন।
        </Text>
        <Text style={styles.helpText}>
          ২. ওয়েবসাইটে একটি টেস্ট অর্ডার দিন। সাথে সাথে এই ফোনে নোটিফিকেশন আসবে —
          অ্যাপ বন্ধ থাকলেও।
        </Text>
        <Text style={styles.helpText}>
          ৩. নোটিফিকেশনে ট্যাপ করলে সরাসরি সেই অর্ডারের বিবরণ খুলবে।
        </Text>
      </Card>

      {/* ── sign out ── */}
      <Card>
        <SectionTitle>লগআউট</SectionTitle>
        <Muted>
          লগআউট করলে এই ফোনে আর নোটিফিকেশন আসবে না। আবার লগইন করলেই চালু হয়ে
          যাবে।
        </Muted>
        <View style={styles.logoutWrapper}>
          <PrimaryButton
            label="লগআউট করুন"
            icon={LogOut}
            onPress={() => void signOut("manual")}
          />
        </View>
      </Card>
    </ScrollView>
  );
}

/** The device-side status, rendered from `usePush()`. */
function PushStatusPanel() {
  const { status } = usePush();

  if (status.state === "registering") {
    return <LoadingState label="নোটিফিকেশন চালু করা হচ্ছে..." />;
  }

  if (status.state === "registered") {
    return (
      <View style={styles.okBox}>
        <CheckCircle2 size={16} color={colors.emerald[700]} />
        <Text style={styles.okText}>
          চালু আছে। এই ফোনটি {status.label} নামে নিবন্ধিত এবং নোটিফিকেশন পাবে।
        </Text>
      </View>
    );
  }

  if (status.state === "permission-denied") {
    return (
      <View style={styles.warnBox}>
        <AlertTriangle size={16} color={colors.amber[700]} />
        <Text style={styles.warnText}>
          ফোন থেকে নোটিফিকেশনের অনুমতি দেওয়া হয়নি। ফোনের সেটিংস → অ্যাপ →
          Fiber Mesh Lead → নোটিফিকেশন থেকে অনুমতি চালু করুন।
        </Text>
      </View>
    );
  }

  if (status.state === "unsupported") {
    return (
      <View style={styles.infoBox}>
        <Info size={16} color={colors.slate[700]} />
        <Text style={styles.infoText}>{status.reason}</Text>
      </View>
    );
  }

  if (status.state === "error") {
    return <ErrorNotice message={status.message} />;
  }

  return (
    <View style={styles.infoBox}>
      <Info size={16} color={colors.slate[600]} />
      <Text style={styles.infoText}>
        লগইন করলে নোটিফিকেশন স্বয়ংক্রিয়ভাবে চালু হয়ে যাবে।
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate[100] },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: space.sm },
  cardTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.md,
  },
  refreshRow: { marginTop: space.md },

  okBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    backgroundColor: colors.emerald[50],
    borderWidth: 1,
    borderColor: colors.emerald[200],
    borderRadius: radius.md,
    padding: space.md,
  },
  okText: {
    flex: 1,
    color: colors.emerald[700],
    fontSize: typography.size.sm,
    lineHeight: 20,
  },

  warnBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    backgroundColor: colors.amber[50],
    borderWidth: 1,
    borderColor: colors.amber[200],
    borderRadius: radius.md,
    padding: space.md,
  },
  warnText: {
    flex: 1,
    color: colors.amber[700],
    fontSize: typography.size.sm,
    lineHeight: 20,
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radius.md,
    padding: space.md,
  },
  infoText: {
    flex: 1,
    color: colors.slate[700],
    fontSize: typography.size.sm,
    lineHeight: 20,
  },

  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.sm,
  },
  deviceChip: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  deviceText: { flex: 1, gap: 2 },
  deviceLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.slate[900],
  },
  deviceMeta: { fontSize: typography.size.xs, color: colors.slate[500] },
  deviceState: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },

  helpText: {
    fontSize: typography.size.sm,
    color: colors.slate[600],
    lineHeight: 21,
    marginBottom: 2,
  },
  logoutWrapper: { marginTop: space.md },
});
