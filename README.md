# ফাইবার মেশ — Fiber Mesh

Bengali-language landing page + order system + admin dashboard for **fiberglass construction
mesh (ফাইবারগ্লাস মেশ)**.

Built with **Next.js 15 (App Router) + TypeScript + Tailwind CSS + Prisma + PostgreSQL (Neon)**,
mobile-first, fully in Bengali, with a password-protected admin area for orders, analytics and
CSV export.

Ships with a companion **Android lead-notification app** (`apps/lead-notify/`, Expo/React Native)
that mirrors the dashboard and sends a push notification to the shop phone the moment a new order
or customer message arrives — in the foreground, in the background, or with the app closed.

---

## What's included

### Public site (`/`)

| Section | Description |
| --- | --- |
| Header / navbar | Sticky nav, logo, phone CTA, mobile drawer |
| Hero | Bengali headline, hero banner image, delivery/COD badges, primary CTA |
| Promo banner | Full-width banner image, links to the catalogue |
| What is fiberglass mesh | Explainer with product illustration |
| Benefits | 8-card benefit grid |
| Where to use | Application wall / plaster / ceiling / waterproofing use cases |
| Concrete reinforcement | RCC/slab/floor highlight band with WhatsApp CTA |
| How to use | 7-step illustrated guide |
| Video | Self-hosted product video (`public/assets/fiber-mesh-video.mp4`) |
| Products | 4 product cards driven by the database, with photo, spec table + "অর্ডার করুন" CTA |
| Gallery | Recent Facebook posts, linking to the page |
| FAQ | Accessible accordion |
| About & contact | Business info, WhatsApp, Facebook, delivery/COD note, inquiry form |
| Footer + mobile call bar | Always-reachable phone/WA/order bar |
| Floating WhatsApp button | Bottom-right on every public page (`WhatsAppButton`) |

### Ordering

* Every "অর্ডার করুন" button opens a **popup modal** pre-filled with that product's name.
* Fields: নাম, মোবাইল নম্বর, **জেলা (64-district dropdown)**, ডেলিভারি ঠিকানা, রোল সংখ্যা, optional note.
* The modal shows a **product thumbnail + name + price** that updates as the dropdown changes, and
  the **delivery estimate** for the selected district.
* Price, bulk discount and delivery total are **computed on the server only** — the client
  cannot influence them.
* Bulk tiers: **5+ rolls → 2 %**, **10+ → 5 %**, **25+ → 10 %**.
* Order numbers are generated as `FM-YYYYMMDD-NNNN` (Dhaka time).
* A hidden honeypot field silently swallows bot submissions.
* Success state shows the order number, product and delivery estimate.

### Contact form

Name, phone, email, subject and message → stored in the `Inquiry` table, visible in the admin
dashboard.

### Admin dashboard (`/admin`)

* Password login → signed JWT in an **httpOnly** cookie (`ADMIN_PASSWORD` + `AUTH_SECRET`).
* Middleware guards every `/admin/*` page and every `/api/admin/*` route.
* **Dashboard** — analytics cards (আজকের অর্ডার, এ সপ্তাহে, এ মাসে, আজকের বিক্রয়, এ মাসের বিক্রয়,
  মোট ফর্ম সাবমিশন), status breakdown, top products by revenue and two charts (orders/day,
  revenue/day) rendered with Recharts, range switch (7 / 30 / 90 days).
* **Orders** — searchable, filterable, paginated table with inline status updates
  (PENDING → CONFIRMED → PROCESSING → SHIPPED → COMPLETED / CANCELLED) and **manual order entry**
  (phone / walk-in orders) that updates all totals and charts immediately.
* **Inquiries** — message list, mark read/unread.
* **CSV export** — orders or inquiries, UTF-8 **BOM** prefixed so Bengali renders correctly in
  Excel.

### Android lead-notification app (`apps/lead-notify/`)

A private Android app for the shop phone: the same dashboard in your pocket, plus a push
notification the moment a new order or message arrives.

* **Push on every new lead** — delivered whether the app is open, backgrounded or fully closed.
  Tapping the notification opens that exact order.
* **Same login** — the same admin password, and the same signed JWT as the website (presented as a
  bearer token instead of a cookie).
