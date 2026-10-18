# Firebase Setup — push notifications

This is the **only** part of the system that needs manual work outside the code.
Everything else is already built, migrated and wired up.

There are two independent pieces. They are easy to confuse, so keep them apart:

| | Who needs it | What it is | Where it goes |
|---|---|---|---|
| **A. `google-services.json`** | the **app** | public Firebase *client* config. It lets the phone ask Google for an FCM registration token. | local file `apps/lead-notify/google-services.json` (git-ignored, never committed) **+** an EAS environment variable, so EAS Build can see it — see *Part A step 9* |
| **B. Service account** | the **server** | private Firebase *admin* credentials. They let the backend send a push to a device. | Vercel environment variables (never in the app, never in git) |

Both belong to the **existing `fiber-mesh` Firebase project** — the same one the website already uses for Analytics (`G-6H5ZZ2PTC1`). Do **not** create a second Firebase project.

- Firebase project ID: `fiber-mesh`
- Project number / sender ID: `812317354558`

---

## Why both are needed

```
customer places order
        │
        ▼
Next.js saves the Order row          ── website, already working
        │
        ▼
backend builds a notification        ── already built (src/lib/notifications/*)
        │
        ▼
Firebase Admin SDK sends it  ◄──────── needs (B) the service account
        │
        ▼
Firebase Cloud Messaging
        │
        ▼
the phone's FCM token         ◄──────── the token only exists thanks to (A)
        │
        ▼
Android shows the notification       ── foreground, background, or closed
```

Miss **(A)** and the app never obtains a token, so it registers nothing and there is nothing to send to.
Miss **(B)** and the app registers fine, but the server logs `push delivery disabled` and records deliveries as `SKIPPED`.

Neither mistake breaks the website. See *Graceful degradation* at the end.

---

## Part A — register the Android app and download `google-services.json`

