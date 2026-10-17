import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PushProvider } from "@/components/NotificationBridge";
import { SessionProvider, useSession } from "@/lib/session";
import { colors, typography } from "@/theme";

/**
 * Dark navy chrome matches the website's admin sidebar (`bg-slate-900`), with the
 * same brand blue used for accents and active states.
 */
const HEADER = {
  headerStyle: { backgroundColor: colors.slate[900] },
  headerTintColor: colors.white,
  headerTitleStyle: {
    fontWeight: typography.weight.bold as "700",
    fontSize: typography.size.base,
    // No letterSpacing: it breaks Bengali conjuncts.
  },
  headerShadowVisible: false,
} as const;

function BootScreen() {
  return (
    <View style={styles.boot}>
      <Text style={styles.bootTitle}>Fiber Mesh</Text>
      <Text style={styles.bootSubtitle}>লিড নোটিফিকেশন</Text>
      <ActivityIndicator color={colors.brand[400]} style={styles.bootSpinner} />
    </View>
  );
}

function RootNavigator() {
  const { state } = useSession();

  // Never render the navigator before the stored session has been read, or the
  // guard would flash the login screen on every cold start.
  if (state === "loading") {
    return <BootScreen />;
  }

  const signedIn = state === "signedIn";

  return (
    <Stack screenOptions={HEADER}>
      <Stack.Screen name="index" options={{ headerShown: false }} />

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="order/[id]"
          options={{ title: "অর্ডার বিবরণ", headerBackTitle: "ফিরে যান" }}
        />
      </Stack.Protected>

      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <PushProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </PushProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.slate[900],
  },
  bootTitle: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  bootSubtitle: {
    fontSize: typography.size.sm,
    color: colors.slate[400],
    marginTop: 4,
  },
  bootSpinner: { marginTop: 20 },
});