* **Overview** — the same stat tiles and revenue/order charts as the web dashboard, with a
  7 / 30 / 90 day range switch.
* **Orders** — search, status filters, infinite scroll, and status changes.
* **Order detail** — full customer and pricing breakdown, one-tap **call** / **WhatsApp** / **copy
  phone number**, and a status changer.
* **Messages** — customer inquiries with read/unread, marking read as you open them.
* **Settings** — whether *this phone* is registered for push, whether the *server* has its Firebase
  credentials, which phones are registered, and logout (which stops the pushes).
* Built with Expo SDK 58 / React Native, distributed as a sideloadable **APK** (not on the Play
  Store), and styled with the same brand colours and Bengali-only typography rules as the website.

See [`docs/MOBILE_APP_SETUP.md`](docs/MOBILE_APP_SETUP.md) and
[`docs/APK_BUILD_AND_INSTALL.md`](docs/APK_BUILD_AND_INSTALL.md).

### Push notifications (backend)

* An **outbox** pattern: a `NotificationJob` row is committed in the same request that saves the
  order, so a saved order can never lose its notification because a send failed.
* **Idempotent** — one row per `(event, entity)`, enforced by a unique index, so re-processing can
  never produce a second buzz.
* **Per-device de-duplication** — a device that already received a job is never sent to twice.
* **Retry** on transport failure, and **automatic deactivation** of dead FCM tokens.
* **No customer PII in a push** — only the order number, product, quantity and total. Name, phone
  and address are fetched from the authenticated API after a tap, because a notification is
  rendered on a locked screen.
* **Degrades quietly** — with no Firebase credentials the website, dashboard and app all work
  normally; deliveries are just recorded as `SKIPPED`.

See [`docs/API_INTEGRATION.md`](docs/API_INTEGRATION.md) and
[`docs/FIREBASE_SETUP.md`](docs/FIREBASE_SETUP.md).

---

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) | Audit of the existing codebase, the phased plan, risks, external dependencies |
| [`docs/FIREBASE_SETUP.md`](docs/FIREBASE_SETUP.md) | The two Firebase pieces (client config + admin key), verification, troubleshooting |
| [`docs/MOBILE_APP_SETUP.md`](docs/MOBILE_APP_SETUP.md) | Running the app locally, project structure, Bengali typography rule |
| [`docs/API_INTEGRATION.md`](docs/API_INTEGRATION.md) | Every endpoint, auth, push payloads, delivery guarantees, env vars |
| [`docs/APK_BUILD_AND_INSTALL.md`](docs/APK_BUILD_AND_INSTALL.md) | Building the APK with EAS, installing it, rebuilding |
| [`docs/TESTING_CHECKLIST.md`](docs/TESTING_CHECKLIST.md) | Automated results + the manual steps only a real phone can verify |

---

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15.5 (App Router, RSC, route handlers) |
| Language | TypeScript 5.7 (strict) |
| Styling | Tailwind CSS 3.4 with custom `brand` tokens in `tailwind.config.ts` |
| Fonts | Hind Siliguri (Bengali) + Inter (Latin) via Google Fonts `<link>` |
| Icons | lucide-react |
| Charts | Recharts 2 |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 6 (`@prisma/client`) |
| Auth | jose (HS256 JWT in httpOnly cookie) + Next middleware |
| Validation | zod on every write endpoint |
| Push | firebase-admin (FCM) + a Postgres outbox |
| Mobile app | Expo SDK 58 / React Native 0.88, expo-router, expo-notifications, expo-secure-store |

---

## Quick start

```bash
npm install
cp .env.example .env      # then fill it in (see below)
npm run db:deploy         # apply migrations (or `npm run db:push` for a quick sync)
npm run db:seed           # insert the product catalogue
npm run dev               # http://localhost:3000  ·  admin at /admin
```

Production:

```bash
npm run build
npm start
```

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | **Pooled** Postgres URL (Neon host contains `-pooler`). Used by the running app. |
| `DATABASE_URL_UNPOOLED` | ✅ | **Direct** Postgres URL. Used by Prisma Migrate / Studio / seed via `directUrl`. |
| `ADMIN_PASSWORD` | ✅ | Password for `/admin/login`. Change before deploying. |
| `AUTH_SECRET` | ✅ | ≥32-char secret used to sign the session cookie. |
| `NEXT_PUBLIC_SITE_URL` | – | Canonical URL, used for metadata. |
| `NEXT_PUBLIC_PHONE` | – | `tel:` target. |
| `NEXT_PUBLIC_PHONE_DISPLAY` | – | Human-readable phone shown on the page. |
| `NEXT_PUBLIC_WHATSAPP` | – | WhatsApp number, digits only (used to build `wa.me` links). |
| `NEXT_PUBLIC_EMAIL` | – | Contact email. Leave empty to hide the email row (the Facebook link is shown instead). |
| `NEXT_PUBLIC_FACEBOOK` | – | Facebook page URL (footer, contact card, gallery CTA). |
| `NEXT_PUBLIC_ADDRESS` | – | Business address shown in the footer / contact card. |
| `NEXT_PUBLIC_BUSINESS_HOURS` | – | Opening hours line. |
| `NEXT_PUBLIC_FIREBASE_*` | – | Firebase Analytics web config (7 vars, see below). Leave unset to disable analytics. |
| `NEON_BRANCH` | – | Written by the Neon CLI; informational. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | – | Full Firebase service-account JSON (raw or base64) for push. **Server-only.** Preferred over the three below. |
| `FIREBASE_PROJECT_ID` | – | Service-account alternative; all three required if the blob above is unset. |
| `FIREBASE_CLIENT_EMAIL` | – | Ditto. |
| `FIREBASE_PRIVATE_KEY` | – | Ditto. Keeps its literal `\n` sequences; the code converts them. |
| `NOTIFY_EVENTS` | – | Which events push, comma separated. Default `order.created,inquiry.created`. `none` is a kill switch. |
| `CRON_SECRET` | – | Enables `GET/POST /api/cron/notifications` (outbox retry). Unset ⇒ that route returns 503, never open. |
| `MOBILE_SESSION_MAX_AGE_SECONDS` | – | Android app token lifetime in seconds. Default 30 days, capped at 90. |

Every push variable is optional: with none of them set, the site, the dashboard and the app all work
normally and deliveries are simply recorded as `SKIPPED`. See
[docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).

Generate a production secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Firebase Analytics

