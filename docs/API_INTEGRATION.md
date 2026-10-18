# API integration reference

Everything the Android app talks to, plus the notification pipeline the backend
runs. **No new database and no parallel order store** were introduced: the app
reads and writes the same `Order` and `Inquiry` tables the website uses.

---

## 1. Authentication

The app uses the **same signed admin JWT** the website issues. Only the transport
differs.

| | Website | Android app |
|---|---|---|
| Endpoint | `POST /api/admin/login` | `POST /api/admin/mobile/login` |
| Where the token goes | `Set-Cookie` (`httpOnly`) | `Authorization: Bearer <token>` |
| Where it is kept | browser cookie jar | `expo-secure-store` → Android Keystore |
| Lifetime | 12 hours | `MOBILE_SESSION_MAX_AGE_SECONDS`, default 30 days, capped at 90 |

Both endpoints check the **same password** against the **same `ADMIN_PASSWORD`**
and sign with the **same `AUTH_SECRET`**, so a token from either is valid on every
admin endpoint. Rate limits use separate buckets (`login:<ip>` vs
`mobile-login:<ip>`) so a burst of app logins cannot lock the browser out, or
vice versa.

### Why the token is returned in the JSON body

A native client has no ambient cookie jar, so there is nothing for CSRF to
exploit and a cookie would buy nothing. Returning it in the body is safe here
because the endpoint sets **no CORS headers**, so a browser on another origin
cannot read the response — a cross-origin `fetch` is blocked by the browser
itself. The endpoint never sets a cookie, so a browser cannot accidentally pick
up a session from it either.

### How the bearer token is validated

`guardAdmin(request?)` in `src/lib/api.ts` is used by every admin route:

```
if an Authorization header is present → it is authoritative
     invalid/malformed bearer  → 401, no fallback to the cookie
     absent                    → fall back to the cookie (browser path)
```

An invalid bearer is **never** silently downgraded to the cookie session. That
matters because it makes a broken app token fail loudly instead of appearing to
work for the wrong reason.

---

## 2. Endpoints the app calls

### `POST /api/admin/mobile/login` — sign in

```jsonc
// request
{ "password": "…" }

// 200
{ "ok": true, "token": "<JWT>", "tokenType": "Bearer", "expiresIn": 2592000 }

// 401  → wrong password
{ "error": "পাসওয়ার্ড ভুল হয়েছে।" }

// 429  → too many attempts (10 per 15 minutes per IP)
{ "error": "অনেকবার ভুল চেষ্টা। 300 সেকেন্ড পরে আবার চেষ্টা করুন।" }

// 500  → ADMIN_PASSWORD not configured on the server
{ "error": "সার্ভারে ADMIN_PASSWORD সেট করা হয়নি।" }
```

The failure message is identical to the website's — it never hints at which part
was wrong.

### `GET /api/admin/stats?range=7d|30d|90d` — dashboard

```
{ cards, series, statusBreakdown, sourceBreakdown, topProducts, recentOrders, … }
```

`range` accepts only `7d`, `30d`, `90d`; anything else falls back to `7d`. The
app renders `cards` as stat tiles and `series` as two bar charts (revenue and
orders).

### `GET /api/admin/orders` — order list

| Query | Notes |
|---|---|
| `page` | 1-based |
| `pageSize` | 1–100; the app uses 15 |
| `status` | one of the six statuses, or `ALL` |
| `source` | `WEBSITE` \| `PHONE` \| `MANUAL` \| `ALL` |
| `q` | free text, max 80 chars — matches name, phone, order number, product |
| `from`, `to` | date filters (used by the web export, unused by the app) |

Returns `orders`, `total`, `page`, `pageSize`, `totalPages`, and the
filter-aware `filteredRevenue` / `filteredRolls` that the list header shows.

### `GET /api/admin/orders/:id` — one order *(added for the app)*

```jsonc
// 200
{ "ok": true, "order": { "id": "…", "orderNo": "FM-20261018-0001", … } }

// 404
{ "error": "অর্ডার পাওয়া যায়নি।" }
```

This endpoint is purely additive — `PATCH` and `DELETE` on the same path are
untouched. The web dashboard never needed it because it renders rows straight from
the list response; the app needs it because a notification carries only an order id
and the detail screen must fetch the rest.

