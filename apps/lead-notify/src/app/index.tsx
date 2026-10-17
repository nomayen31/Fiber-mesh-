import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";

import { useSession } from "@/lib/session";
import { colors } from "@/theme";

/**
 * Entry route. The `Stack.Protected` guards in `_layout.tsx` already move the
 * user to the right place; this only covers a direct visit to `/`.
 */
export default function Index() {
  const { state } = useSession();

  if (state === "loading") {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.brand[600]} />
      </View>
    );
  }

  return <Redirect href={state === "signedIn" ? "/dashboard" : "/login"} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.slate[100],
  },
});