`src/firebase.js` initialises Firebase and `src/components/analytics/FirebaseAnalytics.tsx` loads
the SDK **after hydration, only on public pages** (never in `/admin`). Analytics is optional: if the
variables are missing the site still works, and `getAnalytics()` is skipped on browsers that do not
support it.

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
```

> **Next.js, not Vite.** This is why the variables are `NEXT_PUBLIC_*` and not `VITE_*`. Only
> `NEXT_PUBLIC_` variables are inlined into the browser bundle by `next build`; `import.meta.env`
> does not exist in Next.js, and `VITE_*` variables would always be `undefined` at runtime.
> `NEXT_PUBLIC_*` values are baked in **at build time**, so redeploy after changing one.

The Firebase web config is public by design (it identifies the project, it does not authorise
anything). **Never** put Admin SDK service-account credentials in the frontend or in any `VITE_` /
`NEXT_PUBLIC_` variable.

### Self-hosting Postgres instead of Neon

Point both variables at the same server:

```env
DATABASE_URL="postgresql://fibermesh:fibermesh@localhost:5432/fibermesh?schema=public"
DATABASE_URL_UNPOOLED="postgresql://fibermesh:fibermesh@localhost:5432/fibermesh?schema=public"
```

`docker-compose.yml` is included for a local Postgres if you want one:

```bash
docker compose up -d
```

---

## Database

### Schema (`prisma/schema.prisma`)

| Model | Notes |
| --- | --- |
| `Product` | slug, Bengali + English name, tagline, description, `gsm` (optional), price (BDT), unit, badge, `imageUrl` (primary photo), `images[]` (carousel), `sortOrder`, `isActive`, specs |
| `SpecItem` | label/value rows belonging to a product, ordered by `sortOrder` |
| `Order` | `orderNo` (unique, `FM-YYYYMMDD-NNNN`), customer, phone, **district**, address, product ref, quantity, unitPrice, subtotal, discount, delivery, total, status, source, note, timestamps |
| `Inquiry` | contact-form submission with `isRead` flag |
| `DeviceToken` | one row per registered phone: unique `token`, `adminId`, `platform`, `label`, `isActive`, `lastSeenAt` |
| `NotificationJob` | one row per notification event: unique `eventKey` (`"<eventType>:<entityId>"`), `title`, `body`, `payload`, `status`, `attempts`, `sentCount`, `failedCount`, `lastError` |
| `NotificationDelivery` | one row per (job, device): `status`, `error`, `messageId`; unique on `[jobId, deviceTokenId]` |
| enums | `OrderStatus` (PENDING, CONFIRMED, PROCESSING, SHIPPED, COMPLETED, CANCELLED), `OrderSource` (WEBSITE, PHONE, MANUAL), `DevicePlatform` (ANDROID, IOS), `DeliveryStatus` (PENDING, SENT, FAILED, SKIPPED) |

### Delivery districts

`src/content/districts.ts` holds all **64 districts in 8 divisions**, each with a Bengali name and
the delivery estimate we quote (`২ দিন`, `পরের দিন`, `একই দিনে`, …). That single file feeds:

* the order modal's grouped `<select>` plus the live "আনুমানিক ডেলিভারি" line,
* the manual-order form in the admin dashboard,
* the district chip under the phone number in the orders table,
* the `District (জেলা)` column in the CSV export,
* Zod validation on `POST /api/orders` — an unknown district is rejected with a Bengali error.

The English district name is what gets stored in `Order.district`; every UI surface renders it in
Bengali via `districtLabel()`. Change a delivery time in one place and all of the above follow.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run db:check` | Smoke-test the connection and print table/row counts (no credentials shown). |
| `npm run db:migrate` | `prisma migrate dev` — create + apply a new migration (needs `DATABASE_URL_UNPOOLED`). |
| `npm run db:deploy` | `prisma migrate deploy` — apply pending migrations (CI / production). |
| `npm run db:push` | Push the schema without creating a migration file. |
| `npm run db:seed` | Upsert the 4-product catalogue from `src/content/products.ts`. Idempotent. |
| `npm run db:studio` | Prisma Studio. |
| `npm run db:reset` | Drop, re-migrate and re-seed. **Destructive.** |
| `npm test` | Unit tests for the notification pipeline (no DB, no network). |
| `npm run test:integration` | DB-backed notification checks against the real database. Self-cleaning. |

Products are read from the database, but if the table is empty or unreachable the site falls back
to the static catalogue in `src/content/products.ts`, so the page never renders blank.

### Pooled vs. direct connections

