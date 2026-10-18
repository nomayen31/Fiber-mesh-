# Building and installing the APK

The app is `apps/lead-notify/`, an Expo (React Native) project. The APK is built
in the cloud with **EAS Build**, so no JDK, Android SDK or Android Studio is
needed on this machine.

> **Status.** The code side is complete, and the Firebase Android client config is
> in place — `apps/lead-notify/google-services.json` exists and has been verified:
> the native project generates with the Google Services Gradle plugin applied, the
> `orders_high` channel and brand notification icon/colour in the manifest, and
> `applicationId com.fibermesh.leadnotify` matching the file's `package_name`.
>
> What remains needs your accounts:
>
> 1. **An Expo account login** — `eas build` uploads the project to Expo's build
>    servers under your account, and that is where the APK is compiled. There is
>    no JDK or Android SDK on this machine, so a local build is not an option.
> 2. **The Firebase Admin service account** (see
>    [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) Part B) — not needed to *build* the
>    APK, but needed for real pushes to be delivered. Without it the APK installs,
>    registers, and shows everything correctly; the server just records each
>    notification as `SKIPPED` and the app's Settings tab tells you why.
>
> Follow the steps below in order and you will have an installable, push-enabled
> APK at the end.

---

## Step 0 — prerequisites

- Node.js (already present — v24.20.0 on this machine).
- An [Expo account](https://expo.dev/signup) — the free tier is enough. EAS
  gives every account a monthly allowance of Android builds.
- A real Android phone (Android 7.0 or newer).
- `apps/lead-notify/google-services.json` — **already in place** and verified.
- The same file uploaded to EAS once, as a *file*-type environment variable
  named `GOOGLE_SERVICES_JSON` — **already done** on this project. This is not
  optional: the file is git-ignored (the repo is public) and EAS builds its
  upload archive from `.gitignore` rules, so without the variable the file never
  reaches the build server. Recreate or rotate it with:

  ```powershell
  cd "D:\fiber mesh website\apps\lead-notify"
  npx eas-cli@latest env:set --name GOOGLE_SERVICES_JSON --type file `
    --value .\google-services.json --visibility sensitive `
    --environment production --environment preview --environment development `
    --non-interactive
  ```

  `apps/lead-notify/app.config.js` reads that variable on the build runner and
  points `expo.android.googleServicesFile` at it; locally it falls back to
  `./google-services.json`. Everything else still comes from `app.json`.

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

This project is **already initialised** — `app.json` carries
`extra.eas.projectId: ccbcc34e-2531-4a50-a483-75fb2d8b2c92` and
`owner: nomayen31`, and `npx eas-cli@latest project:info` resolves to
`@nomayen31/fiber-mesh-lead`. So `init` only needs re-running if that block is
ever lost.

> `app.json` is where the project id lives, not `app.config.js`: the dynamic
> config extends `app.json`, so `eas init` can still write to it.

If the CLI asks whether to configure the Android build, say yes; it will detect
the existing `eas.json` and keep the `preview` profile.

### Alternative — build without an interactive login (`EXPO_TOKEN`)

`eas login` prompts for credentials, so it cannot be run by an agent or in CI.
Expo's supported alternative is an **access token**:

1. Create one at <https://expo.dev/settings/access-tokens> (name it something like
   `fiber-mesh-ci`, and copy it — it is shown once).
2. Export it and run everything non-interactively:

   ```powershell
   $env:EXPO_TOKEN = "your-token"
   npx eas-cli@latest init --non-interactive
   npx eas-cli@latest build --platform android --profile preview --non-interactive
   ```

Treat this token like a password: it can act on your Expo account. Do not commit
it, and revoke it at the same page when you are finished with it. On Vercel or
GitHub Actions it belongs in a secret, never in a file.

`eas init` still has to run once so that `extra.eas.projectId` exists in
`app.json`; `eas build` cannot infer the project without it.

Because a logged-in CLI session already exists on this machine, the token is
only needed for unattended/CI runs. `npx eas-cli@latest whoami` shows whether a
session is active.

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

**`google-services.json` is required at this point.** If the file is missing
locally *and* the `GOOGLE_SERVICES_JSON` EAS variable is absent, the build fails
at prebuild with `Cannot copy google-services.json from … to …`. That is
deliberate: an APK built without it cannot obtain an FCM token, so it could
never receive a lead.

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
5. Tap **টেস্ট নোটিফিকেশন → পাঠান** on the same screen. A test push should arrive
   within a few seconds. This is the fastest proof that the server can reach *this*
   phone, and it creates no order and no notification job — so use it first,
   whenever you are unsure.
6. Then place a test order on the website and confirm the notification arrives.

Step 5 exists because a green card only means the credential *loaded*; it does not
prove FCM accepted the message. The test button round-trips a real push.

If a card is amber or red it names the exact problem — including the case where the
credential variable **is** set but unusable, which the card reports in Bengali along
with a sanitized reason code. See
[TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) and
[FIREBASE_SETUP.md](./FIREBASE_SETUP.md).

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

`eas.json` also defines a `production` profile — the same APK output, kept as a
named profile so the build you intend to support long-term is distinguishable
from scratch/preview builds:

```powershell
npx eas-cli@latest build --platform android --profile production
```

Do not use `eas submit` — this app is deliberately not published to the Play
Store.

### Why there is no `channel` / over-the-air updates

Both profiles produce a plain APK with **no OTA channel**, and `expo-updates` is
not installed. Over-the-air updates only apply to builds that carry a `channel`,
and adding one without `expo-updates` present is a silent no-op at best — so it
is left out rather than left ambiguous. The consequence is honest and simple:
**a new build must be installed to update the app.**

If you later want OTA (useful here, since a sideloaded app gets no store
updates), install `npx expo install expo-updates`, add back a `channel` per
profile, and publish with `eas update`. It is not required for anything else.

---

## Why the app is not on the Play Store

It is an internal staff tool: one admin password, an order dashboard, and lead
pushes. Google Play would require a public listing, a privacy policy, a content
rating and a review cycle, none of which adds value here. A directly distributed
APK is the right shape for a handful of company phones.

Two consequences worth knowing:

- **No automatic updates.** New builds must be reinstalled (see *Why there is no
  `channel` / over-the-air updates* above).
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
| `android.googleServicesFile` | `./google-services.json` in `app.json`; overridden at build time by `app.config.js` from `GOOGLE_SERVICES_JSON` | Firebase client config. On EAS the variable holds the absolute path to the uploaded copy. |
| `plugins → expo-notifications → defaultChannel` | `orders_high` | Must match `ANDROID_CHANNEL_ID` in `src/lib/notifications/config.ts` **and** `ANDROID_CHANNEL_ID` in `src/lib/push.ts`. |
| `plugins → expo-notifications → icon` | `./assets/images/notification-icon.png` | The status-bar icon. Must be a **bold silhouette** — Android renders it as a 24 dp alpha mask. Do not point this at the launcher icon; see [MOBILE_APP_SETUP.md](./MOBILE_APP_SETUP.md). |
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
| `Cannot copy google-services.json from … to …` | The file is neither at `apps/lead-notify/google-services.json` on the machine running the build, nor uploaded as the EAS variable `GOOGLE_SERVICES_JSON`. | Do **both** steps of [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) Part A: the local file for local builds, the EAS variable for cloud builds. |
| `eas: command not found` | Using the bare `eas` command without a global install. | Use `npx eas-cli@latest …`. |
| *"You need to log in"* | Not logged in. | `npx eas-cli@latest login`. |
| *"Project not configured"* | `eas init` was skipped. | `npx eas-cli@latest init`. |
| Build succeeds, no notifications | Package name mismatch with Firebase. | Compare `app.json` `android.package` with `package_name` in `google-services.json`. |
| *"This build is for a different application"* on install | A previous install used a different signing key (e.g. a build made by someone else's Expo account). | Uninstall the old app first, then install. |
| Build queue is long | Free-tier build servers are shared. | Wait; the queue length is shown by the CLI. |
