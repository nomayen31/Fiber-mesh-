# Testing checklist

Two parts: what is **already verified by automated tests**, and what only
**you** can verify by hand because it needs a real phone and a real Firebase
project.

---

## Part 1 — automated (already passing)

Run from the repository root.

### Unit tests — no database, no network

```powershell
npm test
```

**26/26 pass.** Covers `tests/notifications.test.ts` against an in-memory
`NotificationStore` and a stub sender:

- payload builders — Bengali titles, the order-number summary line, and that
  **no customer PII** (`customerName`, `phone`, `address`) is ever put into a
  push
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

### Integration tests — against the real database

```powershell
npm run test:integration
```

**24/24 pass.** `tests/integration.notifications.ts` exercises the actual Prisma
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

> These tests run against the real production branch of the Neon database. They
> are marker-scoped (`NOTIFYTEST-…` identifiers) and delete exactly what they
> created in a `finally` block, and the run above confirms *"no test order left
> behind / no test device left behind / no test job left behind"*.
>
> Your genuine test order `FM-20261018-0001` is never touched by them.

### Type safety and build

| Command | Where | Result |
|---|---|---|
| `npx tsc --noEmit` | repository root | passes |
| `npm run build` | repository root | passes; all 23 routes compile |
| `npx tsc --noEmit` | `apps/lead-notify/` | passes |
| `npx expo-doctor` | `apps/lead-notify/` | **20/20 checks pass** |
| `npx expo config --type public` | `apps/lead-notify/` | resolves cleanly |

### Production smoke test (opt-in, hits the live deployment)

```powershell
npm run verify:push
```

`scripts/verify-push.mjs` checks the **deployed** backend over the network against
the real database — the parts unit and integration tests cannot reach. It waits
for the new routes to go live, then verifies:

- the app login issues a Bearer JWT, and a wrong password is `401`
- the app login sets **no cookie**
- an **invalid bearer is `401`** and never silently falls back to a cookie session
- the browser cookie session still works (the bearer change did not break it)
- `GET /api/admin/devices` reports push state as a boolean, lists missing keys as
  **names only**, and defaults to `order.created` + `inquiry.created`
- device registration returns a **masked preview** and never the full token
- deactivation (the logout path) flips `isActive` to `false` rather than deleting
- placing a real order commits **exactly one** `NotificationJob`, keyed
  `order.created:<orderId>`
- **no customer name, phone or address appears** anywhere in the job's title,
  body or payload
- the job settles out of `PENDING` rather than hanging
- with no Firebase credentials it degrades to `SKIPPED`, never `FAILED`
- `GET /api/admin/orders/:id` returns the order, with the same ISO date shape as
  the list endpoint, and `404` (not `500`) for a missing one
- the public order response does **not** leak the internal id
- `/api/cron/notifications` refuses an unauthenticated call
- the genuine customer order is still present

It is self-cleaning: the test order is deleted through the admin API (which
cascades its job), the test device row is removed, and it fails loudly if
anything is left behind.

> Point it at a deployment deliberately — it is never part of `npm test`. When
> targeting a deployed environment, `ADMIN_PASSWORD` must be **that
> deployment's** password, not your local `.env` value:
>
> ```powershell
> $env:ADMIN_PASSWORD = "the-deployment-password"; npm run verify:push
> ```

### Regression checks (nothing existing was broken)

- `GET /api/admin/orders/:id` is **new**; `PATCH` and `DELETE` on that path are
  unchanged and still return their original shapes.
- `guardAdmin(request?)` keeps cookie authentication working for all six admin
  routes — the browser path is untouched. The bearer branch only activates when
  an `Authorization` header is present.
- `POST /api/admin/login` and the website's `/admin` dashboard are unchanged.
- The three new tables are additive; no existing table or column was altered.
- `.vercelignore` and the root `tsconfig.json` `exclude` keep `apps/` out of the
  web build entirely.

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
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` is set in Vercel, and the project was
      redeployed afterwards
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
`android.priority: "high"` so this should hold, but only a real phone proves it.

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

- **FCM delivery itself.** No test can send a real push — that needs Firebase
  credentials and a registered device. Sections 2.4–2.6 are the verification.
- **The React Native UI.** There is no component-test or E2E suite. It is
  type-checked and rendered on a device, nothing more.
- **Emulator behaviour.** Push needs a real device with Google Play services.
- **Long-run token rotation.** FCM rotates registration tokens occasionally;
  `addPushTokenListener` re-registers automatically, but that path is hard to
  force on demand. It is exercised by the code path only.
- **Play Protect / manufacturer battery managers.** Some Android skins
  (Xiaomi, Huawei, Oppo) aggressively kill background apps. If terminated-state
  notifications are unreliable on one specific phone, disable battery
  optimisation for the app in its settings and retest before suspecting the code.