The app uses the **pooled** URL because PgBouncer (behind Neon's `-pooler` host) multiplexes
many serverless/short-lived connections onto few Postgres backends. Migrations, `prisma studio`
and `db push` use `directUrl` (`DATABASE_URL_UNPOOLED`) because PgBouncer's transaction pooling
breaks the session-level operations those tools need — the classic symptom is
`prepared statement "s0" already exists`.

Both are wired in `prisma/schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_UNPOOLED")
}
```

---

## Neon setup (already configured for this project)

The Neon CLI is installed and linked:

```bash
npm i -g neon@latest
neon login                                   # browser sign-in (once)
neon init -y --agent opencode \
  --org-id org-crimson-paper-64873142 \
  --project-id soft-mode-07677475 \
  --branch production \
  --services postgres
```

This created:

* `.neon` — link file (`orgId`, `projectId`, `branch`); git-ignored by the CLI.
* `neon.ts` — the Neon IaC config (`neon config plan` / `neon deploy`).
* `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH` written into `.env`.
* Neon agent skills for OpenCode (user level, `~/.agents/skills/neon*`) and the Neon MCP server
  in `~/.config/opencode/opencode.json`.

### Branch-first workflow

```bash
neon branches create --name feature-x     # or: neon checkout feature-x
neon checkout production                  # switch back
neon deploy                               # apply neon.ts to the linked branch
neon config plan                          # preview what deploy would change
neon env pull                             # refresh .env from the linked branch
neon diff                                 # schema diff between branches
```

Recommended loop for anything schema-related on production data:

1. `neon checkout` a branch off `production`.
2. Point `DATABASE_URL` at that branch (`neon env pull`).
3. `npm run db:migrate` — validated against real data, safely.
4. Merge/redeploy, then delete the branch: `neon branches delete <name>`.

---

## Project structure

```
prisma/
  schema.prisma              models + enums, pooled/direct datasource
  seed.ts                    idempotent catalogue seed
  migrations/                SQL migration history
scripts/
  check-db.mjs               npm run db:check
src/
  app/
    page.tsx                 landing page (server component, reads products)
    products/                catalogue + [slug] detail pages
    admin/
      login/                 password login (no sidebar — separate route group)
      (dashboard)/           guarded shell: dashboard, orders, inquiries
    api/
      products/              GET  public catalogue
      orders/                POST public order create
      inquiries/             POST contact form
      admin/                 login, logout, session, stats, orders, inquiries, export
    layout.tsx, globals.css, not-found.tsx
  components/
    landing/                 Header, Hero, WhatIs, Benefits, UseCases, HowTo,
                             ProductsSection, Faq, AboutContact, ContactForm,
                             Footer, MobileCallBar
    order/                   modal + context (open with a product pre-filled)
    products/                ProductCard, ProductOrderButton
    admin/                   AdminShell, DashboardView, Charts, OrdersView,
                             ManualOrderForm, InquiriesView, LoginForm, StatCard
    ui/                      Section, Icon
  content/
    site.ts                  ← all Bengali copy for the site lives here
    products.ts              seed catalogue + bulk-discount tiers
  lib/
    prisma.ts   singleton PrismaClient
    catalog.ts  DB read with static fallback + priceFor() discount tiers
    orders.ts   order creation/numbering/listing
    stats.ts    dashboard aggregations (Asia/Dhaka aware)
    csv.ts      BOM-prefixed CSV builder
    notifications/    push pipeline: config, payload, firebase-admin, sender,
                      store, dispatch, schedule
    auth.ts / session.ts / validators.ts / api.ts / utils.ts / types.ts
  middleware.ts              edge guard for /admin and /api/admin

apps/lead-notify/            standalone Expo/React Native Android app.
                             Own package.json + node_modules; excluded from the
                             root tsconfig and from Vercel uploads.
docs/                        FIREBASE_SETUP, MOBILE_APP_SETUP, API_INTEGRATION,
                             APK_BUILD_AND_INSTALL, TESTING_CHECKLIST,
                             IMPLEMENTATION_PLAN
tests/
  notifications.test.ts        unit tests            → npm test
  integration.notifications.ts DB-backed checks      → npm run test:integration
  helpers/                     in-memory store + stub sender
```

### Editing content

Nearly all visible text is in **`src/content/site.ts`** and the product line-up in
**`src/content/products.ts`**. Edit those, then re-run `npm run db:seed` if you changed products.

### Images & video

All media is served from **`public/assets/`** (Next.js can only serve static files from `public/`):

| File | Used in |
| --- | --- |
| `logo.jpg` | header, footer, admin login (`Logo` in `components/ui/Section.tsx`) |
| `hero-banner.jpg` | hero visual + video poster |
| `promo-banner.png` | full-width promo strip under the hero |
| `big-roll-1.jpg` … `big-roll-5.jpg` | **Big Roll** product carousel (cards, detail page, order modal) |
| `small-roll-1.jpg` … `small-roll-3.jpg` | **Small Roll** product carousel |
| `product-45gsm.jpg` … `product-160gsm.jpg` | retained from the previous catalogue — no longer referenced |
| `post-story.jpg`, `post-facebook.jpg` | "Facebook page" gallery section |
| `fiber-mesh-video.mp4` | video section (self-hosted, `preload="metadata"`) |

To swap an image, replace the file in `public/assets/` keeping the same name — no code change
needed. To add a product photo, put the file in `public/assets/`, add its path to `images[]` in
`src/content/products.ts`, then `npm run db:seed`. The **first** entry is also written to `imageUrl`
and used as the primary photo (order modal thumbnail, social previews).

The carousel itself is `src/components/products/ProductImageCarousel.tsx`: swipe on touch, arrows
and dots everywhere, optional thumbnail strip on the detail page. A product with a single photo
renders without controls.

Notes:

* Product photos are rendered with `object-contain` on a white card, so **no baked-in text or
  branding gets cropped**. Keep that in mind when producing new creatives (4:5 portrait works best).
* Next optimizes images on demand via `sharp` (already installed). The 2.2 MB
  `promo-banner.png` is served as compressed WebP/JPEG at the requested width.
* Replace the video and update `poster` in `site.video` if you produce a new one. Keep it under
  ~10 MB and use H.264 MP4 for the widest device support.

---

## API reference

### Public

| Method | Route | Body | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/products` | – | Catalogue with specs |
| `POST` | `/api/orders` | `customerName, phone, district, address, productSlug, quantity, note?` | `200` + order, `422` + field errors |
| `POST` | `/api/inquiries` | `name, phone, email?, subject?, message` | `200` |

### Admin (session cookie **or** `Authorization: Bearer` from the Android app)

| Method | Route | Notes |
| --- | --- | --- |
| `POST` | `/api/admin/login` | `{ password }` → sets cookie (website) |
| `POST` | `/api/admin/mobile/login` | `{ password }` → returns `{ token, tokenType, expiresIn }` (app) |
| `POST` | `/api/admin/logout` | clears cookie |
| `GET` | `/api/admin/session` | current auth state |
| `GET` | `/api/admin/stats?range=7d\|30d\|90d` | cards, series, breakdowns, top products |
| `GET` | `/api/admin/orders?q=&status=&source=&page=&pageSize=` | paginated list + filtered revenue |
| `POST` | `/api/admin/orders` | manual order (any `OrderSource`) |
| `GET` | `/api/admin/orders/:id` | one order (added for the app's detail screen) |
| `PATCH` | `/api/admin/orders/:id` | `{ status }` |
| `DELETE` | `/api/admin/orders/:id` | delete |
| `GET` | `/api/admin/inquiries?page=&pageSize=&q=&unread=1` | list |
| `PATCH` | `/api/admin/inquiries/:id` | `{ isRead }` |
| `GET` | `/api/admin/export?type=orders\|inquiries` | UTF-8 BOM CSV download |
| `GET` | `/api/admin/devices` | registered phones + `pushConfigured` + `missingServerKeys` |
| `POST` | `/api/admin/devices` | `{ token, platform, label? }` — register/refresh this phone |
| `DELETE` | `/api/admin/devices?id=\|?token=` | deactivate this phone's registration |

An `Authorization` header, when present, is authoritative: an invalid bearer is rejected with `401`
and never silently falls back to the cookie session.

### Ops

| Method | Route | Notes |
| --- | --- | --- |
| `GET` \| `POST` | `/api/cron/notifications?limit=1..100` | Retries undelivered pushes. Requires `CRON_SECRET` (bearer **or** `?secret=`); returns `503` when unset, so it is never an open "notify everyone" button. |

The normal delivery path is inline, right after the order is saved — this endpoint is opt-in for the
case where a serverless function was frozen before delivery finished.

---

## Deploying

### Vercel

This project is deployed to Vercel as **`fiber-mesh`** with the GitHub repository
`nomayen31/Fiber-mesh-` connected, so **every push to `main` deploys automatically**.

* Region: `sin1` (Singapore — lowest latency to Bangladesh), set in `vercel.json`.
* Build: `npm run build` (runs `prisma generate` first).
* Env vars set for Production: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ADMIN_PASSWORD`,
  `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PHONE`, `NEXT_PUBLIC_PHONE_DISPLAY`,
  `NEXT_PUBLIC_WHATSAPP`, `NEXT_PUBLIC_ADDRESS`, `NEXT_PUBLIC_FACEBOOK`,
  `NEXT_PUBLIC_BUSINESS_HOURS`, plus the seven `NEXT_PUBLIC_FIREBASE_*` Analytics values.
* For Android push, also set `FIREBASE_SERVICE_ACCOUNT_JSON` (and optionally `NOTIFY_EVENTS`,
  `CRON_SECRET`, `MOBILE_SESSION_MAX_AGE_SECONDS`), then redeploy. Without it everything still
  works — push is simply disabled and the app says so. See
  [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).
* The Android app is **not** built by Vercel. `apps/` is excluded from the deployment entirely via
  `.vercelignore`. Its APK is built separately with EAS — see
  [docs/APK_BUILD_AND_INSTALL.md](docs/APK_BUILD_AND_INSTALL.md).

Deploy from the CLI:

```bash
vercel link --project fiber-mesh     # once
vercel env pull .env.local           # optional, pulls non-secret vars
vercel --prod                        # build + promote to production
```

Notes:

* Use the **pooled** URL for `DATABASE_URL`. Serverless functions each open their own pool, so the
  production value carries `&connection_limit=1` — without it a traffic spike exhausts Postgres
  connections.
* Apply migrations from a local machine (or CI), not from the build step:
  `npm run db:deploy`. The build itself never touches the database.
* `next.config.mjs` sets SOC-style security headers (`X-Frame-Options`, `Referrer-Policy`,
  `X-Content-Type-Options`, `Permissions-Policy`) and allows remote images over HTTPS.
* All database-touching pages are `dynamic = "force-dynamic"`, so `next build` never needs a
  live database.
* `NEXT_PUBLIC_*` values are baked in at build time — after changing one, redeploy.

### Any Node host

```bash
npm ci
npm run db:deploy
npm run build
npm start          # PORT=3000 by default
```

---

## Security notes

* Admin sessions are HS256 JWTs in an `httpOnly`, `sameSite=lax` cookie (8 h expiry), signed with
  `AUTH_SECRET`; the middleware only verifies the signature (edge-safe, `jose`) and every admin
  route handler re-checks the session server-side.
* Prices, discounts and totals are always recomputed on the server.
* All write endpoints validate with zod and return Bengali field-level errors.
* A honeypot field silently absorbs bot submissions.
* The Android app uses the **same** HS256 JWT, presented as an `Authorization: Bearer` token
  instead of a cookie, and stores it in the Android Keystore via `expo-secure-store`. When an
  `Authorization` header is present it is authoritative — an invalid bearer returns `401` and never
  falls back to the cookie session.
* The Firebase Admin service account is server-only. It is read exclusively by
  `src/lib/notifications/firebase-admin.ts`, which throws if it is ever evaluated in a browser
  bundle, and the API only ever reports *which variable names are missing* — never a value.
* Push payloads contain **no customer PII**: just the order number, product, quantity and total.
  A notification is visible on a locked screen, so it is treated as public. Name, phone and address
  are fetched from the authenticated API after a tap.
* **Change `ADMIN_PASSWORD` and `AUTH_SECRET` before going live.**

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `prepared statement "s0" already exists` during a migration | You're migrating over the pooled URL. Make sure `DATABASE_URL_UNPOOLED` is set — `directUrl` routes Migrate around the pooler. |
| `Can't reach database server` | Check `npm run db:check`, that the Neon branch isn't suspended (first query wakes it), and that `sslmode=require` is present. |
| Bengali shows as mojibake in Excel | Open the exported CSV via Excel's *Data → From Text/CSV* with UTF-8 selected, or use Google Sheets. The file already carries a UTF-8 BOM. |
| Admin login loops back to `/admin/login` | `AUTH_SECRET` changed since the cookie was issued, or the cookie was blocked. Clear cookies and sign in again. |
| Site shows products you deleted from the DB | The static catalogue in `src/content/products.ts` is the fallback; re-check that the `Product` table actually has rows. |
| The app registers but no notification ever arrives | Check the app's **সেটিংস** tab first — it names the problem. Usually either `FIREBASE_SERVICE_ACCOUNT_JSON` is unset (`pushConfigured: false`), `NOTIFY_EVENTS=none`, or the notification type is switched off. |
| The **APK** build fails with a missing-file error | `apps/lead-notify/google-services.json` is required **at build time**. See [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) Part A. |
| Push works when the app is open but not when it is closed | The APK was built without the Firebase SDK — `google-services.json` must exist when EAS builds, not just when you run the app. |

---

## Sample data

The database currently holds the **2 real products** and **1 real customer order**
(`FM-20261018-0001`, placed through the live site while testing). **Do not delete
that order** — it is a genuine record, not test data.

The notification integration tests create their own marker-scoped rows
(`NOTIFYTEST-…`) and delete exactly what they created, so they never touch real
data. Both suites are safe to run at any time:

```bash
npm test                 # 26 unit tests, no database involved
npm run test:integration # 24 checks against the real database, self-cleaning
```

Inspect the tables directly with:

```bash
npm run db:studio        # open the Order / Inquiry tables
```