`getOrderById()` hydrates dates to ISO strings exactly like `listOrders()` does,
so both clients receive the identical shape and there is no second serialisation
format to keep in sync.

### `POST /api/admin/orders` — one order, entered by hand

**This endpoint already existed for the web dashboard.** The Android app's manual
order screen calls it; no second order endpoint and no second order table was
created, so pricing, validation and the notification pipeline are shared.

```jsonc
// request — the app sends the price the *server* quoted from GET /api/admin/meta
{
  "customerName": "…", "phone": "01711223344", "district": "Feni",
  "address": "…", "productSlug": "big-roll", "unitPrice": 2500,
  "quantity": 5, "applyBulkDiscount": true,
  "status": "PENDING", "source": "MANUAL", "note": ""
}

// 201
{ "ok": true, "order": { "id": "…", "orderNo": "FM-20261018-0005", "total": 36750, … } }
```

- `createManualOrder()` **recomputes** subtotal, discount and total from
  `unitPrice × quantity` plus the bulk tiers. The client's arithmetic is a preview;
  the server's result is authoritative and is what gets stored.
- `unitPrice: 0` with a valid `productSlug` means *"use the catalogue price"*, which
  is resolved from the database.
- `productName` is snapshotted at creation time, so a later catalogue rename does
  not rewrite history.
- `source` defaults to `MANUAL`; `status` defaults to `COMPLETED` on the web form,
  while the app sends `PENDING` explicitly because a hand-entered lead is usually
  not yet confirmed.
- A successful create queues an `order.created` job — the same path the website
  uses, so a manual order notifies exactly like a customer order.
- `tests/manual-order.test.ts` and `tests/integration.manual-order.ts` cover the
  payload, the server-side pricing, and the queue → `SENT` path.

### `PATCH /api/admin/orders/:id` — change status

```jsonc
// request
{ "status": "CONFIRMED" }

// 200
{ "ok": true, "order": { "id": "…", "orderNo": "…", "status": "CONFIRMED" } }

// 422 → not one of the six statuses
{ "error": "স্ট্যাটাস সঠিক নয়।", "fields": { "status": "…" } }
```

**This is the endpoint that can notify you.** A genuine transition *into*
`CONFIRMED` (not a no-op re-save) enqueues an `order.confirmed` job — but that
event is **off by default**, because the person tapping the status is the person
who would be buzzed. See §4.

### `GET /api/admin/inquiries` — customer messages

`page`, `pageSize` (1–100), `q` (max 80 chars), `unread=1` to filter. The app
renders these in the Messages tab and toggles read state optimistically.

### `PATCH /api/admin/inquiries/:id`

```jsonc
{ "isRead": true }
```

### Device registration

**`POST /api/admin/devices`** — register or refresh this phone's FCM token.

```jsonc
// request
{ "token": "<FCM token>", "platform": "ANDROID", "label": "Pixel 7 · Android 15" }

// 200
{ "ok": true, "device": { "id": "…", "tokenPreview": "••••a1b2c3", … } }
```

- `adminId` is taken from the **verified session**, never from the body, so a
  caller cannot register a device against someone else's account.
- Rate limited to 30 registrations per 10 minutes per admin — token refresh
  happens on app start, not in a loop.
- Re-registering the same token **revives** a previously deactivated row, so a
  re-login after a logout just works. The row is never deleted, which keeps the
  history intact.
- If the token already belongs to a different `adminId`, the request is rejected
  with 409 rather than silently transferred.
- `tokenPreview` is the only thing ever echoed back: the last six characters
  prefixed with `••••`. The full token is never returned to any client.

**`GET /api/admin/devices`** — this is the diagnostics endpoint, and the app's
Settings tab is built on it.

```jsonc
{
  "ok": true,
  "devices": [ { "id", "platform", "label", "isActive", "lastSeenAt", "tokenPreview" } ],
  "pushConfigured": true,
  "missingServerKeys": [],
  "pushConfigIssue": null,
  "enabledEvents": ["order.created", "inquiry.created"]
}
```