1. Open the [Firebase console](https://console.firebase.google.com/) and pick the **`fiber-mesh`** project.
2. Click the **gear icon → Project settings**.
3. Scroll to **Your apps** and click **Add app → Android** (the little Android robot).
4. Fill in:
   - **Android package name** — this must match exactly, character for character:
     ```
     com.fibermesh.leadnotify
     ```
   - **App nickname** (optional): `Fiber Mesh Lead Notify`
   - **Debug signing certificate SHA-1**: **leave empty.** It is only needed for Google Sign-In and phone auth, neither of which this app uses.
5. Click **Register app**.
6. On the next screen click **Download `google-services.json`**.
7. Put the downloaded file at exactly this path:

   ```
   D:\fiber mesh website\apps\lead-notify\google-services.json
   ```

8. That's it for Firebase. Nothing goes into Vercel for Part A. The file is
   already referenced from `apps/lead-notify/app.json`
   (`expo.android.googleServicesFile`) and is already listed in `.gitignore`.

9. **Register the file with EAS** — done once, and only because the repo is
   public. EAS CLI builds the upload archive using `.gitignore` rules, so a
   git-ignored `google-services.json` would never reach the build servers and
   the build would fail with `Cannot copy google-services.json from …`.
   Upload it to EAS once as a *file*-type environment variable instead:

   ```powershell
   cd "D:\fiber mesh website\apps\lead-notify"
   npx eas-cli@latest env:set --name GOOGLE_SERVICES_JSON --type file `
     --value .\google-services.json --visibility sensitive `
     --environment production --environment preview --environment development `
     --non-interactive
   ```

   On a build runner that variable's value is the **absolute path** to the
   uploaded copy, and `apps/lead-notify/app.config.js` feeds that path into
   `android.googleServicesFile`. Locally the variable is unset and the same file
   is read from `./google-services.json`, so nothing changes for local builds.

   Rotating the file later = change it locally, then re-run the command with
   `--force` (or `eas env:set` again, which overwrites).

   ```powershell
   npx eas-cli@latest env:list --environment production   # confirm it is there
   ```

   If it is ever missing, the build fails at prebuild with a clear error — it
   never silently produces an APK without Firebase.

### Verifying it is correct

Open the file and check that `package_name` matches the app config:

```json
{
  "client": [
    {
      "client_info": {
        "android_client_info": {
          "package_name": "com.fibermesh.leadnotify"
        }
      }
    }
  ]
}
```

If `package_name` differs by even one character, the app will install but will
never receive a single notification, and nothing will log an error on the phone.
This is the most common mistake — check it first.

### Once you edit `com.fibermesh.leadnotify` in the future

Changing the package name later means the Firebase Android app must be
re-registered with the new name and a **new** `google-services.json` downloaded.
An installed APK also cannot be upgraded to a different package name — it
installs as a separate app.

---

## Part B — create the service account for the server

The backend needs permission to send messages. That permission lives in a
service-account key.

1. In the Firebase console go to **Project settings → Service accounts**.
2. Click **Generate new private key**, then **Generate key**.
3. A `.json` file downloads. **This file is a secret.** It can send push
   notifications to every registered device, so it must never be committed, never
   mailed around, and never placed inside `apps/lead-notify/`.
4. Choose **one** of the two ways below to give it to the server.

### Option 1 (recommended) — one variable with the whole JSON, base64 encoded

Base64 avoids every newline- and quote-mangling problem that pasting raw JSON
into a dashboard tends to cause.

PowerShell:

```powershell
# Run from the folder that contains the downloaded key, replacing the filename.
$json = Get-Content -Raw ".\fiber-mesh-firebase-adminsdk-xxxxx.json"
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
```

Copy the single long line it prints, then in **Vercel → Project `fiber-mesh` →
Settings → Environment Variables** add:

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | the base64 string |

Apply it to **Production** (and **Preview** if you want preview deployments to
send pushes too), then redeploy.

The backend also accepts the **raw** JSON (starting with `{`) in this same
variable, so either form works.

### Option 2 — three discrete variables

If you prefer separate values, set all three. Open the downloaded JSON and copy
the matching fields:

| Vercel variable | JSON field |
|---|---|
| `FIREBASE_PROJECT_ID` | `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` |
| `FIREBASE_PRIVATE_KEY` | `private_key` |

The private key contains newlines. Paste it **with the surrounding quotes and
the literal `\n` sequences** exactly as they appear in the JSON file. The backend
converts `\n` back into real newlines for you.

### Part B, locally

To test push delivery from your machine, add the same variable(s) to the local
`.env` (which is git-ignored). Nothing else needs to change.

### Do I need to enable a Firebase API in Google Cloud?

No. FCM is enabled automatically with the Firebase project. There is no
"Cloud Messaging API" to switch on for this flow, and no OAuth consent screen to
configure.

---

## Confirming it worked

### On the server

Sign in to the app and open the **সেটিংস (Settings)** tab. The **সার্ভারের অবস্থা**
card tells you the truth directly:

- green — *"সার্ভারে পুশ পাঠানোর সেটআপ সম্পূর্ণ"* — credentials are loaded.
- amber — *"সার্ভারে Firebase Admin কী সেট করা নেই"* — and it lists the exact
  missing variable names.

The same information is available without the app:

```bash
curl -s https://fiber-mesh.vercel.app/api/admin/devices \
  -H "Authorization: Bearer <token from /api/admin/mobile/login>"
```

```json
{
  "ok": true,
  "devices": [ ... ],
  "pushConfigured": true,
  "missingServerKeys": [],
  "enabledEvents": ["order.created", "inquiry.created"]
}
```

### On the phone

The Settings tab shows **এই ফোনে নোটিফিকেশন**:

- *"চালু আছে। এই ফোনটি … নামে নিবন্ধিত"* — the device has a token and the server
  accepted it.
- *"ফোন থেকে নোটিফিকেশনের অনুমতি দেওয়া হয়নি"* — Android-level permission is off.
- *"এমুলেটরে পুশ নোটিফিকেশন পাওয়া যায় না"* — an emulator; use a real phone.

Then place a real test order on the website and watch the phone.

---

## Security rules for this integration

These are enforced by the code, but they are worth stating plainly:

1. **The service account never reaches the app.** It is read only by
   `src/lib/notifications/firebase-admin.ts`, which is imported only from route
   handlers that declare `runtime = "nodejs"`. That module throws a loud error if
   it is ever evaluated in a browser bundle, so a mistake becomes obvious instead
   of leaking.
2. **No credential is ever returned to a client.** The only things the API exposes
   are *which variable names are missing* — never a value.
3. **`google-services.json` is not a server secret.** It is public client config;
   it is git-ignored only because it is environment-specific. Even so, keep it out
   of the repository so a fork does not silently point at your project.
4. **The push payload carries no customer data.** Titles and bodies contain only
   the order number, product, quantity and total. Customer name, phone number and
   address are *not* in the push — the app fetches them from the authenticated API
   after a tap. A push is rendered on a locked screen, so treat it as public.
5. **Rotating the key.** If the service-account key is ever exposed, delete it in
   the Firebase console (**Project settings → Service accounts → the key → Delete**),
   generate a new one, and update the Vercel variable. Registered phones do not
   need to be touched — they keep working, because the token is an FCM token, not
   a credential derived from the key.

---

## Graceful degradation — what happens if a step is skipped

Nothing in this pipeline can take the website down. The states are:

| Situation | What happens |
|---|---|
| No service-account credentials | Jobs are still recorded in the database with status `SKIPPED`. Orders, the admin dashboard and the app all work normally. The Settings tab explains which variables are missing. |
| `google-services.json` missing | The app installs and every screen works, but `getDevicePushTokenAsync()` cannot return a token, so the Settings tab reports *"ডিভাইস থেকে FCM টোকেন পাওয়া যায়নি"* and no device is registered. |
| The admin denied notification permission | No token is registered; the Settings tab points at the Android settings screen. |
| Notification permission revoked after registration | FCM stops delivering. The device row stays active until it is logged out, or until a send fails with a dead-token error and the backend deactivates it automatically. |
| Admin logged out | The app calls `DELETE /api/admin/devices?token=…`, so the phone stops receiving leads immediately. |

### A known limitation worth knowing

A device registration is deactivated by an explicit **logout**. If the session
instead *expires* (the 30-day token lifetime) the app can no longer authenticate,
so it cannot unregister itself, and the row stays active until the next login
followed by a logout.

Practical impact is small: only an already-authorised phone is affected, the
device token lives in the Android Keystore, and the app is privately distributed.
If you ever need to cut a phone off immediately — a lost device — deactivate it
from the database directly:

```sql
UPDATE "DeviceToken" SET "isActive" = false WHERE label LIKE '%Pixel%';
```

`isActive = false` is enough; the dispatcher ignores inactive devices.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Notification arrives while the app is open, but not when it is closed | The APK was built without the Firebase SDK. | Rebuild; `google-services.json` must exist **at build time**, not just at runtime. |
| `pushConfigured: false` and `missingServerKeys` lists all three names | Neither option above was set. | Set `FIREBASE_SERVICE_ACCOUNT_JSON`, then redeploy. |
| `pushConfigured: false` even though the variables are set | The value was pasted with surrounding quotes into Vercel, or the key is truncated. | Re-paste the raw value. Storing the JSON base64-encoded (Option 1) avoids this entirely. |
| Settings says the device registered, but nothing ever arrives | The notification *type* is switched off. | Check `NOTIFY_EVENTS` in the Vercel environment. Default is `order.created,inquiry.created`. |
| Delivery rows show `FAILED` with a `registration-token-not-registered` error | The app was uninstalled or its data cleared, so FCM dropped the token. | Working as designed: the device is deactivated automatically. Log in again on the phone to re-register. |
| Nothing at all appears in the Settings device list | Permission was never granted. | Grant notification permission, then tap **আবার চালু করার চেষ্টা** (try again). |
