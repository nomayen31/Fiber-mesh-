# Building and installing the APK

The app is `apps/lead-notify/`, an Expo (React Native) project. The APK is built
in the cloud with **EAS Build**, so no JDK, Android SDK or Android Studio is
needed on this machine.

> **Status.** Everything on the code side is configured and verified — the project
> typechecks, `expo-doctor` reports 20/20 checks passing, and a preview APK
> profile is ready. Two things must come from you before an APK can be produced,
> because both need your accounts:
>
> 1. **`google-services.json`** — see [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) Part A.
>    It has to exist *before* the build; `app.json` already points at it, so a
>    build without it fails with a clear "file not found" error rather than
>    silently producing an APK that can never receive a notification.
> 2. **An Expo account login** — `eas build` uploads the project to Expo's build
>    servers under your account.
>
> Follow the steps below in order and you will have an installable, push-enabled
> APK at the end.

---

## Step 0 — prerequisites

- Node.js (already present — v24.20.0 on this machine).
- An [Expo account](https://expo.dev/signup) — the free tier is enough. EAS
  gives every account a monthly allowance of Android builds.
- A real Android phone (Android 7.0 or newer).
- `apps/lead-notify/google-services.json` (FIREBASE_SETUP.md Part A).

---

## Step 1 — install the EAS CLI

```powershell
cd "D:\fiber mesh website\apps\lead-notify"
npx eas-cli@latest --version
```

Using `npx eas-cli@latest` avoids a global install, which is why the npm scripts
in `package.json` are written as plain `eas …` — run them as
`npx eas-cli@latest build …`, or install the CLI globally once
(`npm install -g eas-cli`) if you prefer the shorter command.

---

## Step 2 — log in and link the project

```powershell
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` creates the EAS project and writes `extra.eas.projectId` (and `owner`)
into `app.json`. Answer **yes** when it offers to create a project.

> `app.json` intentionally has no `extra.eas.projectId` yet — it cannot be set
> before an Expo account exists. `eas init` adds it. Commit the change it makes.

If the CLI asks whether to configure the Android build, say yes; it will detect
the existing `eas.json` and keep the `preview` profile.

---

## Step 3 — generate the Android signing keystore

EAS manages this for you on the first build:

- It asks *"Generate a new Android Keystore?"* → answer **yes**.
- It stores the keystore on Expo's servers and reuses it for every later build.
- **Do not lose access to your Expo account** — without it you cannot ship an
  update that Android will accept as an upgrade of the installed app.

If you would rather keep your own keystore, run
`npx eas-cli@latest credentials` and upload a `.jks` instead.

---

## Step 4 — build the APK

```powershell
cd "D:\fiber mesh website\apps\lead-notify"
npx eas-cli@latest build --platform android --profile preview
```

Equivalently, from the repo root:

```powershell
npm --prefix apps/lead-notify run build:apk
```

`--profile preview` is the profile in `eas.json` that produces an **APK** (not an
`.aab`) with `distribution: internal` — exactly what a private, sideloadable
build needs. It also bakes in:

```
EXPO_PUBLIC_API_BASE_URL = https://fiber-mesh.vercel.app
```

The build runs on Expo's servers in roughly 5–15 minutes. The CLI streams the
logs and prints a URL and a QR code when it finishes.

**`google-services.json` is required at this point.** If you skipped Step 0,
the build fails with a missing-file error. That is deliberate: an APK built
without it cannot obtain an FCM token, so it could never receive a lead.

---

## Step 5 — install on the phone

### Option A — direct download (simplest for one phone)

1. Open the build URL from the previous step in the phone's browser.
2. Tap **Install**.
3. Android will ask permission to install from this source — allow it, then
   confirm.

### Option B — QR code

The CLI prints a QR code; scan it with the phone's camera and tap the link.

### Option C — USB / adb, if you have it

```powershell
npx eas-cli@latest build:run --platform android --profile preview
```

### Option D — hand the file to someone else

Download the `.apk` from the build page and send it to them (WhatsApp, Drive,
etc.). Android will warn that it is from an unknown source the first time; that
warning is expected for any app not installed from the Play Store.

---

## Step 6 — first run

1. Open **Fiber Mesh Lead**.
2. Enter the admin password — the **same password as the website's `/admin/login`**.
3. Android asks *"Allow Fiber Mesh Lead to send you notifications?"* → **Allow**.
   This prompt is essential; without it nothing can be delivered.
4. The app opens on the overview. Go to the **সেটিংস** tab and confirm:
   - **এই ফোনে নোটিফিকেশন** shows *"চালু আছে"*.
   - **সার্ভারের অবস্থা** is green (*push credentials configured*).
   - The phone appears in the **নিবন্ধিত ফোন** list.
5. Place a test order on the website and confirm the notification arrives.

If a card is amber or red, it names the exact problem. See
[TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md).

---

## Rebuilding after a code change

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Each build produces a new APK. Installing it over the previous version works
because the package name and signing key are unchanged, so the app's stored
session and settings survive the upgrade.

The version number shown in Android's app info comes from `expo.android.versionCode`
in `app.json`. Bump both `version` and `versionCode` before distributing a build
you intend to support over time:

```json
"version": "1.0.1",
"android": { "versionCode": 2 }
```

---

## Production profile

`eas.json` also defines a `production` profile — same APK output, plus a
`channel` for over-the-air updates. Use it for the build you keep as the
long-term install:

```powershell
npx eas-cli@latest build --platform android --profile production
```

Do not use `eas submit` — this app is deliberately not published to the Play
Store.

---

## Why the app is not on the Play Store

It is an internal staff tool: one admin password, an order dashboard, and lead
pushes. Google Play would require a public listing, a privacy policy, a content
rating and a review cycle, none of which adds value here. A directly distributed
APK is the right shape for a handful of company phones.

Two consequences worth knowing:

- **No automatic updates.** New builds must be reinstalled. (The `production`
  profile's OTA channel can push JS-only changes without reinstalling, but that
  is opt-in and not set up here.)
- **Play Protect** may show a "scan this app?" prompt on first install. That is
  normal for sideloaded software.

---

## Configuration reference

### `eas.json`

| Profile | Output | Distribution | Points at |
|---|---|---|---|
| `development` | APK + dev client | internal | your machine (set `EXPO_PUBLIC_API_BASE_URL` yourself) |
| `preview` | **APK** | internal | `https://fiber-mesh.vercel.app` |
| `production` | APK | internal | `https://fiber-mesh.vercel.app` |

### `app.json` — the parts that must not drift

| Field | Value | Why it matters |
|---|---|---|
| `android.package` | `com.fibermesh.leadnotify` | Must match `package_name` in `google-services.json`. A mismatch means zero notifications, with no error on the phone. |
| `android.googleServicesFile` | `./google-services.json` | Firebase client config. |
| `plugins → expo-notifications → defaultChannel` | `orders_high` | Must match `ANDROID_CHANNEL_ID` in `src/lib/notifications/config.ts` **and** `ANDROID_CHANNEL_ID` in `src/lib/push.ts`. |
| `plugins → expo-notifications → color` | `#2574eb` | Brand blue, same as the website. |
| `userInterfaceStyle` | `light` | The dashboard has no dark theme; forcing light avoids unreadable text. |

### The three places `orders_high` appears

If you ever rename the channel, change all three or notifications silently land
in a low-priority channel (no sound, no heads-up banner):

1. `apps/lead-notify/app.json` → `plugins[expo-notifications].defaultChannel`
2. `apps/lead-notify/src/lib/push.ts` → `ANDROID_CHANNEL_ID`
3. `src/lib/notifications/config.ts` → `ANDROID_CHANNEL_ID`

---

## Troubleshooting the build

| Symptom | Cause | Fix |
|---|---|---|
| `ENOENT … google-services.json` | Part A not done, or the file is in the wrong folder. | Place it at `apps/lead-notify/google-services.json`. |
| `eas: command not found` | Using the bare `eas` command without a global install. | Use `npx eas-cli@latest …`. |
| *"You need to log in"* | Not logged in. | `npx eas-cli@latest login`. |
| *"Project not configured"* | `eas init` was skipped. | `npx eas-cli@latest init`. |
| Build succeeds, no notifications | Package name mismatch with Firebase. | Compare `app.json` `android.package` with `package_name` in `google-services.json`. |
| *"This build is for a different application"* on install | A previous install used a different signing key (e.g. a build made by someone else's Expo account). | Uninstall the old app first, then install. |
| Build queue is long | Free-tier build servers are shared. | Wait; the queue length is shown by the CLI. |
