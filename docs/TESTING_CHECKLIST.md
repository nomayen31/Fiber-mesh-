# Testing checklist

Two parts: what is **already verified by automated tests**, and what only
**you** can verify by hand because it needs a real phone and a real Firebase
project.

> **Status at the time of writing (18 Oct 2026).** Part 1 is green except for one
> deliberate failure in the production smoke test — see the note under
> §"Production smoke test". **Nothing in Part 2 has been performed.** No
> real-device result is claimed anywhere in these docs, including for the
> notification flow, which is the whole point of Part 2.

---

## Part 1 — automated (already passing)

Run from the repository root.

### Unit tests — no database, no network

```powershell
npm test
```

**79/79 pass, 18 suites.** Five files:

**`tests/notifications.test.ts`** — the pipeline against an in-memory
`NotificationStore` and a stub sender:

- payload builders — Bengali titles, the order-number summary line, and that
  **no customer PII** (`customerName`, `phone`, `address`) is ever put into a push
- `eventKeyFor()` idempotency-key construction
- the enqueue → dispatch → resolve lifecycle
- duplicate enqueue returns `null` and sends nothing
- a job with no active device resolves to `SKIPPED` with `lastError = "no-active-device"`
- a device that already reached `SENT` is never sent to twice
- dead-token classification: `registration-token-not-registered` and
  `invalid-registration-token` deactivate; **`invalid-argument` does not**
- `attempts < MAX_JOB_ATTEMPTS` gating, and that `listRetryableJobIds()` offers
  `PENDING`/`FAILED` jobs but never `SENT` ones
- a `deactivateDevice` that throws does not lose the other devices' results
- `NOTIFY_EVENTS` parsing, including the `none` kill switch and unknown values
- **orphaned-job recovery.** A job left in `PROCESSING` by an instance that was
  reclaimed mid-send is picked up again once it is older than
  `STALE_PROCESSING_MS`; a *fresh* `PROCESSING` job is left alone so a live
  dispatch is never raced. Before this, such a job was stranded forever.

**`tests/manual-order.test.ts`** — the app's manual-order payload and the admin
endpoint guards:

- `adminOrderSchema` accepts exactly the payload the Android form builds
- `source` defaults to `MANUAL`; `status` is whatever the form chose
- `+880…`, `880…`, `01711-223344` and `01711 223 344` all normalise to `01711223344`
- a non-Bangladeshi mobile, a bad district, a fractional price, `quantity: 0`,
  `quantity: 10001` and over-long free text are all rejected
- `priceFor()` bulk tiers at 4/5/9/10/24/25 units, integer rounding, quantity flooring
- `POST /api/admin/orders`, `POST /api/admin/notifications/test` and
  `GET /api/admin/meta` each return **401 without a session**
- a **forged** bearer token is rejected and does **not** fall back to a cookie
- anonymous error bodies contain no Firebase key material

**`tests/firebase-config.test.ts`** — the regression suite for the credential bug:

- a genuine **snake_case** service-account file (`project_id`, `client_email`,
  `private_key`) parses — this is the case that was broken
- camelCase still works
- escaped `\n` and real newlines in `private_key` both normalise to a PEM block
- the parsed parts are handed to the **real** `firebase-admin` `cert()` +
  `getMessaging()` and the app initialises
- `isPushConfigured()` is **`true`** with a well-formed credential

A throwaway RSA key generated in-process is used throughout — no real credential
is read, written or logged.

**`tests/firebase-config-broken.test.ts`** — the diagnostic half, own process
because the config is cached:

- a credential that is *present but unusable* reports `pushConfigured: false`
- `missingPushEnvKeys()` is **empty** (the variable exists) — which is exactly why
  that field alone was misleading
- `pushConfigIssue()` returns `{ code: "missing-fields", detail: "missing: private_key" }`
  and contains no credential material

**`tests/sanitize.test.ts`** — the credential scrubber:

- PEM blocks, JSON `private_key` fields, JWTs, `Bearer`/`Basic` credentials,
  `AIza…` keys, credential-bearing `postgres://` URLs and long base64 runs
  (service-account blobs, FCM tokens) are all removed
