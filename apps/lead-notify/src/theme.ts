/**
 * Design tokens ported from the web admin dashboard so the native app looks like
 * the same product.
 *
 * Source of truth on the web side:
 *   tailwind.config.ts   → `brand` / `accent` palettes, `shadow-card`
 *   src/app/globals.css  → page background, card surface
 *   src/components/admin/AdminShell.tsx → dark navy chrome
 *
 * Values are duplicated here rather than imported: the mobile app is a separate
 * package with its own bundler and must not reach into the Next.js source tree.
 * If a colour changes on the website, change it in both places.
 */

export const colors = {
  /** tailwind.config.ts → theme.extend.colors.brand */
  brand: {
    50: "#eff8ff",
    100: "#dbeefe",
    200: "#bfe1fe",
    300: "#93cefd",
    400: "#60b1fa",
    500: "#3b92f6",
    600: "#2574eb",
    700: "#1d5dd8",
    800: "#1e4caf",
    900: "#1d428a",
    950: "#162a54",
  },
  /** tailwind.config.ts → theme.extend.colors.accent */
  accent: {
    50: "#fffaeb",
    100: "#fef0c7",
    200: "#fedf89",
    300: "#fec84b",
    400: "#fdb022",
    500: "#f79009",
    600: "#dc6803",
    700: "#b54708",
  },
  /** Tailwind's default slate scale — the app's neutral ramp. */
  slate: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  },
  emerald: { 50: "#ecfdf5", 200: "#a7f3d0", 600: "#059669", 700: "#047857" },
  amber: { 50: "#fffbeb", 200: "#fde68a", 600: "#d97706", 700: "#b45309" },
  sky: { 50: "#f0f9ff", 200: "#bae6fd", 600: "#0284c7", 700: "#0369a1" },
  orange: { 50: "#fff7ed", 200: "#fed7aa", 600: "#ea580c", 700: "#c2410c" },
  violet: { 50: "#f5f3ff", 200: "#ddd6fe", 600: "#7c3aed", 700: "#6d28d9" },
  rose: { 50: "#fff1f2", 200: "#fecdd3", 600: "#e11d48", 700: "#be123c" },
  white: "#ffffff",
} as const;

/** Matches Tailwind's rounded-lg / xl / 2xl / full. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** 4px base grid, same as Tailwind's default spacing scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

/**
 * `shadow-card` on the web is `0 1px 2px rgb(16 24 40/.04), 0 1px 3px rgb(16 24 40/.08)`.
 * Android has no multi-layer shadow, so `elevation` is used for the ambient part
 * and a soft shadow* trio covers the rest.
 */
export const shadow = {
  card: {
    elevation: 2,
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  raised: {
    elevation: 6,
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
} as const;

export const typography = {
  /**
   * No custom font is loaded. Android ships Noto Sans Bengali, so Bengali text
   * (the primary language of this UI) renders correctly out of the box.
   * Deliberately no letter-spacing or uppercase anywhere: both break Bengali
   * conjuncts.
   */
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;

export const theme = { colors, radius, space, shadow, typography };
export default theme;
