"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Loads Firebase Analytics after hydration, only on the public site.
 *
 * The SDK is imported dynamically so it is never evaluated on the server and
 * never shipped to visitors until the page is interactive. Any failure is
 * swallowed — analytics must never break the storefront.
 */
export function FirebaseAnalytics() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (pathname?.startsWith("/admin")) return;

    let active = true;

    import("@/firebase")
      .then(async ({ analyticsPromise, logPageView }) => {
        const analytics = await analyticsPromise;
        if (!active || !analytics) return;

        // `getAnalytics()` already reports the initial page_view.
        if (isFirstRender.current) {
          isFirstRender.current = false;
          return;
        }

        logPageView(analytics, pathname ?? "/");
      })
      .catch(() => {
        /* no-op: analytics is best-effort */
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  return null;
}