- ordinary Bengali and English text is untouched
- output is single-line and clamped to 400 characters
- a Prisma-style error that quotes a device token does not leak it

### Integration tests — against the real database

```powershell
npm run test:integration          # 24/24 pass
npm run test:integration:manual   # 18/18 pass
```

**`tests/integration.notifications.ts` (24 checks)** exercises the actual Prisma
store and schema:

1. order creation produces exactly one job
2. a duplicate enqueue is rejected by the `eventKey` unique index — count stays 1
3. the job starts `PENDING` and records its event type
4. the persisted `payload` carries **no customer PII**
5. the body references the order number
6. delivery reaches `SENT`, contacting every active device
7. a `SENT` delivery row exists **per** device
8. a second dispatch reports `alreadyDone` and attempts no extra push
9. a dead token is deactivated while the good token stays active
10. notification work **never mutates the order** (status and total unchanged)
11. delivered jobs are not offered for retry
12. **cleanup:** every test row is deleted — no leftover order, device or job

**`tests/integration.manual-order.ts` (18 checks)** covers the path the Android
app uses end to end:

1. with `unitPrice: 0` and a slug, the **server** fills the price and product name
   from the database — the phone cannot invent either
2. the 5-unit bulk tier is applied server-side
3. the stored row says `source = MANUAL` and `status = PENDING`
4. the catalogue product is linked (`productId`)
5. a manual order **queues a notification like any other order**, and the job
   reaches `SENT` against a stub sender
6. the push references the order number and carries **no phone number**
7. the submitted customer name and normalised phone round-trip, and
   `subtotal = unitPrice × quantity`
8. **cleanup:** the test order, its device and its cascaded job are all gone, and
   the real customer order `FM-20261018-0001` is confirmed untouched

> These tests run against the real production branch of the Neon database. They
> are marker-scoped (`NOTIFYTEST-…` / `MANUALTEST-…` identifiers) and delete
> exactly what they created in a `finally` block. Both runs confirm *"no test
> order left behind / no test device left behind / no test job left behind"*.
>
> They are written to tolerate a **real phone being registered** (one is), so the
> assertions are scoped to the devices the test itself created.

### Type safety, lint and build

| Command | Where | Result |
|---|---|---|
| `npx tsc --noEmit` | repository root | passes |
| `npm run build` | repository root | passes; all **25** routes compile |
| `npx tsc --noEmit` | `apps/lead-notify/` | passes |
| `npx eslint .` | `apps/lead-notify/` | **0 errors**, 11 warnings |
| `npx expo-doctor` | `apps/lead-notify/` | **20/20 checks pass** |
| `npx expo config --type public` | `apps/lead-notify/` | resolves cleanly |

`expo lint` was not configured before this pass. It now is, and the 11 remaining
warnings are React Compiler advisories (`set-state-in-effect`,
`preserve-manual-memoization`, `refs`) that predate this work — the reasons are
recorded in `apps/lead-notify/eslint.config.js`, and clearing them needs a
data-fetching refactor (tracked in `docs/SECURITY_AUDIT.md`, §8).

### Production smoke test (opt-in, hits the live deployment)

```powershell
npm run verify:push
```

`scripts/verify-push.mjs` checks the **deployed** backend over the network against
the real database — the parts unit and integration tests cannot reach:

- the app login issues a Bearer JWT, a wrong password is `401`, and **no cookie**
  is set
- an **invalid bearer is `401`** and never silently falls back to a cookie session
- the browser cookie session still works (the bearer change did not break it)
- `GET /api/admin/devices` reports push state, lists missing keys as **names
  only**, and defaults to `order.created` + `inquiry.created`
- **push is either working or explicitly explained** — the check that would have
  caught the 18 October outage
- any reported config issue names **fields only**, never a value
- device registration returns a **masked preview** and never the full token
- deactivation (the logout path) flips `isActive` to `false` rather than deleting
- placing a real order commits **exactly one** `NotificationJob`, keyed
  `order.created:<orderId>`
- **no customer name, phone or address appears** anywhere in the job's title,
  body or payload
- the job reaches a **terminal** status (`SENT` / `SKIPPED` / `FAILED`) rather
  than sitting `PENDING` or `PROCESSING`
