# Security audit — Fiber Mesh

**Date:** 18 October 2026
**Scope:** the whole repository — Next.js site + admin + API routes + Prisma/Postgres, the
lead-notification pipeline, and the `apps/lead-notify` Android app.
**Auditor:** automated review performed on the working tree, with the live production
deployment and the production database inspected read-only.

> **No secret value appears in this document.** Where a variable matters it is named,
> never quoted: `FIREBASE_PRIVATE_KEY=[REDACTED]`. Two values are unavoidable and are
> already public by design — the Firebase *web* config (`NEXT_PUBLIC_FIREBASE_*`) and
> the Vercel project/team ids.

---

## 1. Method

| Area | How it was checked |
| --- | --- |
| Repository contents | `git ls-files`, `git status --untracked-files=all`, `git check-ignore -v` for every sensitive path |
| Git history | every path ever added (`git log --all --diff-filter=A --name-only`) and every blob on every ref (`git grep` across `git rev-list --all`) searched for key-shaped strings |
| Source | pattern sweep for `AIza…`, `npg_…`, `postgres://user:pass@`, `-----BEGIN … PRIVATE KEY-----`, `"private_key"`, `AKIA…`, `ghp_…`, `sk-…`, `xox…`, service-account blobs |
| Configuration | `next.config.mjs`, `src/middleware.ts`, `app.json`, `app.config.js`, `eas.json`, `.env.example` files |
| Auth & API | every `src/app/api/**/route.ts` read for its guard; live probing of the production deployment |
| Env boundary | `vercel env ls` (names + scope only; secret values are write-only) |
| Runtime logs | `vercel logs` on the live production deployment |
| Dependencies | `npm audit` in the root and in `apps/lead-notify` |
| Live site | response headers, `/admin` redirect behaviour, admin API status codes |
| Tests | `npm test`, `npm run test:integration`, `npm run test:integration:manual`, `tsc --noEmit` (root + app), `expo lint`, `expo-doctor`, `npm run build` |

---

## 2. Summary

| ID | Severity | Status | Finding |
| --- | --- | --- | --- |
| **A-01** | **High** | **Fixed** | Firebase Admin credentials could never be parsed, so push delivery was permanently disabled in production |
| **A-02** | Medium | **Fixed** | The notification diagnostic gave a false all-clear while push was broken |
| **A-03** | **High** | **Fixed** | `AUTH_SECRET` silently fell back to a publicly-known constant in production |
| **A-04** | Medium | **Fixed** | Raw error objects were logged; Prisma errors quote query arguments |
| A-05 | Low | **Fixed** | The Android project had no ESLint configuration |
| **A-06** | Medium | **Fixed** | A job whose instance died mid-send was stranded in `PROCESSING` forever |
| **B-01** | Medium | Open | No Content-Security-Policy |
| **B-02** | Medium | Open | `/_next/image` proxies any https URL (`hostname: "**"`) |
| **B-03** | Medium | Open | `CRON_SECRET` is not set in production, so the outbox retry endpoint is off |
| B-04 | Low | Open | Client IP / rate limiting is best-effort and per-instance |
| B-05 | Low | Open | 16 (root) and 27 (app) npm advisories, all build-time transitive |
| B-06 | Low | Open | Three website test orders are live and need a decision |
| B-07 | Low | Open | An expired mobile session cannot unregister its device |

Fixed items are described in §3, open items in §4, and everything that was checked and
found sound in §5.

---

## 3. Findings fixed in this pass

### A-01 — Firebase Admin credentials could never be parsed (High) — FIXED

**Impact:** push notifications for new orders and inquiries never arrived, in any app
state (foreground, background or terminated). Every job was recorded and then
`SKIPPED`.

**Evidence.** Production runtime log:

```
[notifications] push delivery disabled: Error: FIREBASE_SERVICE_ACCOUNT_JSON is set
but is missing projectId / clientEmail / privateKey. (missing: none)
```

and the live API reporting `pushConfigured: false` while
`missingServerKeys: (none missing)`.

The database shows the consequence directly — four jobs committed and then all skipped,
including one for an inquiry, which proves the outbox itself worked and only delivery was
dead:

```
SKIPPED  4
  2026-10-18T06:03:04  inquiry.created
  2026-10-18T05:02:09  order.created
  2026-10-18T04:13:04  order.created
  2026-10-18T03:46:30  order.created
```

**Root cause.** `src/lib/notifications/firebase-admin.ts` read camelCase keys:

```ts
if (parsed.projectId && parsed.clientEmail && parsed.privateKey) { … }
```

but the file Google's *Project settings → Service accounts → Generate new private key*
writes uses **snake_case**: `project_id`, `client_email`, `private_key`. Those names can
never collide, so a genuine service-account file always failed the check. The variable
was configured correctly and still could never work — which is why the previous
"set `FIREBASE_SERVICE_ACCOUNT_JSON` on Vercel" step did not fix the symptom.

**Fix.** `parseServiceAccountJson()` now accepts both spellings, tolerates raw JSON or
base64 (base64 being newline-proof), normalises escaped `\n` *and* literal newlines in
`private_key`, and requires a PEM block. Table added:
`DeviceToken`, `NotificationJob` and `NotificationDelivery` were already in place.

**Verification.** `tests/firebase-config.test.ts` — a locally generated throwaway RSA key
is parsed and handed to the real `firebase-admin` `cert()` + `getMessaging()`, and
`isPushConfigured()` is asserted `true`. `tests/integration.manual-order.ts` shows the
end-to-end queue → dispatch → `SENT` path.

**Confirmed against production after deploying the fix:**

```
npm run verify:push          → 53 passed, 0 failed
  pushConfigured                                  = true
  pushConfigIssue                                 = null
  job reaches a terminal status                   = SENT   (was SKIPPED)
  POST /api/admin/notifications/test → outcome    = sent   (real device, SM-A245F)
```

The contrast with the pre-deploy run is the proof. A real order placed *during* the
outage (`FM-20261018-0005`, 20 minutes before the fix finished building) has a delivery
row reading `SKIPPED  error=push-not-configured`, while the same send path one
deployment later returns `sent`. No credential value was read at any point — only
shapes, statuses and outcomes.

### A-02 — The diagnostic reported a false all-clear (Medium) — FIXED

**Impact:** an administrator looking at the app's *সার্ভারের অবস্থা* panel, or at
`GET /api/admin/devices`, was told nothing was missing while nothing worked. There was no
way to tell "not configured" apart from "configured but unusable".

**Fix.** `missingPushEnvKeys()` reports *variable names* and correctly stays empty when the
variable is present. A second, additive field now explains the other case:

```ts
pushConfigIssue(): { code: "no-credentials" | "invalid-json" | "missing-fields"
                       | "invalid-private-key" | "init-failed";
                    detail: string } | null
```

`code` is a fixed enum, and `detail` contains field **names** only
(`missing: private_key`) or a fixed phrase. It is returned by `GET /api/admin/devices`,
by `POST /api/admin/notifications/test` (503 body), and rendered in Bengali in the app's
Settings screen. `tests/firebase-config-broken.test.ts` asserts no credential material
reaches it.

### A-03 — `AUTH_SECRET` fell back to a public constant (High) — FIXED

**Impact (live exposure: none).** `src/lib/session.ts` contained:

```ts
const secret = process.env.AUTH_SECRET ?? "dev-only-secret-change-me-please-0123456789abcdef";
if (secret.length < 32) { if (production) throw … }
```

The fallback is 47 characters, so the guard **never fired**. Any deployment with no
`AUTH_SECRET` would sign and verify admin sessions with a key published in this public
GitHub repository — an attacker could mint their own admin JWT and read every order,
inquiry and customer phone number, or write orders.

Production *does* have `AUTH_SECRET` set (`vercel env ls` → `Secret`, scope
`Production`), so the live site was not exploitable. The path was still live for any
other environment built from this code.

**Fix.** `getSecretKey()` now fails closed when `NODE_ENV === "production"` if the
variable is absent, is still the built-in fallback, or is shorter than 32 characters.
Throwing is safe for verification (`verifyAdminToken` catches and returns `null`, i.e.
"not signed in") and makes the *issuing* path fail loudly instead of handing out a
forgeable token.

**Action required from you:** `AUTH_SECRET` is scoped to `Production` only. Add it to
`Preview` and `Development` as well (any 32+ character random string —
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). Preview
deployments currently have no `DATABASE_URL` either, so they cannot reach the database;
this keeps admin auth failing closed there rather than open.

### A-04 — Raw error objects were logged (Medium) — FIXED

**Impact:** 20 call sites logged the thrown value directly, e.g.
`console.error("[api/admin/orders]", error)`. Prisma's error text quotes query arguments,
so a failed insert could write a customer's name, phone number or an FCM device token
into Vercel's log storage, where it is retained and readable by anyone with project
access. FCM tokens are also a credential: a leaked one lets an attacker push to that
device.

