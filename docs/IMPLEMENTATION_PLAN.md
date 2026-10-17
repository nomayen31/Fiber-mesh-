# Lead Notification — Audit & Implementation Plan

> Status legend: **DONE** = implemented and verified · **PARTIAL** = implemented, not fully verified ·
> **BLOCKED** = needs an external credential/decision · **TODO** = not started.

---

## 1. Audit of the existing project

Everything below was read directly from the repository on 2026-10-18.

### 1.1 Framework and runtime

| Item | Actual value |
| --- | --- |
| Framework | **Next.js 15.5.28**, App Router, `src/` layout |
| React | 19 |
| Language | **TypeScript** (`strict: true`), plus one plain-JS file (`src/firebase.js`) |
| Styling | Tailwind CSS 3.4 with a custom `brand` / `accent` palette |
| Package manager | **npm** (npm 11.19.0, `package-lock.json`, Node 24.20.0) |
| Monorepo | **No** — single package at the repo root |
| Hosting | **Vercel** (`vercel.json`, `regions: ["sin1"]`, auto-deploy from GitHub `main`) |

### 1.2 Existing scripts

```
dev        next dev
build      prisma generate && next build
start      next start
typecheck  tsc --noEmit
db:push / db:migrate / db:deploy / db:seed / db:studio / db:reset
db:check   node --env-file=.env scripts/check-db.mjs
setup      prisma generate && prisma db push && prisma db seed
```

No linter and no test framework are configured. `next build` does not run ESLint
(no `eslint` dependency, no `eslint` config file), so adding a nested app cannot
break the production build through linting.

### 1.3 Backend routes

| Route | Methods | Auth |
| --- | --- | --- |
| `/api/orders` | POST | public, IP rate-limited, honeypot |
| `/api/inquiries` | POST | public, IP rate-limited, honeypot |
| `/api/products` | GET | public |
| `/api/admin/login` | POST | public, password + IP rate-limit |
| `/api/admin/logout` | POST | public (clears cookie) |
| `/api/admin/session` | GET, DELETE | reads cookie |
| `/api/admin/stats` | GET | `guardAdmin()` |
| `/api/admin/orders` | GET, POST | `guardAdmin()` |
| `/api/admin/orders/[id]` | PATCH, DELETE | `guardAdmin()` |
| `/api/admin/inquiries`, `/api/admin/inquiries/[id]` | GET / PATCH, DELETE | `guardAdmin()` |
| `/api/admin/export` | GET | `guardAdmin()` |

Every handler sets `export const runtime = "nodejs"` and `dynamic = "force-dynamic"`.

### 1.4 The exact order-confirmation event

This is the most important thing to get right, because it decides *when* a push fires.

1. The customer fills the modal and presses **"অর্ডার কনফার্ম করুন"**.
2. `POST /api/orders` validates with `orderCreateSchema` (Zod).
3. A filled honeypot field (`website`) returns a **fake success without saving** — no `Order`
   row exists.
4. `createWebsiteOrder()` (`src/lib/orders.ts`) resolves the product, computes pricing
   **server-side**, and inserts the row with `status: "PENDING"`, `source: "WEBSITE"`.
5. Any thrown error returns 500 — **no row**.

So the durable, unambiguous "this is a real confirmed lead" signal is:

> **an `Order` row was successfully persisted.**

`PENDING` in this schema is the *fulfilment* state (staff have not processed it yet),
**not** a customer-confirmation state. The customer has already confirmed by submitting.

Additional confirmed lead events found in the code:

| Event | Where | Meaning |
| --- | --- | --- |
| `order.created` | `createWebsiteOrder`, `createManualOrder` | a new order row exists |
| `order.confirmed` | `updateOrderStatus` → `CONFIRMED` | staff moved a row into CONFIRMED |
| `inquiry.created` | `createInquiry` | a new contact-form message exists |

Deliberately **not** notification-worthy: honeypot submissions, Zod failures, rate-limit
rejections, 500s, and duplicate replays of the same request.

### 1.5 Database

* **PostgreSQL** (Neon, project `soft-mode-07677475`, branch `production`).
* **Prisma 6.19.3** — `prisma/schema.prisma`, migrations in `prisma/migrations/`.
* Three migrations exist: `init`, `add_district_processing`, `add_product_images`.
* `datasource` uses `url = DATABASE_URL` (pooled/PgBouncer) and
  `directUrl = DATABASE_URL_UNPOOLED` (direct, for `migrate`).