- a job that cannot be delivered is `SKIPPED`, never `FAILED`
- `GET /api/admin/orders/:id` returns the order with the same ISO date shape as
  the list endpoint, and `404` (not `500`) for a missing one
- the public order response does **not** leak the internal id
- `/api/cron/notifications` refuses an unauthenticated call
- the genuine customer order is still present
- **cleanup:** the test order, its cascaded job and the test device are all removed

It is self-cleaning and fails loudly if anything is left behind.

> **It currently reports 52 passed, 1 failed — and that failure is real.** Against
> today's live deployment, `pushConfigured` is `false`, `missingServerKeys` is
> empty, and there is no `pushConfigIssue`, so the new check *"push is either
> working or explicitly explained"* fails. That is precisely the state described
> in `docs/SECURITY_AUDIT.md` finding **A-01**, which the undeployed fix resolves.
> Expect **53/53** once the fix is deployed.

> Point it at a deployment deliberately — it is never part of `npm test`. When
> targeting a deployed environment, `ADMIN_PASSWORD` must be **that
> deployment's** password, not your local `.env` value:
>
> ```powershell
> $env:ADMIN_PASSWORD = "the-deployment-password"; npm run verify:push
> ```

### Regression checks (nothing existing was broken)

- The manual-order feature **reuses** `POST /api/admin/orders`; no second order
  endpoint, table or pricing implementation was added.
- `GET /api/admin/orders/:id` is additive; `PATCH` and `DELETE` on that path are
  unchanged.
- `guardAdmin(request?)` keeps cookie authentication working for every admin
  route — the bearer branch only activates when an `Authorization` header is
  present.
- `POST /api/admin/login`, `/api/admin/logout` and the website dashboard are
  unchanged.
- `GET /api/admin/devices` gained `pushConfigIssue`, which is **additive**; the
  existing fields keep their names and shapes.
- `listRetryableJobIds()` now also returns *stale* `PROCESSING` jobs. `PENDING`
  and `FAILED` behaviour is unchanged, and a live `PROCESSING` job is still left
  alone.
- Every API route now logs through `logError()`. Status codes, response bodies and
  `console` call sites are otherwise unchanged.
- The three notification tables and the migration are additive; no existing table
  or column was altered.

---

## Part 2 — manual verification

Only these need a human. Work through them in order; each step depends on the one
before it.

### 2.1 Prerequisites done

- [ ] `google-services.json` exists at `apps/lead-notify/google-services.json`
      and its `package_name` is exactly `com.fibermesh.leadnotify`
