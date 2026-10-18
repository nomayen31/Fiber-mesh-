// Dynamic config layer.
//
// `app.json` stays the single source of truth for every field. This file exists
// for exactly ONE reason: to point `android.googleServicesFile` at the right
// copy of `google-services.json` depending on where the build is running.
//
// Why that is needed
// ------------------
// 1. `google-services.json` is git-ignored on purpose (this repo is public), and
//    EAS CLI builds the upload archive using `.gitignore` rules. So the file
//    never reaches the EAS Build servers on its own.
// 2. Instead the file is stored once as an EAS environment variable of type
//    "file" named `GOOGLE_SERVICES_JSON`. On a build runner that variable's
//    value is the ABSOLUTE PATH to the uploaded copy of the file.
// 3. So we use that path when it is present, and fall back to the local
//    `./google-services.json` for local `expo prebuild` / `expo run:android`.
//
// `path.resolve(projectRoot, absolutePath)` in @expo/config-plugins returns the
// absolute path unchanged, so an out-of-tree path is supported. If the file is
// genuinely missing the prebuild step fails loudly with
// "Cannot copy google-services.json from ... to ..." instead of shipping an APK
// with no Firebase config.
//
// Setup / rotation: see docs/FIREBASE_SETUP.md (Part A) and
// docs/APK_BUILD_AND_INSTALL.md (Prerequisites).

/** @type {(ctx: { config: import('expo/config').ExpoConfig }) => import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
  },
});
