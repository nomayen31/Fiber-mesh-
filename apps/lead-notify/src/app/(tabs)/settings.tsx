import { useCallback, useState } from "react";
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
  Send,
  ServerCog,
  Smartphone,
  XCircle,
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
import { formatDateTime, formatNumber } from "@/lib/format";
import { ENV_LABEL, useSession } from "@/lib/session";
import { useApiData } from "@/lib/useApiData";
import type { DeviceListResponse, PushConfigIssue, PushTestOutcome } from "@/lib/types";
import { colors, radius, space, typography } from "@/theme";

/** Bengali wording for a raw FCM outcome code. */
const TEST_OUTCOME_LABEL: Record<PushTestOutcome, string> = {
  sent: "Firebase গ্রহণ করেছে",
  "invalid-token": "টোকেন আর কাজ করে না — ফোনটি নিষ্ক্রিয় করা হয়েছে",
  failed: "পাঠানো যায়নি, আবার চেষ্টা করা হবে",
  skipped: "পাঠানো হয়নি (সেটআপ নেই বা বন্ধ)",
};

/** Bengali wording for why the server cannot send a push. */
const PUSH_ISSUE_LABEL: Record<PushConfigIssue["code"], string> = {
  "no-credentials": "সার্ভারে কোনো Firebase Admin কী নেই",
  "invalid-json": "কী-টি JSON হিসেবে পড়া যাচ্ছে না (base64 হলে সেটিও ভুল)",
  "missing-fields": "কী ফাইলে প্রয়োজনীয় ঘর নেই",
  "invalid-private-key": "private_key ঘরটি সঠিক PEM কী নয়",
  "init-failed": "Firebase Admin SDK কী-টি গ্রহণ করেনি",
};

/** What we remember about the last self-test. Never contains a token. */
type TestOutcome = {
  ok: boolean;
  at: string;
  message: string;
  detail?: string;
};

