/**
 * Admin session for the native app.
 *
 * Flow:
 *   1. The admin types the same password they use on the website.
 *   2. `POST /api/admin/mobile/login` verifies it and returns the **same signed
 *      admin JWT** the browser gets — as a bearer token instead of a cookie.
 *   3. The token and its expiry are stored in `expo-secure-store`, which is
 *      backed by the Android Keystore. Nothing else about the authentication
 *      model changes.
 *
 * The password itself is never persisted, never logged, and never bundled.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";

import { ApiClient, ApiError } from "@/lib/api";
import type { MobileLoginResponse } from "@/lib/types";

/* ──────────────────────────── secure storage ──────────────────────────── */

const TOKEN_KEY = "fibermesh_admin_token";
const EXPIRY_KEY = "fibermesh_admin_token_expires_at";
/**
 * The FCM token this phone last registered, kept so logout can unregister it
 * even after the app has been restarted (a module-level variable would be empty
 * by then). Not a secret: it is a device address, and it is stored next to the
 * session token it belongs to.
 */
const DEVICE_KEY = "fibermesh_fcm_device_token";

/**
 * `expo-secure-store` has no web implementation. The deliverable is an Android
 * APK, but falling back to an in-memory map keeps `expo start --web` usable for
 * quick UI work instead of crashing on import.
 */
const memoryFallback = new Map<string, string>();
const secureStoreAvailable = {
  value: true as boolean,
};

async function readItem(key: string): Promise<string | null> {
  if (secureStoreAvailable.value) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      secureStoreAvailable.value = false;
    }
  }
  return memoryFallback.get(key) ?? null;
}

async function writeItem(key: string, value: string): Promise<void> {
  if (secureStoreAvailable.value) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      secureStoreAvailable.value = false;
    }
  }
  memoryFallback.set(key, value);
}

async function deleteItem(key: string): Promise<void> {
  memoryFallback.delete(key);
  if (secureStoreAvailable.value) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      secureStoreAvailable.value = false;
    }
  }
}

/* ─────────────────────────────── config ─────────────────────────────── */

const DEFAULT_BASE_URL = "https://fiber-mesh.vercel.app";

/**
 * `EXPO_PUBLIC_*` values are inlined by Metro at build time, so this is a
 * constant in the shipped bundle — which is exactly why it holds no secrets.
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || DEFAULT_BASE_URL
).replace(/\/+$/, "");

export const ENV_LABEL = process.env.EXPO_PUBLIC_ENV_LABEL?.trim() || "production";

/* ────────────────────────────── context ────────────────────────────── */

export type SessionState = "loading" | "signedOut" | "signedIn";

export type SignOutReason = "manual" | "expired";

export type SessionValue = {
  state: SessionState;
  token: string | null;
  baseUrl: string;
  /** Set when the session ended for a reason the user should be told about. */
  signOutReason: SignOutReason | null;
  api: ApiClient;
  signIn: (password: string) => Promise<void>;
  signOut: (reason?: SignOutReason) => Promise<void>;
  /**
   * Remember the FCM token this phone registered, so logout can deactivate it.
   * Called by the notification bridge after a successful registration.
   */
  rememberDeviceToken: (token: string | null) => Promise<void>;
  /**
   * Run an authenticated call. A 401 anywhere signs the app out and surfaces the
   * "session expired" state instead of leaking a raw HTTP error into the UI.
   */
  request: <T>(run: (api: ApiClient) => Promise<T>) => Promise<T>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [signOutReason, setSignOutReason] = useState<SignOutReason | null>(null);

  /** Read by the API client on every request; a ref avoids re-creating it. */
  const tokenRef = useRef<string | null>(null);
  const expiryRef = useRef<number>(0);

  const api = useMemo(
    () => new ApiClient({ baseUrl: API_BASE_URL, getToken: () => tokenRef.current }),
    [],
  );

  const clearSession = useCallback(
    async (reason: SignOutReason) => {
      tokenRef.current = null;
      expiryRef.current = 0;
      await Promise.all([
        deleteItem(TOKEN_KEY),
        deleteItem(EXPIRY_KEY),
        deleteItem(DEVICE_KEY),
      ]);
      setToken(null);
      setSignOutReason(reason);
      setState("signedOut");
    },
    [],
  );

  /* Restore a stored session on launch. */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [storedToken, storedExpiry] = await Promise.all([
        readItem(TOKEN_KEY),
        readItem(EXPIRY_KEY),
      ]);

      if (cancelled) return;

      const expiresAt = storedExpiry ? Number.parseInt(storedExpiry, 10) : 0;
      const valid =
        Boolean(storedToken) && Number.isFinite(expiresAt) && expiresAt > Date.now();

      if (!valid) {
        if (storedToken) await clearSession("expired");
        else setState("signedOut");
        return;
      }

      tokenRef.current = storedToken!;
      expiryRef.current = expiresAt;
      setToken(storedToken);
      setState("signedIn");
    })();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  /** A stored token can expire while the app sits in the background. */
  useEffect(() => {
    if (state !== "signedIn") return;
    const check = () => {
      if (expiryRef.current && expiryRef.current <= Date.now()) {
        void clearSession("expired");
      }
    };
    const timer = setInterval(check, 60_000);
    return () => clearInterval(timer);
  }, [state, clearSession]);

  const signIn = useCallback(
    async (password: string) => {
      const result = await api.post<MobileLoginResponse>("/api/admin/mobile/login", {
        password,
      });

      const expiresAt = Date.now() + result.expiresIn * 1000;
      tokenRef.current = result.token;
      expiryRef.current = expiresAt;

      await Promise.all([
        writeItem(TOKEN_KEY, result.token),
        writeItem(EXPIRY_KEY, String(expiresAt)),
      ]);

      setToken(result.token);
      setSignOutReason(null);
      setState("signedIn");
    },
    [api],
  );

  const signOut = useCallback(
    async (reason: SignOutReason = "manual") => {
      // Best effort: deactivate this phone's registration so it stops receiving
      // lead pushes. Must run *before* the token is cleared, because the endpoint
      // needs authorisation, and a failure here must never block the local
      // logout. The endpoint requires either `?id=` or `?token=`, and the token
      // is what this device knows about itself.
      try {
        const deviceToken = await readItem(DEVICE_KEY);
        if (deviceToken) {
          await api.delete(
            `/api/admin/devices?token=${encodeURIComponent(deviceToken)}`,
          );
        }
      } catch {
        /* offline, expired, or already gone — the local logout still wins */
      }
      await clearSession(reason);
    },
    [api, clearSession],
  );

  const rememberDeviceToken = useCallback(async (deviceToken: string | null) => {
    if (deviceToken) await writeItem(DEVICE_KEY, deviceToken);
    else await deleteItem(DEVICE_KEY);
  }, []);

  const request = useCallback(
    async <T,>(run: (client: ApiClient) => Promise<T>): Promise<T> => {
      try {
        return await run(api);
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthorized) {
          await clearSession("expired");
        }
        throw error;
      }
    },
    [api, clearSession],
  );

  const value = useMemo<SessionValue>(
    () => ({
      state,
      token,
      baseUrl: API_BASE_URL,
      signOutReason,
      api,
      signIn,
      signOut,
      rememberDeviceToken,
      request,
    }),
    [state, token, signOutReason, api, signIn, signOut, rememberDeviceToken, request],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used inside <SessionProvider>.");
  }
  return value;
}