`missingServerKeys` lists **variable names only** — never a value. It is what lets
the app say *"the server is missing FIREBASE_PRIVATE_KEY"* instead of leaving you
to guess why nothing arrives.

`pushConfigIssue` is the companion field, and it exists because `missingServerKeys`
alone could give a **false all-clear**: it is empty whenever the variable is present,
even if the value is unusable. That was a real outage — see
`docs/SECURITY_AUDIT.md`, finding A-01.

```jsonc
// null when push works; otherwise a fixed code plus field NAMES only
"pushConfigIssue": { "code": "missing-fields", "detail": "missing: private_key" }
```

| `code` | Meaning |
|---|---|
| `no-credentials` | Nothing is set — the same case `missingServerKeys` reports. |
| `invalid-json` | Neither JSON nor base64-encoded JSON. |
| `missing-fields` | Valid JSON, a required field is absent; `detail` names it. |
| `invalid-private-key` | `private_key` is not a PEM block. |
| `init-failed` | The Admin SDK rejected the credential. |

### `POST /api/admin/notifications/test` — send a test push to your own phone

Added for the app's Settings tab and useful for support. Requires a session.

```jsonc
// request — the body is optional
{ "deviceId": "…" }        // used only as an extra filter

// 200
{
  "ok": true,
  "pushConfigured": true,
  "results": [ { "deviceId": "…", "tokenPreview": "••••a1b2c3",
                 "outcome": "sent" | "invalid-token" | "failed" | "skipped" } ]
}

// 503 — the server has no usable credential
{ "error": "…(Bengali explanation)…", "pushConfigured": false,
  "missingServerKeys": [], "pushConfigIssue": { … } }
```

- The target is resolved from the **verified session** (`session.sub`) only. An
  attacker cannot use it to push to someone else's device, and `deviceId` narrows
  the selection rather than choosing it.
- Rate limited to **5 attempts per 10 minutes per session**.
- The payload is **fixed and PII-free** — no order, no customer data.
- It creates **no `NotificationJob`**, so a test cannot pollute the real delivery
  history or the retry queue.
- The response contains only sanitized outcome codes; a dead token is deactivated
  immediately.

### `GET /api/admin/meta` — reference data for the manual-order form

Added so the phone never hardcodes the catalogue or the district list.

```jsonc
{
  "ok": true,
  "districts": [ { "value": "Feni", "label": "ফেনী", "division": "Chattogram",
                   "delivery": 100 } ],
  "products":  [ { "slug": "big-roll", "name": "বিগ রোল (Big Roll) — ৫০ × ১ মিটার",
                   "nameEn": "Big Roll", "gsm": 50, "price": 2500, "unit": "রোল" } ]
}
```

`price` is **the server's price**. The manual-order form sends that value back, so
the server can recompute the order from the same number the admin saw, and the
client-side total is a preview only. Only active products are returned.

**`DELETE /api/admin/devices?id=<id>` or `?token=<fcm token>`**

Deactivates (`isActive = false`) rather than deleting, and always answers
`{ "ok": true }` — even for an unknown device — so the response cannot be used to
probe which tokens exist. The app calls this on logout with `?token=`, which is
why it stores its own FCM token (in SecureStore, alongside the session).

### `GET|POST /api/cron/notifications` — outbox retry

Not called by the app.

