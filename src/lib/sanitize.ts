/**
 * Credential scrubbing for anything that leaves this process as text — a log
 * line, an error string persisted on a notification job, or a diagnostics
 * payload.
 *
 * Deliberately dependency-free: no `next/server`, no Prisma, no SDK. That keeps
 * it safe to import from server components, route handlers and client code
 * alike, so there is exactly one redaction implementation in the project.
 */

/**
 * Anything credential-shaped that must never survive into output.
 *
 * Ordered so a broad pattern cannot eat a more specific one. Every replacement
 * is a fixed label: a redacted string stays readable and carries no fragment of
 * the original value.
 */
export const SECRET_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    "[redacted private key]",
  ],
  [/"private_key"\s*:\s*"[^"]*"/g, '"private_key":"[redacted]"'],
  [
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    "[redacted jwt]",
  ],
  [/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi, "Bearer [redacted]"],
  [/AIza[0-9A-Za-z_-]{10,}/g, "[redacted api key]"],
  [/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://[redacted]"],
  // An FCM registration token or a service-account blob: a long base64 run.
  // The threshold is 100 rather than 160 because real FCM tokens sit around
  // 140-165 characters and erring low only ever costs a less detailed log line.
  [/[A-Za-z0-9+/]{100,}={0,2}/g, "[redacted blob]"],
];

/** Longest string any helper here will return. */
export const MAX_SAFE_LENGTH = 400;

/** Strip credential-shaped substrings from a string. */
export function redact(value: string): string {
  let out = value;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * A bounded, redacted, single-line description of a thrown value.
 *
 * Returns a *string* on purpose: handing an error object to a logger lets the
 * platform expand it, which is how query parameters — and therefore customer
 * phone numbers — end up in log storage.
 */
export function safeErrorText(error: unknown): string {
  const text =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "unknown error";
  return redact(text).replace(/\s+/g, " ").slice(0, MAX_SAFE_LENGTH);
}
