/**
 * Owns the whole device-side push lifecycle and connects it to the app:
 *
 *   signed in  →  channel + permission + FCM token  →  POST /api/admin/devices
 *   token rolls →  re-POST the new token
 *   push arrives (any app state) → bump `leadSignal` so lists re-fetch
 *   tapped     →  deep-link to the order detail screen
 *   signed out →  the session deletes the registration
 *
 * It lives in the root layout so the listeners exist for the whole app lifetime
 * and never get double-registered by a screen remounting.
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
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";

import {
  addTokenRefreshListener,
  deviceLabel,
  responseKey,
  setupPush,
  targetFromResponse,
  type LeadTarget,
} from "@/lib/push";
import { useSession } from "@/lib/session";
import type { DeviceRegisterResponse } from "@/lib/types";

export type PushStatus =
  | { state: "idle" }
  | { state: "registering" }
  | { state: "registered"; token: string; label: string }
  | { state: "permission-denied" }
  | { state: "unsupported"; reason: string }
  | { state: "error"; message: string };

export type PushContextValue = {
  status: PushStatus;
  /** Increments on every lead push received while the app is running. */
  leadSignal: number;
  /** Re-run the whole permission + token + registration flow (Settings button). */
  retry: () => void;
};

const PushContext = createContext<PushContextValue>({
  status: { state: "idle" },
  leadSignal: 0,
  retry: () => undefined,
});

export function usePush(): PushContextValue {
  return useContext(PushContext);
}

export function PushProvider({ children }: { children: ReactNode }) {
  const { state: sessionState, request, rememberDeviceToken } = useSession();
  const router = useRouter();

  const [status, setStatus] = useState<PushStatus>({ state: "idle" });
  const [leadSignal, setLeadSignal] = useState(0);
  const [attempt, setAttempt] = useState(0);

  /** The token we last successfully registered, to avoid redundant POSTs. */
  const registeredToken = useRef<string | null>(null);
  /** Guards against handling the same tap twice (cold start + listener). */
  const handledResponse = useRef<string | null>(null);

  const navigateTo = useCallback(
    (target: LeadTarget | null) => {
      if (!target) return;
      if (target.kind === "order") {
        router.push({ pathname: "/order/[id]", params: { id: target.id } });
      } else if (target.kind === "inquiry") {
        router.push("/messages");
      } else {
        router.push("/orders");
      }
    },
    [router],
  );

  const register = useCallback(
    async (token: string, label: string) => {
      await request((api) =>
        api.post<DeviceRegisterResponse>("/api/admin/devices", {
          token,
          platform: "ANDROID",
          label,
        }),
      );
      registeredToken.current = token;
      // So logout can deactivate this registration later.
      await rememberDeviceToken(token);
    },
    [request, rememberDeviceToken],
  );

  /* ── 1. permission → token → registration, on sign-in ── */
  useEffect(() => {
    if (sessionState !== "signedIn") {
      registeredToken.current = null;
      setStatus({ state: "idle" });
      return;
    }

    let cancelled = false;

    (async () => {
      setStatus({ state: "registering" });
      const result = await setupPush();
      if (cancelled) return;

      if (result.status === "permission-denied") {
        setStatus({ state: "permission-denied" });
        return;
      }
      if (result.status === "unsupported") {
        setStatus({ state: "unsupported", reason: result.reason });
        return;
      }
      if (result.status === "error") {
        setStatus({ state: "error", message: result.message });
        return;
      }

      try {
        await register(result.token, result.label);
        if (cancelled) return;
        setStatus({ state: "registered", token: result.token, label: result.label });
      } catch (error) {
        if (cancelled) return;
        setStatus({
          state: "error",
          message:
            error instanceof Error
              ? error.message
              : "ডিভাইস নিবন্ধন করা যায়নি।",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionState, register, attempt]);

  /* ── 2. FCM rotated the token: re-register immediately ── */
  useEffect(() => {
    if (sessionState !== "signedIn") return;

    const subscription = addTokenRefreshListener((token) => {
      if (token === registeredToken.current) return;
      void (async () => {
        try {
          const label = deviceLabel();
          await register(token, label);
          setStatus({ state: "registered", token, label });
        } catch {
          // Offline, or the session expired: the next app start re-registers.
        }
      })();
    });

    return () => subscription.remove();
  }, [sessionState, register]);

  /* ── 3. a push arrived while the app is running ── */
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      setLeadSignal((value) => value + 1);
    });
    return () => subscription.remove();
  }, []);

  /* ── 4. the user tapped a push ── */
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const key = responseKey(response);
        if (key && key === handledResponse.current) return;
        handledResponse.current = key;
        navigateTo(targetFromResponse(response));
      },
    );
    return () => subscription.remove();
  }, [navigateTo]);

  /* ── 5. the app was launched *by* a tap (cold start) ──
   * `getLastNotificationResponse()` is synchronous and non-deprecated in SDK 58.
   * It can only be routed once the session is restored, otherwise the auth
   * guard would bounce the navigation straight back to the login screen. */
  useEffect(() => {
    if (sessionState !== "signedIn") return;

    const last = Notifications.getLastNotificationResponse();
    if (!last) return;

    const key = responseKey(last);
    if (key && key === handledResponse.current) return;
    handledResponse.current = key;

    navigateTo(targetFromResponse(last));
    // Consume it so a later remount does not navigate again.
    Notifications.clearLastNotificationResponse();
  }, [sessionState, navigateTo]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const value = useMemo<PushContextValue>(
    () => ({ status, leadSignal, retry }),
    [status, leadSignal, retry],
  );

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}
