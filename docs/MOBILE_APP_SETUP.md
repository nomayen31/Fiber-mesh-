# Mobile app — local development and structure

`apps/lead-notify/` is the Android lead-notification app: an Expo (React Native)
project that shows the existing admin dashboard data and receives a push whenever
a new order or customer message arrives.

It is a **standalone project**, not an npm workspace. It has its own
`package.json` and `node_modules`, and the root `tsconfig.json` excludes `apps/`.
Installing it cannot change the website's dependency tree, and the Next.js build
cannot see it. `.vercelignore` keeps it out of the deployment upload entirely.

---

## Running it locally

```powershell
cd "D:\fiber mesh website\apps\lead-notify"

# 1. dependencies (only needed once, or after package.json changes)
npm install

# 2. environment
Copy-Item .env.example .env

# 3. start the dev server
npx expo start
```

Then either:

- scan the QR code with **Expo Go** (fine for UI work), or
- press `a` to launch an Android emulator, or
- run it on a real phone via USB with `npx expo run:android` — **required for
  push notifications**, see below.

### `EXPO_PUBLIC_API_BASE_URL`

Set it in `apps/lead-notify/.env`:

| Where you are testing | Value |
|---|---|
| Against production | `https://fiber-mesh.vercel.app` |
| Against a local Next.js server, on a **real phone** | `http://<your-PC-LAN-IP>:3000` |
| Against a local Next.js server, on an emulator | `http://10.0.2.2:3000` |

`localhost` will not work on a physical phone — it resolves to the phone itself.
Find your PC's address with `ipconfig` (look for the IPv4 address of the Wi-Fi
adapter) and make sure the phone is on the same network.

Remember to restart the dev server after editing `.env`: `EXPO_PUBLIC_*` values
are inlined by Metro at bundle time, not read at runtime.

### Push notifications do not work in Expo Go

Expo Go is a fixed shell containing only its own bundled native modules, and
remote push (FCM) requires the Firebase SDK to be compiled into the app. So:

- **UI, navigation and API screens** → work in Expo Go.
- **Getting an FCM token / receiving a real push** → needs a development build
  (`npx expo run:android`, or `eas build --profile development`) or the production
  APK.

The Settings tab reports this honestly rather than failing silently: it shows
*"ডিভাইস থেকে FCM টোকেন পাওয়া যায়নি"* when it cannot get one.

---

## Project structure

```
apps/lead-notify/
├─ app.json                 Expo config: package name, icons, plugins, permissions
├─ app.config.js            extends app.json; only points googleServicesFile at
│                           the EAS file variable on a build runner
├─ eas.json                 Build profiles (preview → APK)
├─ .env.example             EXPO_PUBLIC_* template
├─ google-services.json     ← you add this (git-ignored) **and** upload it to EAS as
│                           the file variable GOOGLE_SERVICES_JSON. See FIREBASE_SETUP.md
├─ assets/images/           Icon, splash, adaptive-icon layers
├─ scripts/
│  └─ generate-icons.mjs    regenerates those icons from code
└─ src/
   ├─ app/                  ← every file here is a route (expo-router)
   │  ├─ _layout.tsx        root: providers + the auth guard
   │  ├─ index.tsx          sends you to the dashboard or the login screen
   │  ├─ login.tsx          password login
   │  ├─ (tabs)/
   │  │  ├─ _layout.tsx     the bottom tab bar
   │  │  ├─ dashboard.tsx   overview & analytics
   │  │  ├─ orders.tsx      order list, search, status filters, paging
   │  │  ├─ messages.tsx    customer inquiries, read/unread
   │  │  └─ settings.tsx    push status, device list, logout
   │  └─ order/[id].tsx     order detail — where a notification tap lands
   ├─ components/
   │  ├─ ui.tsx             Card, StatCard, StatusBadge, buttons, states
   │  ├─ BarChart.tsx       SVG bar chart (react-native-svg)
   │  └─ NotificationBridge.tsx  push lifecycle wiring
   ├─ lib/
   │  ├─ api.ts             fetch client with the bearer token
   │  ├─ session.tsx        auth context + secure token storage
   │  ├─ push.ts            channel, permission, FCM token, listeners
   │  ├─ format.ts          ৳ amounts, Dhaka-time dates, Bengali labels
   │  ├─ types.ts           response shapes
   │  └─ useApiData.ts      load/refresh/error hook
   └─ theme.ts              design tokens ported from the website
```

`src/app/` holds **only** routes. Anything reusable lives in `src/components` or
`src/lib`, which is what expo-router expects.

---

## How it relates to the website

The mobile app is deliberately thin. It re-implements no business logic:

| Concern | Where it lives |
|---|---|
| Order creation, pricing, validation | website (`src/lib/orders.ts`, `src/lib/validators.ts`) |
| Authentication and the admin session | website (`src/lib/auth.ts`, `src/lib/session.ts`) |
| Which events notify, retries, idempotency | website (`src/lib/notifications/*`) |
| Presentation and the push lifecycle | this app |

The app calls the **existing** endpoints. The only backend addition built for it
is `GET /api/admin/orders/:id`, which the web dashboard did not need — it renders
rows straight from the list endpoint. Everything else was already there.

The design tokens in `src/theme.ts` are copied from `tailwind.config.ts` and
`src/components/admin/*` rather than imported, because the two projects have
separate bundlers. If a brand colour changes, change it in both places.

### Two deliberate divergences from the web UI

1. **A bottom tab bar replaces the sidebar.** A desktop sidebar is not usable on
   a phone. Colours, typography, spacing, badges and the dark navy chrome
   (`slate-900`) are unchanged.
2. **A Settings tab exists that the website has no equivalent for.** It shows
   whether *this phone* is registered for push and whether the *server* has its
   Firebase credentials — the two questions you will actually have when a
   notification does not arrive.

---

## Bengali typography

Bengali is the primary language of this UI. One rule is enforced everywhere and
must not be broken by future edits:

> **Never apply `textTransform: uppercase` or `letterSpacing` to Bengali text.**

Bengali is a joined script with conjunct consonants and vowel matras positioned
above, below and around the base glyph. Letter-spacing pulls the matras away from
their consonants; uppercasing is meaningless for a script without case and in
practice corrupts rendering. There is no exception to this rule, including for
headings, labels and buttons.

Amounts use **Latin** digits (`৳7,500`) because that is what `formatBdt()` emits
on the website, so an order reads identically in both places.

---

## Useful commands

Run all of these from `apps/lead-notify/`:

```powershell
npx expo start                 # dev server
npm run typecheck              # tsc --noEmit
npx expo-doctor                # 20 dependency/config health checks
npx expo install --fix         # align dependency versions with SDK 58
npx expo config --type public   # print the resolved app config
npx expo prebuild --platform android --clean   # generate android/ locally to inspect
```

Add a dependency **only** through `npx expo install <package>` — never
`npm install <package>`. `expo install` picks the version that matches the
installed SDK; `npm install` picks the latest and will eventually break the build.

### Current verification status

| Check | Result |
|---|---|
| `npx tsc --noEmit` | passes, no errors |
| `npx expo-doctor` | 20/20 checks pass |
| `npx expo config` | resolves cleanly |
| Root `npx tsc --noEmit` | passes (the app is excluded) |
| Root `npm run build` | passes |
| Root `npm test` | 26/26 unit tests pass |

---

## Dependency notes

- `npx expo install` picked every native module version; do not hand-edit them.
- `lucide-react-native` + `react-native-svg` provide the icons. The website uses
  the web `lucide-react`; both are the same icon set, so the visual language
  matches.
- `react-native-reanimated` and `react-native-gesture-handler` are navigation
  peer dependencies and are not used directly.
- No custom font is bundled. Android ships **Noto Sans Bengali**, so Bengali text
  renders correctly with no extra asset — which also keeps the APK smaller.

### The app icons are generated, not hand-drawn

`assets/images/*.png` is produced by `scripts/generate-icons.mjs`:

```powershell
node scripts/generate-icons.mjs
```

It draws the product itself — a diamond lattice, which is what fiberglass
construction mesh is — in the site's brand blue, and writes all six files the
config references (legacy icon, the three adaptive-icon layers, splash, favicon).
It uses only Node's built-in `zlib`, so no image library was added for six static
files. Re-run it only when the design changes; the PNGs it writes are committed.

Two things worth knowing if you edit the design:

- The mark is kept inside the **central 62 %** of the adaptive-icon canvas, since
  a launcher masks that layer to a circle or squircle and can crop up to a third
  of it.
- The lattice is deliberately coarse. A denser weave looks better at 1024 px and
  turns to mush once the launcher downsamples the icon to 48 dp.

**The notification icon is a separate file on purpose.** Android draws the
status-bar icon as a **24 dp alpha mask** and tints it, so the lattice cannot
survive there — at 24 dp it renders as an indistinct hatch. `notification-icon.png`
is therefore the coarsest version of the same idea: a rounded panel with four
square openings, which still reads as woven mesh but has no feature small enough
to disappear. `app.json` points `plugins → expo-notifications → icon` at it while
the launcher icon keeps the full lattice.

That distinction is easy to lose: expo-notifications silently *accepts* any image
and downscales it, so pointing the plugin at the launcher icon produces a build
that succeeds and a status-bar icon that looks broken. If you change the
notification icon, run `npx expo prebuild --platform android --clean` and then
look at `android/app/src/main/res/drawable-xxxhdpi/notification_icon.png` (96 px)
to confirm it still reads.