* Models: `Product`, `SpecItem`, `Order`, `Inquiry`. Enums: `OrderStatus`, `OrderSource`.
* **There is no notification table, no device table and no outbox of any kind.**

### 1.6 Admin authentication and authorization

* Single shared admin identity — there is **no users table** and **no roles**.
* `ADMIN_PASSWORD` compared with a constant-time helper (`safeEqual`).
* On success a **JWT (HS256, `jose`)** is signed with `AUTH_SECRET`, subject `"admin"`,
  role `"admin"`, **8-hour** expiry, and stored in the `fm_admin_session` cookie
  (`httpOnly`, `sameSite: "lax"`, `secure` in production).
* `src/middleware.ts` protects `/admin/*` at the edge.
* `guardAdmin()` in `src/lib/api.ts` is the API-side gate — reads the cookie only.

**Consequence for mobile:** `auth.ts` reads the session **only from cookies**, and
`middleware.ts` only matches `/admin/*`. A React Native client cannot reliably persist an
`httpOnly` cookie and has no CSRF-protected origin, so a **bearer-token extension of the
existing JWT** is the smallest secure addition. No new auth system, no new secret — the
same signed token, read from `Authorization: Bearer` when no cookie is present.

### 1.7 Existing admin dashboard (the design to reproduce)

| Item | Value |
| --- | --- |
| Shell | `AdminShell.tsx` — dark `bg-slate-900` sidebar, brand-active item, rose logout, light `bg-slate-100` content |
| Nav | ওভারভিউ ও অ্যানালিটিক্স · অর্ডার ম্যানেজমেন্ট · গ্রাহকের মেসেজ |
| Cards | `StatCard.tsx` — `rounded-2xl border-slate-200 bg-white p-4 shadow-card`, 8×8 tinted icon chip, `text-2xl font-bold` value |
| Badges | `StatusBadge` — pill, `text-[11px] font-semibold`, per-status amber/sky/orange/violet/emerald/rose |
| Brand | `brand.600 #2574eb`, `brand.700 #1d5dd8`, `accent.500 #f79009`, `slate` neutrals |
| Shadow | `card: 0 1px 2px rgb(16 24 40/.04), 0 1px 3px rgb(16 24 40/.08)` |
| Font | `Hind Siliguri` first, then Inter / Noto Sans Bengali / system |
| Theme | Light only — no dark mode |
| Views | `DashboardView`, `OrdersView`, `InquiriesView`, `LoginForm`, `ManualOrderForm`, `Charts` |

### 1.8 Realtime

None. No WebSocket, no SSE, no polling. `DashboardView` loads once on mount and on demand
via the "রিফ্রেশ" button. **Push notifications are therefore the only realtime channel.**

### 1.9 Deployment and runtime limitations

* Vercel serverless functions, region `sin1`, **Node.js runtime** (all routes already declare it).
* No long-lived process → **no in-process queue worker is possible**.
* `after()` (`next/server`, stable in Next 15) is usable for post-response work inside the
  same invocation, but a serverless function can be frozen the moment the response is
  flushed, so `after()` alone is **not** a durability guarantee.
* `vercel.json` currently has **no `crons` array**. Vercel's Hobby plan restricts cron
  frequency (daily), so adding a frequent cron could break the production deploy — it is
  therefore left out and documented as an opt-in.

### 1.10 Missing configuration (nothing invented — these genuinely do not exist)

| Needed for | Variable / file | Present? |
| --- | --- | --- |
| Server-side FCM send | Firebase Admin service account | **No** |
| Android FCM token | `apps/lead-notify/google-services.json` | **No** |
| Retry trigger | `CRON_SECRET` | **No** |
| Client analytics | `NEXT_PUBLIC_FIREBASE_*` (7) | **Yes**, already configured |

The Firebase **project** already exists (the client config is configured and Analytics is
live), so the Android app only needs to be registered inside that same project.