- Auth: `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron sends) or
  `?secret=<CRON_SECRET>` (any other scheduler). Compared in constant time.
- With `CRON_SECRET` unset the endpoint returns **503, disabled** — it is never
  an anonymous "notify everyone" button.
- `?limit=1..100`, default 25.

The normal path sends inline right after the order is saved. This endpoint exists
for the cases where a serverless function was frozen before delivery finished, or
FCM was briefly unavailable. It is **opt-in**: no `crons` entry was added to
`vercel.json`, because Hobby-plan cron limits could break the deployment. A
failed job also retries on its own the next time any order is placed, since
dispatch first sweeps pending jobs.

---

## 3. What is in a push payload

The server sends a **notification message** with `android.priority: "high"`, so
the same push is delivered whether the app is in the foreground, in the
background, or closed.

```jsonc
// order.created
{
  "notification": {
    "title": "নতুন অর্ডার এসেছে",
    "body": "FM-20261018-0001 • বিগ রোল (Big Roll) — ৫০ × ১ মিটার × 5 • ৳37,500"
  },
  "data": {
    "type": "order.created",
    "entity": "order",
    "orderId": "clx…",
    "orderNo": "FM-20261018-0001",
    "screen": "order",
    "sourceLabel": "ওয়েবসাইট",   // present when known
    "district": "ফেনী"            // present when known
  }
}
```

```jsonc
// inquiry.created
{
  "notification": {
    "title": "নতুন গ্রাহক মেসেজ",
    "body": "মেশের দাম জানতে চাই"
  },
  "data": { "type": "inquiry.created", "entity": "inquiry", "inquiryId": "clx…", "screen": "inquiry" }
}
```

### Privacy rule — this is a hard constraint

A push is rendered on a **locked phone screen**, so the title and body carry only
a safe order reference: order number, product, quantity, total. **Customer name,
phone number and delivery address are never placed in a push.** The app fetches
those from the authenticated API after the tap. Treat every push payload as
public.

Every `data` value is a **string** — FCM requires it, and non-string values are
dropped.

### How the app handles a tap

| App state | Mechanism |
|---|---|
| Foreground | `addNotificationReceivedListener` → the list auto-refreshes; Android also shows the banner, because a `setNotificationHandler` is installed (without one, a foreground push would be silently swallowed). |
| Background | Tapping fires `addNotificationResponseReceivedListener`. |
| Closed / killed | Tapping launches the app; `getLastNotificationResponse()` is read once, after the stored session has been restored, then `clearLastNotificationResponse()` consumes it. |

Routing: `entity: "order"` + `orderId` → `/order/[id]`. The response is
de-duplicated by a stable key, so a cold-start tap is not handled twice (once by
the launch read and again by the listener).

The cold-start read deliberately waits for the session to be restored. Navigating
before that would hit the auth guard and bounce straight back to the login
screen — the order would appear to open and then vanish.

---

## 4. Notification events and defaults

| Event | Fires when | Default |
|---|---|---|
| `order.created` | an `Order` row is **successfully persisted** | **on** |
| `inquiry.created` | an `Inquiry` row is **successfully persisted** | **on** |
| `order.confirmed` | an order transitions into `CONFIRMED` | **off** |

Control it with one variable:

```bash
# default behaviour (may be omitted entirely)
NOTIFY_EVENTS=order.created,inquiry.created

# also buzz on every confirmation
NOTIFY_EVENTS=order.created,order.confirmed,inquiry.created

