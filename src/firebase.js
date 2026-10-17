/**
 * Firebase — client-side analytics only.
 *
 * NOTE: this is a Next.js (App Router) project, so environment variables must be
 * prefixed with `NEXT_PUBLIC_` and read from `process.env`. Vite's
 * `import.meta.env.VITE_*` is *not* replaced by the Next.js compiler and would
 * always be `undefined` at runtime.
 *
 * The Firebase web config is public by design (it identifies the project, it does
 * not authorise anything). Never put Admin SDK service-account keys here — those
 * are server secrets and must never reach the browser bundle.
 */
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported, logEvent } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/** Variable names only — values are never logged. */
export const missingFirebaseEnv = Object.entries(firebaseConfig)
  .filter(([, value]) => !value || !String(value).trim())
  .map(([key]) => `NEXT_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);

export const isFirebaseConfigured = missingFirebaseEnv.length === 0;

if (!isFirebaseConfigured && process.env.NODE_ENV !== "production") {
  // Helpful for local setup, silent in production, and never prints values.
  console.warn(
    `[firebase] Analytics disabled — missing: ${missingFirebaseEnv.join(", ")}. ` +
      "Add them to .env (local) and to your Vercel project settings, then redeploy.",
  );
}

/**
 * Reuses an existing app so hot-reload / repeated imports never throw
 * "Firebase App named '[DEFAULT]' already exists".
 */
const app = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export default app;

/**
 * Analytics is optional: it is only initialised in the browser and only when the
 * environment supports it (no SSR, no IndexedDB-less browsers, no ad blockers
 * that break the SDK). Resolves to `null` instead of throwing.
 */
export const analyticsPromise =
  app && typeof window !== "undefined"
    ? isSupported()
        .then((supported) => (supported ? getAnalytics(app) : null))
        .catch(() => null)
    : Promise.resolve(null);

/**
 * App Router navigations are client-side, so the automatic `page_view` only
 * covers the first load. Call this on every route change.
 */
export function logPageView(analytics, path) {
  if (!analytics || typeof window === "undefined") return;
  logEvent(analytics, "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}
