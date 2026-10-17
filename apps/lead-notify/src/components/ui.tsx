/**
 * Shared UI primitives.
 *
 * These reproduce the web dashboard's visual language in React Native:
 *   - white `rounded-2xl` cards on a `bg-slate-100` page,
 *   - 1px `slate-200` borders, `shadow-card`,
 *   - pills with a tinted background, a coloured label and a 1px ring,
 *   - an 8x8 tinted icon chip inside a stat card.
 *
 * Every text style deliberately omits `textTransform` and `letterSpacing`:
 * Bengali is a joined script and both break its conjuncts and matras.
 */

import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { colors, radius, shadow, space, typography } from "@/theme";
import { statusMeta } from "@/lib/format";

/* ─────────────────────────────── text ─────────────────────────────── */

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

/* ─────────────────────────────── cards ─────────────────────────────── */

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <View style={[styles.card, padded ? styles.cardPadded : null, style]}>{children}</View>
  );
}

export type StatTone = "brand" | "emerald" | "amber" | "violet" | "slate" | "rose";

const TONES: Record<StatTone, { chip: string; icon: string }> = {
  brand: { chip: colors.brand[50], icon: colors.brand[600] },
  emerald: { chip: colors.emerald[50], icon: colors.emerald[600] },
  amber: { chip: colors.amber[50], icon: colors.amber[600] },
  violet: { chip: colors.violet[50], icon: colors.violet[600] },
  slate: { chip: colors.slate[100], icon: colors.slate[600] },
  rose: { chip: colors.rose[50], icon: colors.rose[600] },
};

/** Port of `StatCard` from src/components/admin/StatCard.tsx. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: StatTone;
}) {
  const palette = TONES[tone];
  return (
    <Card style={styles.statCard}>
      <View style={styles.statHeader}>
        <Text style={styles.statLabel} numberOfLines={2}>
          {label}
        </Text>
        {Icon ? (
          <View style={[styles.iconChip, { backgroundColor: palette.chip }]}>
            <Icon size={16} color={palette.icon} strokeWidth={2.2} />
          </View>
        ) : null}
      </View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </Card>
  );
}

/* ────────────────────────────── badges ────────────────────────────── */

/** Port of `StatusBadge` — tinted pill, coloured label, 1px ring. */
export function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: meta.background, borderColor: meta.border },
      ]}
    >
      <View style={[styles.badgeDot, { backgroundColor: meta.dot }]} />
      <Text style={[styles.badgeText, { color: meta.text }]}>{meta.label}</Text>
    </View>
  );
}

export function Pill({
  label,
  background,
  color,
}: {
  label: string;
  background: string;
  color: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

/* ───────────────────────────── buttons ───────────────────────────── */

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon: Icon,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !inactive ? styles.primaryButtonPressed : null,
        inactive ? styles.primaryButtonDisabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} size="small" />
      ) : (
        <>
          {Icon ? <Icon size={18} color={colors.white} strokeWidth={2.4} /> : null}
          <Text style={styles.primaryButtonText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  tone?: "slate" | "brand" | "rose";
}) {
  const palette =
    tone === "brand"
      ? { bg: colors.brand[50], fg: colors.brand[700] }
      : tone === "rose"
        ? { bg: colors.rose[50], fg: colors.rose[700] }
        : { bg: colors.slate[100], fg: colors.slate[700] };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.ghostButton,
        { backgroundColor: palette.bg },
        pressed ? { opacity: 0.7 } : null,
      ]}
    >
      {Icon ? <Icon size={16} color={palette.fg} strokeWidth={2.2} /> : null}
      <Text style={[styles.ghostButtonText, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

/* ──────────────────────────── states ──────────────────────────── */

export function LoadingState({ label = "লোড হচ্ছে..." }: { label?: string }) {
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator color={colors.brand[600]} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.stateBox}>
      {Icon ? (
        <View style={styles.emptyIcon}>
          <Icon size={22} color={colors.slate[400]} strokeWidth={2} />
        </View>
      ) : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.stateText}>{description}</Text> : null}
    </View>
  );
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retryButton} accessibilityRole="button">
          <Text style={styles.retryText}>আবার চেষ্টা করুন</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A labelled value, used on the detail screens. */
export function DetailRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: ReactNode;
  valueStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      {typeof value === "string" ? (
        <Text style={[styles.detailValue, valueStyle]}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

/* ──────────────────────────── styles ──────────────────────────── */

export const styles = StyleSheet.create({
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
  },
  body: {
    fontSize: typography.size.base,
    color: colors.slate[800],
    lineHeight: 22,
  },
  muted: {
    fontSize: typography.size.sm,
    color: colors.slate[500],
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
    marginBottom: space.sm,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.slate[200],
    ...shadow.card,
  },
  cardPadded: { padding: space.lg },

  statCard: { padding: space.md, flex: 1, minHeight: 92, justifyContent: "space-between" },
  statHeader: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  statLabel: {
    flex: 1,
    fontSize: typography.size.xs,
    color: colors.slate[500],
    fontWeight: typography.weight.semibold,
    lineHeight: 15,
  },
  iconChip: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.slate[900],
    marginTop: space.sm,
  },
  statHint: { fontSize: typography.size.xs, color: colors.slate[400], marginTop: 2 },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },

  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },

  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    backgroundColor: colors.brand[600],
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    minHeight: 50,
  },
  primaryButtonPressed: { backgroundColor: colors.brand[700] },
  primaryButtonDisabled: { backgroundColor: colors.brand[300] },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },

  ghostButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: space.md,
  },
  ghostButtonText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },

  stateBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: 40,
    paddingHorizontal: space.lg,
  },
  stateText: {
    fontSize: typography.size.sm,
    color: colors.slate[500],
    textAlign: "center",
    lineHeight: 20,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.slate[100],
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.slate[700],
    textAlign: "center",
  },

  errorBox: {
    backgroundColor: colors.rose[50],
    borderWidth: 1,
    borderColor: colors.rose[200],
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  errorText: { color: colors.rose[700], fontSize: typography.size.sm, lineHeight: 20 },
  retryButton: { alignSelf: "flex-start" },
  retryText: {
    color: colors.rose[700],
    fontWeight: typography.weight.bold,
    fontSize: typography.size.sm,
    textDecorationLine: "underline",
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: 9,
  },
  detailLabel: { fontSize: typography.size.sm, color: colors.slate[500], flexShrink: 0 },
  detailValue: {
    fontSize: typography.size.sm,
    color: colors.slate[900],
    fontWeight: typography.weight.semibold,
    flexShrink: 1,
    textAlign: "right",
  },
  divider: { height: 1, backgroundColor: colors.slate[100] },
});

export { colors, radius, shadow, space, typography };