- [ ] The same file is uploaded to EAS as the file-type variable
      `GOOGLE_SERVICES_JSON` (`npx eas-cli@latest env:list --environment preview`)
      — without it a cloud build has no Firebase config
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` is set in Vercel **and the project has been
      redeployed since** — a running deployment does not pick up a new variable
- [ ] `GET /api/admin/devices` now reports `pushConfigured: true` (see §1)
- [ ] `AUTH_SECRET` is set for the environment you are deploying to — the app
      refuses to sign an admin session without it when `NODE_ENV=production`
- [ ] `NOTIFY_EVENTS` is unset, or explicitly
      `order.created,inquiry.created`
- [ ] `CRON_SECRET` is set (optional, enables the retry endpoint)

### 2.2 The APK builds and installs

- [ ] `npx eas-cli@latest build --platform android --profile preview` completes
- [ ] The APK installs on a real phone
- [ ] The app opens to the login screen with no red error screen

### 2.3 Login and registration

- [ ] Wrong password → *"পাসওয়ার্ড ভুল হয়েছে"*, and no crash
- [ ] Wrong password 11× in 15 minutes → *"অনেকবার ভুল চেষ্টা"* (rate limit works)
- [ ] Correct password → the overview appears
- [ ] Android's notification permission prompt appears on first login
- [ ] **Allow** it
- [ ] Settings → **এই ফোনে নোটিফিকেশন** is green: *"চালু আছে"*
- [ ] Settings → **সার্ভারের অবস্থা** is green (push credentials configured)
- [ ] Settings → **নিবন্ধিত ফোন** lists this phone as **সক্রিয়**
- [ ] Kill and reopen the app → it stays logged in (the token persisted)

### 2.3b The test-notification button (do this **before** §2.4)

The fastest way to prove the server can reach this phone, without creating any
order.

- [ ] Settings → **টেস্ট নোটিফিকেশন** card → tap the button
- [ ] A notification arrives saying **নোটিফিকেশন টেস্ট সফল হয়েছে** (or equivalent)
- [ ] The result line beneath the button shows the Bengali wording for *sent*
- [ ] Tap it **6 times within 10 minutes** → the 6th is refused with a rate-limit
      message, not an error screen
- [ ] Go to `/admin` → the order list is **unchanged** (the test creates no order,
      no notification job and no delivery row)
- [ ] If push is misconfigured, this card shows the reason instead: *"…সেট করা নেই"*
      plus the missing variable names, or *"…আছে, কিন্তু সেটি ব্যবহার করা যাচ্ছে না"*
      plus the `pushConfigIssue` code

### 2.4 A push actually arrives — the core test

Do each of these three with a **fresh** order, checking the phone each time.
Tap **Allow** on any battery-optimisation prompt Android shows.

- [ ] **Foreground** — app open on the overview → banner appears, and the
      overview's numbers refresh by themselves
- [ ] **Background** — app open, then press Home → notification appears in the
      shade with sound and vibration
- [ ] **Terminated** — swipe the app away from recents, wait a few seconds, then
      place the order → notification still arrives

All three matter. The server sends a notification message with
`android.priority: "high"` and an explicit `android.notification.channelId`, so a
background or terminated delivery should be displayed normally by the system — but
only a real phone proves it.

### 2.5 Notification content and privacy

- [ ] The title reads **"নতুন অর্ডার এসেছে"**
- [ ] The body is `orderNo • product × quantity • ৳total`
- [ ] The customer's **name, phone and address are NOT visible** in the
      notification (they appear only after tapping)
- [ ] Bengali renders as proper conjuncts — no broken matras, no letters spaced
      apart, nothing uppercased

### 2.6 Tapping through — from every app state

- [ ] Foreground tap → opens that exact order
- [ ] Background tap → opens that exact order
- [ ] **Terminated tap (cold start)** → opens that exact order, *not* the login
      screen and not the overview
- [ ] On the detail screen the customer name, phone, district, address, quantity,
      unit price, subtotal, discount and total all match the website's `/admin`
- [ ] Back button/gesture returns to the list sensibly

### 2.7 Order detail actions

- [ ] **কল করুন** opens the dialler with the customer's number
- [ ] **হোয়াটসঅ্যাপ** opens WhatsApp on the right number (with the `880` country
      code — a number without it will silently fail)
- [ ] **কপি** copies the phone number and the button briefly says *"কপি হয়েছে"*
- [ ] Changing the status updates it and it survives a pull-to-refresh
- [ ] If `order.confirmed` is enabled and you set an order to CONFIRMED, a push
      arrives; if it is disabled, none does *(both are correct)*

### 2.7b Manual order creation from the phone

This is the flow added for entering a phone lead by hand.

- [ ] Orders tab (and the overview) show a **"ম্যানুয়াল অর্ডার যোগ করুন"** button
- [ ] Tapping it opens the form; the **product picker** lists the live catalogue
      with server prices (not a hardcoded list)
- [ ] The **district picker** lists all 64 districts with Bengali names
- [ ] Picking a product fills the price field automatically
- [ ] Type a quantity of **10** → the preview shows the 5% bulk discount and the
      recalculated total
- [ ] Type a quantity of **25** → the preview shows 10%
- [ ] Untick the bulk-discount switch → the preview returns to the plain subtotal
- [ ] Enter a **wrong phone** (e.g. `01211223344`) → the form refuses it with a
      Bengali message; nothing is submitted
- [ ] Leave the name empty → same
- [ ] Tap **সংরক্ষণ করুন** twice quickly → only **one** order is created (the
      button disables while the request is in flight)
- [ ] On success the app navigates to the **new order's detail screen** and shows a
      success banner
- [ ] The new order's **total on the detail screen** equals the number in
      `/admin`, and equals the server's `unitPrice × quantity` with bulk discount
      — the phone's preview was only a preview
- [ ] The new order appears in `/admin/orders` with source **MANUAL**
- [ ] Its status is **PENDING** (not `COMPLETED`)
- [ ] **A notification arrives for it** — the manual path queues `order.created`
      exactly like the website
- [ ] Submit the same customer twice → two separate orders (there is no dedupe,
      and that is intended)

### 2.8 The other screens

- [ ] Overview: all stat tiles show plausible numbers matching `/admin`
- [ ] Overview: both bar charts render, with the range chips switching ৭/৩০/৯০ দিন
- [ ] Orders: search by name, then by phone, then by order number
- [ ] Orders: each status filter returns only that status
- [ ] Orders: scroll to the bottom → the next page loads, no duplicates
- [ ] Orders: pull-to-refresh shows the spinner and updates the timestamp
- [ ] Messages: unread rows are highlighted; opening one marks it read, and it
      stays read after a refresh
- [ ] Messages: **পড়া হয়নি** filter works

### 2.9 Inquiry notifications

- [ ] Submit the website contact form → **"নতুন গ্রাহক মেসেজ"** arrives
- [ ] Tapping it opens the Messages tab

### 2.10 Idempotency (no double buzz)

- [ ] Place one order → exactly **one** notification, not two
- [ ] Restart the app, place another order → still exactly one each
- [ ] Create a manual order from the phone → exactly **one** notification, not one
      from the phone and one from the server

### 2.11 Logout actually stops the notifications

- [ ] Settings → **লগআউট করুন** → returns to the login screen
- [ ] Settings (server-side) shows this phone as **নিষ্ক্রিয়**
- [ ] Place an order → **no** notification arrives on this phone
- [ ] Log in again → the phone is **সক্রিয়** again and pushes resume

### 2.12 Session expiry behaviour

- [ ] Temporarily set `MOBILE_SESSION_MAX_AGE_SECONDS=120` in Vercel, redeploy,
      log in, and wait 3 minutes
- [ ] Any screen shows *"সেশনের মেয়াদ শেষ হয়েছে"* and returns to login — no
      crash, no stuck spinner
- [ ] Restore the variable to its default (or delete it) and redeploy

### 2.13 Resilience

- [ ] Turn on airplane mode → screens show *"সার্ভারে সংযোগ করা যায়নি"* with a
      retry control, **not** a raw error or a permanent spinner
- [ ] Turn airplane mode off → pull-to-refresh recovers
- [ ] Revoke notification permission in Android settings, reopen the app →
      Settings reports *"অনুমতি দেওয়া হয়নি"* and explains how to fix it
- [ ] While offline, open the manual-order form → it either uses the bundled
      fallback data or reports clearly that it cannot load the catalogue; it must
      **not** silently submit a stale price

### 2.14 The website still works

- [ ] The public site loads and both product carousels work
- [ ] Placing a website order succeeds and shows the confirmation
- [ ] `/admin/login` still works in the browser (cookie auth not broken)
- [ ] `/admin` shows the new order
- [ ] `/admin/orders` and `/admin/inquiries` list and filter correctly
- [ ] Changing a status in the browser works
- [ ] CSV export still downloads

---

## What is *not* covered by the automated tests

Worth stating explicitly rather than implying otherwise:

- **FCM delivery itself.** No automated test sends a real push — that needs
  Firebase credentials and a registered device. Sections 2.4–2.6 are the
  verification, and they have **not** been run yet.
- **The React Native UI.** There is no component-test or E2E suite. It is
  type-checked, linted and rendered on a device, nothing more.
- **Emulator behaviour.** Push needs a real device with Google Play services.
- **Long-run token rotation.** FCM rotates registration tokens occasionally;
  `addPushTokenListener` re-registers automatically, but that path is hard to
  force on demand. It is exercised by the code path only.
- **Play Protect / manufacturer battery managers.** Some Android skins
  (Xiaomi, Huawei, Oppo) aggressively kill background apps. If terminated-state
  notifications are unreliable on one specific phone, disable battery
  optimisation for the app in its settings and retest before suspecting the code.
- **An instance being reclaimed mid-dispatch.** The recovery path for an orphaned
  `PROCESSING` job is unit-tested with a simulated stale timestamp; it has not
  been reproduced against a real serverless freeze.
