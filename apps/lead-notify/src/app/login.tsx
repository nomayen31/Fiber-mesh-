import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AlertCircle, Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react-native";

import { PrimaryButton } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { ENV_LABEL, useSession } from "@/lib/session";
import { colors, radius, shadow, space, typography } from "@/theme";

/**
 * Password login — the same single admin password the website's /admin/login
 * uses. The app never stores the password; it keeps only the bearer token the
 * server returns.
 */
export default function LoginScreen() {
  const { signIn, signOutReason, baseUrl } = useSession();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!password.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(password);
      // The navigator swaps to the tabs as soon as the session flips.
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "লগইন করা যায়নি। আবার চেষ্টা করুন।",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandBlock}>
          <View style={styles.logo}>
            <ShieldCheck size={26} color={colors.white} strokeWidth={2.2} />
          </View>
          <Text style={styles.brandName}>Fiber Mesh</Text>
          <Text style={styles.brandTagline}>অ্যাডমিন লিড নোটিফিকেশন</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>অ্যাডমিন লগইন</Text>
          <Text style={styles.cardSubtitle}>
            ওয়েবসাইটে ব্যবহৃত একই পাসওয়ার্ড দিন। লগইন করলে নতুন অর্ডারের
            নোটিফিকেশন এই ফোনে আসবে।
          </Text>

          {signOutReason === "expired" && !error ? (
            <View style={styles.notice}>
              <AlertCircle size={16} color={colors.amber[700]} strokeWidth={2.2} />
              <Text style={styles.noticeText}>
                সেশনের মেয়াদ শেষ হয়েছে। আবার লগইন করুন।
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.error}>
              <AlertCircle size={16} color={colors.rose[700]} strokeWidth={2.2} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>পাসওয়ার্ড</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (error) setError(null);
              }}
              placeholder="পাসওয়ার্ড লিখুন"
              placeholderTextColor={colors.slate[400]}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              editable={!submitting}
              style={styles.input}
            />
            <Pressable
              onPress={() => setShowPassword((value) => !value)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখান"}
            >
              {showPassword ? (
                <EyeOff size={18} color={colors.slate[500]} />
              ) : (
                <Eye size={18} color={colors.slate[500]} />
              )}
            </Pressable>
          </View>

          <View style={styles.buttonWrapper}>
            <PrimaryButton
              label="লগইন করুন"
              icon={LogIn}
              loading={submitting}
              onPress={handleSubmit}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>সার্ভার: {baseUrl}</Text>
          <Text style={styles.footerText}>পরিবেশ: {ENV_LABEL}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate[900] },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: space.xl,
    gap: space.xl,
  },

  brandBlock: { alignItems: "center", gap: 6 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.brand[600],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  brandName: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  brandTagline: { fontSize: typography.size.sm, color: colors.slate[400] },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.sm,
    ...shadow.raised,
  },
  cardTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
  },
  cardSubtitle: {
    fontSize: typography.size.sm,
    color: colors.slate[500],
    lineHeight: 20,
    marginBottom: space.sm,
  },

  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.amber[50],
    borderWidth: 1,
    borderColor: colors.amber[200],
    borderRadius: radius.md,
    padding: space.md,
  },
  noticeText: { flex: 1, color: colors.amber[700], fontSize: typography.size.sm },

  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.rose[50],
    borderWidth: 1,
    borderColor: colors.rose[200],
    borderRadius: radius.md,
    padding: space.md,
  },
  errorText: { flex: 1, color: colors.rose[700], fontSize: typography.size.sm },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.slate[700],
    marginTop: space.sm,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.slate[300],
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: colors.slate[50],
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: typography.size.base,
    color: colors.slate[900],
  },
  buttonWrapper: { marginTop: space.md },

  footer: { alignItems: "center", gap: 2 },
  footerText: { fontSize: typography.size.xs, color: colors.slate[500] },
});