**Fix.** New dependency-free `src/lib/sanitize.ts` with one `redact()` +
`safeErrorText()`, applied via a new `logError(scope, error)` in `src/lib/api.ts`.
All 20 route call sites were converted, plus `src/lib/catalog.ts`. Redaction covers
PEM blocks, JSON `private_key` fields, JWTs, `Bearer`/`Basic` credentials, `AIza…` API
keys, credential-bearing `postgres://` URLs, and long base64 runs (service-account blobs
and FCM tokens). Output is collapsed to one line and clamped to 400 characters.
The notification pipeline's persisted `lastError` now uses the same scrubber.

**Verification.** `tests/sanitize.test.ts` — 14 cases, including a Prisma-style error that
quotes a device token.

The three remaining `console.warn` sites were checked too: `src/firebase.js` (client
analytics, prints **variable names only** and stays silent in production),
`src/lib/notifications/firebase-admin.ts` and `src/lib/notifications/schedule.ts` — the
latter two already went through `safeError()`, which now redacts because it delegates to
the same scrubber. So every `console.*` call site in `src/` is credential-free.

### A-05 — The Android project had no ESLint configuration (Low) — FIXED

`expo lint` was not configured. It is now (`eslint.config.js`, `eslint` +
`eslint-config-expo` dev dependencies, `npm run lint`). Real findings were fixed: a
genuine `react-hooks/exhaustive-deps` problem in the new manual-order screen, and Node
globals for the icon-generation script. Two of the reported errors were a false positive
(`import/namespace` cannot follow `expo-notifications`' CommonJS interop for
`AndroidImportance` / `AndroidNotificationVisibility` — both confirmed present in the
package's build output) and are documented with a file-scoped disable. The remaining
React Compiler advisory rules (`set-state-in-effect`, `preserve-manual-memoization`,
`refs`) are set to **warn** rather than off, with the reason recorded inline; clearing
them needs a data-fetching refactor tracked as follow-up work, not a security fix.

### A-06 — A job orphaned mid-send was stranded forever (Medium) — FIXED

**Impact:** a new order or inquiry could be saved successfully, commit its outbox job,
and then **never notify anyone and never be retried** — with no error recorded anywhere.
Found while re-running the production smoke test, which caught a job still in
`PROCESSING`.

**Root cause.** The normal delivery path runs inside Next's `after()`, i.e. *after* the
response has been sent. The dispatcher writes `PROCESSING` when it claims a job and only
writes a terminal status when it finishes. If the serverless instance is frozen or
reclaimed in between — a normal, expected event — nothing writes that terminal status
and the row sits in `PROCESSING`. But the retry query was:

```ts
where: { status: { in: ["PENDING", "FAILED"] }, … }   // PROCESSING is invisible
```

so the retry endpoint would never pick it up. The notification was permanently lost,
silently. `SENT`, `SKIPPED` and `FAILED` were all reachable; `PROCESSING` was a black
hole.

**Fix.** `listRetryableJobIds()` now also returns `PROCESSING` jobs whose `updatedAt` is
older than `STALE_PROCESSING_MS` (5 minutes — a real send takes well under a second).
Crucially, a **fresh** `PROCESSING` job is still left alone, so a live dispatch is never
raced. Retrying is safe because delivery is recorded per `(job, device)` and a device
that already reached `SENT` is skipped, so the worst case is one extra push to a device
whose delivery row was not written before the instance died.

No migration was needed: `updatedAt` already exists, and the existing
`[status, createdAt]` index is selective enough for a table this size.

**Verification.** Three cases in `tests/notifications.test.ts` — a fresh `PROCESSING`
job is **not** stolen (and nothing is sent), a stale one **is** recovered and delivered,
and `SENT`/`SKIPPED` are never retried. The production smoke test now polls for a
terminal status instead of racing the inline dispatch, which is how this surfaced.

---

## 4. Open findings and recommendations

### B-01 — No Content-Security-Policy (Medium)

Captured live headers on `https://fiber-mesh.vercel.app/`:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
(no Content-Security-Policy)
(no X-Powered-By — poweredByHeader: false works)
```

HSTS, nosniff, frame-options and referrer-policy are all present, and there is no
`X-Powered-By` fingerprint. A CSP is the missing layer: it is the control that limits the
damage of an injected script, and this site loads Firebase Analytics and Google Fonts,
which is exactly the case where a policy helps.

**Recommendation.** Add a report-only policy first, then enforce. A starting point that
matches what the site actually loads:

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://www.googletagmanager.com;
img-src 'self' data: https:;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' https://*.google-analytics.com https://*.firebaseio.com;
frame-ancestors 'none'; base-uri 'self'; form-action 'self';
```

Next.js injects inline bootstrap scripts, so `'unsafe-inline'` in `script-src` (or a
nonce) is required; that weakens the policy but still blocks external script injection and
gives `frame-ancestors`, `base-uri` and `form-action` for free.

### B-02 — `/_next/image` is an open image proxy (Medium)

`next.config.mjs`:

```js
images: { remotePatterns: [{ protocol: "https", hostname: "**" }] }
```

Any `https` host is accepted, so `/_next/image?url=https://any-host/x.jpg&w=…` makes the
deployment fetch and re-serve an arbitrary remote resource. That is a free bandwidth and
reputation proxy for a third party, and it gives a limited SSRF primitive restricted to
`https` GETs. It exists because product photos are admin-supplied URLs.

**Recommendation.** Restrict `remotePatterns` to the hosts product images actually come
from. If the source is genuinely open, keep `**` but be aware the endpoint is public, and
consider validating `imageUrl` against an allow-list in the admin product form so the
config can be tightened later.

### B-03 — `CRON_SECRET` is not set in production (Medium)

`vercel env ls` shows `AUTH_SECRET`, `ADMIN_PASSWORD`, `DATABASE_URL*` and
`FIREBASE_SERVICE_ACCOUNT_JSON` scoped to `Production` — but no `CRON_SECRET`. So
`GET /api/cron/notifications` returns `503` and never runs.

This fails **safe** (an unset secret disables the endpoint rather than leaving it open —
`tests/integration.*` assert that), which is the right default. The cost is that the
outbox has no retry safety net: a job that fails because the transport hiccuped stays
`FAILED` until the next attempt that would have been made anyway. With A-01 now fixed,
inline delivery should succeed, so this is a resilience gap rather than an outage.

**Recommendation.** Set `CRON_SECRET` on Vercel, then uncomment the `crons` entry in
`vercel.json` (documented, deliberately opt-in) so `order.created` / `inquiry.created`
jobs are retried automatically.

### B-04 — Rate limiting is best-effort and per-instance (Low)

`src/lib/api.ts` keeps counters in a per-process `Map`, so limits are approximate: a
serverless function scaled to N instances multiplies the effective limit by N, and
`getClientIp()` trusts the leftmost `x-forwarded-for` entry, which is client-supplied
unless the platform overwrites it (Vercel sets `x-forwarded-for`, but the first element
is not authoritative).

Current limits are sensible for form spam: login 10 per 15 min per IP, inquiries 6 per
10 min, order creation and device registration bounded too. As abuse control — not as a
security boundary — this is acceptable. If the site is ever targeted, move the counter to
Postgres or Upstash and key it on `request.ip ?? x-real-ip` rather than the header's first
value.

### B-05 — Dependency advisories (Low)

`npm audit`: **16** in the root (3 moderate, 13 high) and **27** in `apps/lead-notify`
(8 moderate, 19 high). No critical. Everything reportable is a **build-time or dev-time
transitive** dependency — `braces`/`micromatch`/`chokidar`/`postcss`/`tailwindcss` in the
root, and the Metro/Expo CLI chain in the app (`node-forge`, `@expo/cli`, `metro*`).
The one runtime-adjacent chain is `@grpc/grpc-js` via `@firebase/firestore`, pulled in by
the client `firebase` package; the server imports only `firebase-admin/app` and
`firebase-admin/messaging`, so Firestore is never loaded server-side.

**Recommendation.** `npm audit fix` (without `--force`) when convenient, and re-check
after each Expo SDK upgrade, which is when the Metro chain usually clears. Not worth a
breaking-change upgrade on its own.

### B-06 — Three website test orders (and one inquiry) are live (Low) — needs your decision

Production currently holds four orders. The real customer order is untouched:

```
2026-10-17T19:56  FM-20261018-0001  0158••••39  qty=3  total=7500   PENDING    WEBSITE
```

Three further orders were placed through the website on 18 October and carry look-alike
test data (`note` = twenty `a`s, `note` = ten `a`s), and a **fifth order is real** —
`FM-20261018-0005` (`Nomayen Hossain`, the shop's own number), placed on 18 Oct while
the fix was still building:

```
2026-10-18T03:46  FM-20261018-0002  0179••••58  qty=5  total=12250  COMPLETED  WEBSITE
2026-10-18T04:13  FM-20261018-0003  0158••••39  qty=1  total=2500   SHIPPED    WEBSITE  note=aaaaaaaaaaaaaaaaaaaa
2026-10-18T05:02  FM-20261018-0004  0176••••25  qty=2  total=5000   PENDING    WEBSITE  note=aaaaaaaaaa
2026-10-18T06:37  FM-20261018-0005  0158••••39  qty=2  total=5000   CONFIRMED  WEBSITE  ← real
```

`0003` and `0005` share the real customer's phone number, and `0003`'s status has since
been moved to `SHIPPED` from the dashboard, so these may be genuine orders placed by the
shop while testing the flow. `FM-20261018-0001` was also set to `CANCELLED` from the
dashboard during this session — `DELETE` was never used.

`0005`'s notification was **not** delivered: it arrived 20 minutes before the fixed
build existed, and its delivery row reads `SKIPPED / push-not-configured`. That is the
outage, captured in one row. It will not be retried retroactively, by design —
`SKIPPED` is terminal, so old events never buzz late.

There is also **one inquiry**, submitted through the public contact form at
`2026-10-18T06:03Z` (same phone number as `0001`/`0003`, no subject, already marked
read). No test, script or integration run creates an inquiry — both integration suites
assert they leave none behind — so this came from the live site.

**Nothing has been deleted** — these are production rows and your instruction is that
deleting real orders needs explicit approval. Tell me which of `0002`–`0004` are
disposable test rows and I will remove only those, or leave all four in place.

### B-07 — An expired session cannot unregister its device (Low, documented)

If the stored bearer token expires before the user opens the app again, the app cannot
authenticate the unregister call, so the `DeviceToken` row stays `isActive = true` and
keeps receiving pushes. Already documented as a known limitation. Manual cleanup:

```sql
UPDATE "DeviceToken" SET "isActive" = false WHERE label LIKE '%Pixel%';
```

A cleaner fix is to have the device row carry its own expiry and have the dispatcher skip
inactive-for-too-long rows.

---

## 5. Verified sound — checked, no action needed

**Secrets and the repository**

- Every path ever added across all refs is known, and **no `.env`, `google-services.json`,
  keystore (`.jks`/`.keystore`), `.pem`, `.apk` or `.aab` has ever been committed**.
- All refs/blobs were grepped for key shapes; the only hits were deliberate placeholders in
  `.env.example` and `README.md` (`postgresql://user:password@ep-xxx…`,
  `FIREBASE_SERVICE_ACCOUNT_JSON=""`).
- `.gitignore` covers `.env`, `.env.*`, `*.pem`, keystores, APKs and the app's native
  directories; nested `.gitignore`s add `google-services.json` and the app's `.env`.
  `git check-ignore -v` confirms each rule actually fires. `.vercelignore` and the EAS
  archive both exclude `apps/` and `.env` respectively.
- The repository is public and that is assumed throughout: nothing in it is treated as
  confidential.

**Credential boundary**

- `NEXT_PUBLIC_*` variables are only Firebase **web** config plus site content (phone,
  hours, Facebook). Firebase web config is public by design and authorises nothing;
  the Android app uses a separate API key and neither appears anywhere in Git history.
- `apps/lead-notify` uses only `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_ENV_LABEL`,
  both non-secret and baked into the APK by design. The app holds no server credential —
  it receives a bearer token after the admin types their password.
- The Firebase Admin SDK is imported **only** by `src/lib/notifications/*` and the two
  route handlers that need it; `getPushMessaging()` throws if ever evaluated in a browser
  bundle, and no Admin value is stored in a `NEXT_PUBLIC_*` variable.
- Server-only secrets (`ADMIN_PASSWORD`, `AUTH_SECRET`, `CRON_SECRET`, `DATABASE_URL`,
  `FIREBASE_*`) appear in no `"use client"` module. The two apparent hits were *variable
  names inside explanatory UI text*, not values.

**Authentication and API**

- Every `src/app/api/admin/**/route.ts` verifies the session before doing anything; only
  `POST /api/admin/login`, `/api/admin/logout` and `POST /api/admin/mobile/login` are
  public, which is inherent to being a login endpoint. `/api/admin/session` is
  cookie-only by design.
- `middleware.ts` protects `/admin` pages at the edge, and each API handler guards itself —
  the important layer, since middleware is not relied on for API authorisation.
- Live probes: `/admin` → `307` redirect to `/admin/login`; `/api/admin/stats` with no
  credentials → `401`; an *invalid* bearer token → `401` with no silent cookie fallback
  (asserted in `tests/manual-order.test.ts` and by `npm run verify:push`).
- Passwords are compared with a constant-time `safeEqual`; the login response returns a
  token and nothing else, and never echoes the password.
- `POST /api/admin/notifications/test` is session-required, rate limited
  (5 per 10 min per session subject), resolves its target from `session.sub` only, sends a
  fixed PII-free payload, creates no `NotificationJob`, and returns only sanitised FCM
  outcome codes.
- Public write endpoints (`/api/orders`, `/api/inquiries`) are rate limited, validated
  with Zod, and `/api/orders` carries a honeypot; totals are always recomputed server-side
  from the database, never taken from the client.
- No `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere in `src/`.
- Prisma parameterises every query; there is no raw SQL built from input.

**Data handling**

- The device-list API returns a masked token preview and never the full FCM token
  (asserted by `npm run verify:push`).
- Notification payloads carry an order number, product name, quantity and total — no
  customer name, phone or address (asserted in `tests/notifications.test.ts` and
  `tests/integration.manual-order.ts`).
- The audit tooling added in this pass (`scripts/inspect-devices.ts`,
  `scripts/inspect-orders.ts`, `scripts/diagnose-firebase-env.mjs`) prints masked phones,
  masked tokens and credential *shapes* only — never a value.

**Build and test health at the audit date**

| Check | Result |
| --- | --- |
| `tsc --noEmit` (root) | 0 errors |
| `tsc --noEmit` (app) | 0 errors |
| `npm run build` | 25 routes |
| `npm test` | 76 passed, 0 failed |
| `npm run test:integration` | 24 passed, 0 failed |
| `npm run test:integration:manual` | 18 passed, 0 failed |
| `expo lint` | 0 errors, 11 warnings (documented) |
| `expo-doctor` | 20/20 |

---

## 6. What this audit could **not** verify

- **Vercel secret values.** They are write-only; `vercel env pull` returns `[SENSITIVE]`
  for all five. Configuration was therefore judged by *shape and behaviour* — the
  sanitized parser, the runtime log, and the live diagnostics response — not by reading
  the value.
- **On-device push rendering.** Server-side delivery is now proven: after the fix was
  deployed, `POST /api/admin/notifications/test` returned `sent` for the real registered
  device, and the smoke test's job reached `SENT` instead of `SKIPPED`. What remains
  unproven is **how that push is displayed** — foreground, background and terminated,
  tap-through from a cold start, and the Bengali rendering on a lock screen. FCM
  returning `sent` means the message was accepted and routed, not that the phone drew it.
  `docs/TESTING_CHECKLIST.md`, Part 2 is the verification, and **no real-device display
  result is claimed anywhere in these docs.**
- **The APK binary beyond the earlier string scan** (Firebase sender id, channel
  `orders_high`, `POST_NOTIFICATIONS`, `FirebaseMessagingService`, package, scheme). Static
  inspection cannot prove runtime behaviour.
- **Neon/Postgres server configuration** — TLS enforcement, IP allow-list and backup
  policy live in the Neon console, outside this repository.

---

## 7. Action items for you

1. ~~**Approve the redeploy** so A-01/A-02/A-03/A-04 reach production.~~ **Done** —
   commit `488c813` is deployed to https://fiber-mesh.vercel.app and `pushConfigured`
   is now `true`. A test push has reached the real device.
2. **Run Part 2 of `docs/TESTING_CHECKLIST.md` on the phone.** This is the last real
   unknown: whether the notification is *displayed* in foreground, background and
   terminated states, and whether a cold-start tap opens the right order.
3. **Confirm `AUTH_SECRET` for `Preview`/`Development`**, or accept that admin auth fails
   closed there.
4. **Set `CRON_SECRET`** and enable the `crons` entry if you want automatic retries.
5. Optional: add a CSP (B-01) and tighten `images.remotePatterns` (B-02).

---

## 8. Follow-up work

- Clear the 11 ESLint React Compiler warnings by restructuring `useApiData` (and the
  components that use it) so state updates happen in promise callbacks rather than
  synchronously inside effects.
- Give `DeviceToken` a self-expiring lifetime so a stale phone stops receiving pushes
  without needing a successful logout (B-07).
- Replace the in-memory rate limiter with a shared store, and key it on the platform's
  authoritative client IP (B-04).