### 1.11 Risks identified

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | A push failure could roll back or fail a paid order | Notification work runs **after** the row is committed, inside `try/catch`; response contract unchanged |
| R2 | Vercel can freeze the function before push delivery finishes | DB **outbox** + idempotency key + a retry endpoint; inline send is a best-effort fast path |
| R3 | Duplicate requests → duplicate pushes | `NotificationJob.eventKey` is `@unique` |
| R4 | A leaked APK extracts the admin password | Credentials are **never** bundled; the app only posts the password the user types, and stores the resulting token in `SecureStore` |
| R5 | A 30-day mobile token widens the blast radius of a lost phone | Token expiry is env-configurable; logout unregisters the device immediately |
| R6 | Root `tsc` would typecheck `apps/**` and fail | Add `"apps"` to `tsconfig.json` `exclude` |
| R7 | Nested app could be uploaded to Vercel | Nested `node_modules`, `.expo`, `android/`, `*.apk`, `google-services.json` are gitignored |
| R8 | Notifying on every status change spams the phone | Event list is env-controlled (`NOTIFY_EVENTS`) |
| R9 | `firebase-admin` pulled into a client bundle | Imported only from `src/lib/notifications/*`, which is imported only by `runtime = "nodejs"` route handlers |
| R10 | Production database polluted by tests | Integration tests create rows with a `NOTIFYTEST` marker and delete every row they created in a `finally` block |

---

## 2. Implementation plan

### Phase 2 — Backend

1. `npm i firebase-admin` → `14.5.0`.
2. Prisma: add `DeviceToken`, `NotificationJob`, `NotificationDelivery`, enums `DevicePlatform`
   and `DeliveryStatus`; add the `notifications` back-relation on `Order`. One additive
   migration — no drops, no resets.
3. `src/lib/notifications/firebase-admin.ts` — lazy, cached Admin app. Returns `null` when
   unconfigured instead of throwing. Supports a base64 JSON blob **or** three discrete vars.
4. `src/lib/notifications/sender.ts` — `PushSender` interface + `firebaseSender` (multicast,
   high priority, Android channel `orders_high`). Error mapping for
   `messaging/registration-token-not-registered` → deactivate the device.
5. `src/lib/notifications/dispatch.ts` — `enqueueOrderNotification()`,
   `enqueueInquiryNotification()`, `dispatchJob()`, `dispatchPendingJobs()`. Fully
   dependency-injected so tests can drive it without a network or a database.
6. `src/lib/notifications/payload.ts` — pure builder for title/body/data + the idempotency key.
   No customer PII in the payload beyond what a notification must show.
7. Routes: `/api/admin/devices` (GET/POST/DELETE), `/api/admin/mobile/login`,
   `/api/cron/notifications`.
8. Wire the real handlers: `/api/orders`, `/api/admin/orders`, `/api/admin/orders/[id]`,
   `/api/inquiries`. Response contracts unchanged.

### Phase 3 — Android app

* Location: **`apps/lead-notify/`**, standalone Expo project (no npm workspaces, so the
  root install and the Vercel build are untouched).
* Expo SDK 58 / React Native 0.88 / expo-router.
* Auth: bearer token in `expo-secure-store`.
* Design: port of the web dashboard tokens — dark header, white `rounded-2xl` cards,
  brand blue, the same Bengali status labels and colours.
* Screens: login, dashboard, orders list, order detail, messages, settings/device, plus
  loading / empty / error / unauthorized states.
* Notifications: channel created before use, foreground handler, background/tap handler,
  deep link to the order detail screen, token refresh re-registration.

### Phase 4 — Build config

`app.json` (package `com.fibermesh.leadnotify`, `expo-notifications` plugin), `eas.json`
(`preview` profile with `buildType: "apk"`), `.env.example`, Firebase/keystore gitignore rules.

### Phase 5 — Testing

* `node --test` unit tests for the pure payload/idempotency logic and the dispatcher with
  a stub sender.
* An integration script against the real Neon database that exercises device registration,
  the outbox, idempotency and invalid-token deactivation, and removes every row it created.
* Root `tsc --noEmit`, `next build`, `expo config` validation.

### Phase 6 — Docs

`docs/IMPLEMENTATION_PLAN.md` (this file), `FIREBASE_SETUP.md`, `MOBILE_APP_SETUP.md`,
`API_INTEGRATION.md`, `TESTING_CHECKLIST.md`, `APK_BUILD_AND_INSTALL.md`, `.env.example`.

### Known external dependencies (cannot be resolved from the repository)

| # | Dependency | Blocks |
| --- | --- | --- |
| D1 | Firebase Admin **service account JSON** | only real push delivery — everything else works without it |
| D2 | `google-services.json` for `com.fibermesh.leadnotify` | the APK obtaining an FCM token |
| D3 | Expo account login for `eas build` | producing the APK artifact |
| D4 | `CRON_SECRET` on Vercel + a scheduler | automatic retry of failed pushes |