/** Mobile-only screen: there is no equivalent on the website. */
export default function SettingsScreen() {
  const { request, baseUrl, signOut } = useSession();
  const { retry, sendTest } = usePush();

  const load = useCallback(
    () => request((api) => api.get<DeviceListResponse>("/api/admin/devices")),
    [request],
  );

  const { data, error, loading, refresh, reload } = useApiData(load);

  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestOutcome | null>(null);

  /**
   * Ask the server to push a test to *this* account's registered phones.
   *
   * Each failure mode is reported as itself, so "Firebase accepted the message"
   * is never confused with "the server has no credentials yet" or with "the
   * phone is not registered".
   */
  const runTest = useCallback(async () => {
    if (testing) return;
    setTesting(true);
    setTest(null);

    try {
      const result = await sendTest();
      const problems = result.results.filter((item) => item.outcome !== "sent");

      setTest({
        ok: result.sentCount > 0,
        at: new Date().toISOString(),
        message:
          result.sentCount > 0
            ? `Firebase ${formatNumber(result.sentCount)}টি ফোনের জন্য নোটিফিকেশন গ্রহণ করেছে। দুই-তিন সেকেন্ডের মধ্যে না এলে ফোনের সেটিংস দেখুন।`
            : "Firebase কোনো ফোনের জন্য নোটিফিকেশন গ্রহণ করেনি। কারণ নিচে দেখুন।",
        detail: problems.length
          ? problems
              .map(
                (item) =>
                  `${item.label ?? "ফোন"} — ${TEST_OUTCOME_LABEL[item.outcome]}${
                    item.error ? ` (${item.error})` : ""
                  }`,
              )
              .join("\n")
          : undefined,
      });
      void refresh();
    } catch (caught) {
      setTest({
        ok: false,
        at: new Date().toISOString(),
        message:
          caught instanceof Error
            ? caught.message
            : "টেস্ট নোটিফিকেশন পাঠানো যায়নি।",
      });
    } finally {
      setTesting(false);
    }
  }, [testing, sendTest, refresh]);

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

      {/* ── the only way to tell "token exists" apart from "push arrives" ── */}
      <Card>
        <View style={styles.titleRow}>
          <Send size={16} color={colors.slate[700]} />
          <Text style={styles.cardTitle}>টেস্ট নোটিফিকেশন</Text>
        </View>
        <Muted>
          সার্ভারকে বলে এই অ্যাকাউন্টের নিবন্ধিত ফোনে এখনই একটি নোটিফিকেশন পাঠাতে।
          এটি আপনার নিজের ফোনেই যাবে — অন্য কারো নয়।
        </Muted>

        <View style={styles.testButtonWrapper}>
          <PrimaryButton
            label={testing ? "পাঠানো হচ্ছে..." : "টেস্ট নোটিফিকেশন পাঠান"}
            icon={Send}
            loading={testing}
            disabled={testing}
            onPress={() => void runTest()}
          />
        </View>

        {test ? (
          <View
            style={[
              test.ok ? styles.okBox : styles.warnBox,
              styles.testResultBox,
            ]}
          >
            {test.ok ? (
              <CheckCircle2 size={16} color={colors.emerald[700]} />
            ) : (
              <XCircle size={16} color={colors.amber[700]} />
            )}
            <View style={styles.testResultText}>
              <Text style={test.ok ? styles.okText : styles.warnText}>
                {test.message}
              </Text>
              {test.detail ? (
                <Text style={styles.testDetail}>{test.detail}</Text>
              ) : null}
              <Text style={styles.testTimestamp}>
                সর্বশেষ টেস্ট: {formatDateTime(test.at)}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.testHint}>
            এখনো টেস্ট করা হয়নি। টোকেন থাকা আর নোটিফিকেশন আসা এক জিনিস নয় — সেটি
            আলাদা করে দেখতে এই বোতামটি চাপুন।
          </Text>
        )}
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
                  {data.missingServerKeys.length > 0
                    ? `সার্ভারে Firebase Admin কী সেট করা নেই, তাই এখন কোনো পুশ পাঠানো যাবে না। অনুপস্থিত: ${data.missingServerKeys.join(", ")}`
                    : "সার্ভারে Firebase Admin কী আছে, কিন্তু সেটি ব্যবহার করা যাচ্ছে না, তাই এখন কোনো পুশ পাঠানো যাবে না।"}
                  {data.pushConfigIssue
                    ? `\nকারণ: ${PUSH_ISSUE_LABEL[data.pushConfigIssue.code]} (${data.pushConfigIssue.detail})`
                    : ""}
                  {"\n"}অর্ডার ও অ্যাডমিন ড্যাশবোর্ড স্বাভাবিকভাবেই কাজ করবে।
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
          ২. উপরের “টেস্ট নোটিফিকেশন পাঠান” চাপুন। নোটিফিকেশন আসলে সার্ভার থেকে
          ফোন পর্যন্ত পুরো পথ ঠিক আছে।
        </Text>
        <Text style={styles.helpText}>
          ৩. এরপর ওয়েবসাইটে (বা অ্যাপের “ম্যানুয়াল অর্ডার”) একটি আসল অর্ডার দিন —
          অ্যাপ বন্ধ থাকলেও নোটিফিকেশন আসবে।
        </Text>
        <Text style={styles.helpText}>
          ৪. নোটিফিকেশনে ট্যাপ করলে সরাসরি সেই অর্ডারের বিবরণ খুলবে।
        </Text>
        <Text style={styles.helpText}>
          ৫. নোটিফিকেশন না এলে: ফোনের সেটিংস → অ্যাপ → Fiber Mesh Lead →
          নোটিফিকেশন চালু আছে কিনা, এবং ফোনে ব্যাটারি সেভার/Doze চালু আছে কিনা
          দেখুন।
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

  testButtonWrapper: { marginTop: space.md },
  testResultBox: { marginTop: space.md },
  testResultText: { flex: 1, gap: 4 },
  testDetail: {
    fontSize: typography.size.xs,
    color: colors.slate[600],
    lineHeight: 18,
  },
  testTimestamp: { fontSize: typography.size.xs, color: colors.slate[400] },
  testHint: {
    marginTop: space.md,
    fontSize: typography.size.sm,
    color: colors.slate[600],
    lineHeight: 20,
  },

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