# kill switch — nothing is ever pushed
NOTIFY_EVENTS=none
```

### Two decisions worth understanding

**"Order confirmed" means "the order row was saved", not "the status is
CONFIRMED".** `PENDING` is a *fulfilment* state — it means "not yet processed",
not "not yet a real order". A customer submitting the website form has already
placed an order, and that is the moment worth a push. This is also the only
definition that is structurally sound: the honeypot rejection, Zod validation
failures, rate-limit rejections and 500 paths never persist a row, so they can
never fire a notification. The event is derived from a durable fact.

**`order.confirmed` is off by default** because it fires when a *staff member*
moves a row to CONFIRMED — an action performed inside the admin dashboard. Pushing
it would buzz the same admin's phone with an echo of their own tap. It is
implemented and one env var away if you want it (for example if a second person
handles shipping and should be told when an order is confirmed).

---

## 5. Delivery guarantees

The pipeline is an **outbox**: a `NotificationJob` row is committed *inside* the
same request that saved the order, then delivery is attempted inline via
`after()` from `next/server`. So a persisted order can never lose its
notification because a send failed.

| Guarantee | Mechanism |
|---|---|
| **No duplicate push for one event** | `NotificationJob.eventKey` is `@unique`, valued `"<eventType>:<entityId>"`. Re-processing the same confirmation returns `null` and sends nothing. |
| **No duplicate push to one device** | `NotificationDelivery` is `@@unique([jobId, deviceTokenId])`. A device whose delivery already reached `SENT` is never sent to again. |
| **Retry after transport failure** | Any unresolved transport failure marks the job `FAILED`, which is retryable — by the next dispatch, or by `/api/cron/notifications`. |
| **A dead token is a resolved failure** | If the *only* problem was a dead token, the device is deactivated and the job resolves to `SENT` — the failure was handled, so retrying is pointless. |
| **A bad payload never unregisters a phone** | Only `messaging/registration-token-not-registered` and `messaging/invalid-registration-token` deactivate a device. `messaging/invalid-argument` is treated as retryable, so a malformed payload cannot cost you a working phone. |
| **An unconfigured server degrades quietly** | No Firebase credentials → callers get `null`, deliveries are recorded `SKIPPED`, jobs are still written. The website never errors. |
| **A failed notification never fails an order** | Dispatch is scheduled with `after()`, so it runs after the response. The customer always gets their order confirmation. |

### A log line you will see and should ignore

```
Unique constraint failed on the fields: (`eventKey`)
```

This printed during dispatch is **expected** — it *is* the idempotency guard
doing its job on a duplicate enqueue. It is deliberately kept rather than replaced
by a pre-check `SELECT` on every order, because that would add a query to the hot
path of every single order to make a rare log line prettier.

---

## 6. Data model added for notifications

Purely additive migration `prisma/migrations/20261017200821_add_push_notifications`.
Nothing existing was altered or dropped.

| Table | Purpose |
|---|---|
| `DeviceToken` | one row per registered phone: `token` (unique), `adminId`, `platform`, `label`, `isActive`, `lastSeenAt` |
| `NotificationJob` | one row per notification event: `eventKey` (unique), `eventType`, `title`, `body`, `payload`, `status`, `attempts`, `sentCount`, `failedCount`, `lastError` |
| `NotificationDelivery` | one row per (job, device): `status`, `error`, `messageId`; unique on `[jobId, deviceTokenId]` |

`Order.notifications` links jobs back to the order they came from.

---

## 7. Error handling in the app

| HTTP | App behaviour |
|---|---|
| `401` | Any authenticated call signing out clears the session and returns to login with *"সেশনের মেয়াদ শেষ হয়েছে"*. Centralised in `SessionProvider.request()`, so no screen has to remember. |
| `403` / `404` | Surfaced inline on the affected screen. A deleted order shows *"এই অর্ডারটি পাওয়া যায়নি"*. |
| `422` | The server's `fields` map is available for form-level display. |
| `429` | The Bengali retry message from the server is shown verbatim. |
| Network failure / timeout | Translated to *"সার্ভারে সংযোগ করা যায়নি"* or *"সার্ভার সময়মতো উত্তর দেয়নি"* (15s timeout), with a retry control. The app never shows a raw fetch error or an HTTP status code to the user. |

---

## 8. Environment variables

### Server (Vercel) — new in this change

| Name | Required | Default | Purpose |
|---|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | for push | — | full service-account JSON, raw or base64. **Preferred.** Accepts the snake_case keys Firebase writes (`project_id`, `client_email`, `private_key`) and camelCase. |
| `FIREBASE_PROJECT_ID` | alternative | — | used only if the blob above is absent; all three are then required |
| `FIREBASE_CLIENT_EMAIL` | alternative | — | ditto |
| `FIREBASE_PRIVATE_KEY` | alternative | — | ditto; literal `\n` and real newlines are both accepted |
| `CRON_SECRET` | optional | — | enables `/api/cron/notifications`; unset ⇒ 503 |
| `NOTIFY_EVENTS` | optional | `order.created,inquiry.created` | `none` disables everything |
| `MOBILE_SESSION_MAX_AGE_SECONDS` | optional | `2592000` (30 days) | app token lifetime, clamped to 90 days |
| `AUTH_SECRET` | **required in production** | dev fallback | signs the admin session. In production the app refuses to sign or verify a session if this is unset, still the built-in development fallback, or shorter than 32 characters. |

Every one of these is optional in the sense that the website runs fine without
it — push simply stays disabled and says so.

### App (build time)

| Name | Purpose |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | backend base URL, no trailing slash |
| `EXPO_PUBLIC_ENV_LABEL` | shown on the Settings screen, e.g. `production` |

`EXPO_PUBLIC_*` values are inlined into the JS bundle at build time, so they must
never contain a secret. Neither of these two does — the app holds no server
credential of any kind, and receives its token from the login endpoint instead.
