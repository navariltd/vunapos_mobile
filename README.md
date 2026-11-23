# VunaPOS Mobile

VunaPOS Mobile is the native point-of-sale client for VunaPOS. It gives store teams a responsive Android and iOS experience for signing in to a VunaPOS/ERPNext site, browsing the POS catalogue, building and processing carts, managing customers and shifts, viewing sales history, and continuing to work with locally cached POS data when connectivity is intermittent.

The app is deliberately separate from the VunaPOS Frappe backend and the browser SPA. The backend remains the system of record and owns business rules, authentication, POS APIs, and realtime events. This repository owns only the Expo/React Native client: its user experience, device permissions, local encrypted session/cache storage, and mobile build and release process. Keeping it separate lets mobile work move and ship independently without making it a Frappe app that must be installed on a site.

## Technology

- Expo SDK 57 and Expo Router
- React Native and React Native Paper
- TypeScript, Jest, and Expo's ESLint configuration
- SQLite cache, SecureStore sessions, and Socket.IO realtime updates

## Clone and run on Android

You need Node.js 24, npm, JDK 17, and Android Studio with the Android SDK, platform-tools, Android 36 platform, and Build Tools 36 installed. Set `ANDROID_HOME` to your SDK directory and make sure `adb` is on your `PATH`. Create and start an Android emulator in Android Studio, or connect a physical Android device with USB debugging enabled. Check that `adb devices` lists it as `device` before building. You also need a reachable VunaPOS-enabled ERPNext site and a user authorized for its POS Profile.

```bash
git clone https://github.com/navariltd/vunapos_mobile.git
cd vunapos_mobile
npm ci
adb devices
npm run android
```

`npm run android` generates the ignored `android/` project if needed, builds a **debug** APK for the connected device/emulator, installs it, and starts Metro. The first native build can take several minutes. This app uses native modules, so Expo Go is not a substitute for that initial build. Afterward, leave Metro running and reload JavaScript changes without rebuilding; rebuild after changing native dependencies, Expo plugins, Android configuration, or other native code.

If the app is already installed and you only need Metro, run `npx expo start --dev-client` from the repository root. Press `r` in the Metro terminal to reload. On an emulator, `npm run android` builds for its architecture (typically x86_64); do not install an ARM-only APK on an x86_64 emulator.

On first launch, enter your company's VunaPOS site URL and sign in. For a Frappe bench running on the development machine at `http://localhost:8000`, forward the port before connecting from an emulator or USB device:

```bash
adb reverse tcp:8000 tcp:8000
```

If Metro cannot be reached from a USB device, also run `adb reverse tcp:8081 tcp:8081`. `localhost` on a device otherwise refers to the device itself. HTTP is permitted in the Android **debug** build for local testing; production builds should use an HTTPS site. Do not put passwords, API tokens, release-upload credentials, or keystores in the repository or in Expo client environment variables.

For iOS development, use macOS with Xcode and run `npm run ios` after `npm ci`. `npm run web` starts the browser target; it does not produce a native app.

## Verify a change

```bash
npm run typecheck
npm run lint
npm test
```

Optionally run `pre-commit install` to enable the repository's lint and type-check hooks. CI runs these checks and Jest on pull requests and pushes to `develop`.

## Builds and releases

The source tree is an Expo project. It is not a Python package and is not installed with Bench or `bench --site ... install-app`. Android builds use the `ke.co.navari.vunapos` application ID. The debug build above is for development, not distribution. The signed Android release process is described below; no local release keystore is needed to run or test the app. iOS distribution requires its own Apple signing and bundle-identifier setup.

The release workflow uses conventional commits and Semantic Release to create GitHub releases from protected `main`. The signed Android candidate workflow runs for every push to `main` and can also be started manually. Keep `.releaserc`, `.github/workflows/release.yml`, and `.github/workflows/android-release.yml` aligned if this release process changes.

### Android direct updates

Android builds check the separate Mobile Release Manager after startup and when the app returns to the foreground (at most once every six hours). This is intentionally independent of the customer ERPNext URL. The production defaults live in `src/config/updateConfig.ts`:

- release server: `https://nl-vms.frappe.cloud`
- package identity: the installed Android package, currently `ke.co.navari.vunapos`
- channel: `Production`

Downstream builds may set the non-secret build-time overrides below. They are compiled into the app; there is no user-facing setting that can redirect the trusted update publisher.

```bash
EXPO_PUBLIC_VUNAPOS_UPDATE_SERVER_URL=https://releases.example.com
EXPO_PUBLIC_VUNAPOS_UPDATE_CHANNEL=Preview
EXPO_PUBLIC_VUNAPOS_UPDATES_ENABLED=false
```

The app calls `GET /api/method/mobile_release_manager.api.releases.check_for_updates` without ERPNext credentials, validates the Frappe `message` response, and only accepts a newer APK served via HTTPS from the configured origin's `/files/` path. Android's DownloadManager stores the APK in VunaPOS's app-specific external-files directory, allowing the transfer to survive an app restart without requesting broad storage access. Before offering installation, VunaPOS validates the download size and SHA-256, parses the archive, checks its package name and version code, and compares the signing identity with the installed application. Android performs the final signature enforcement during installation.

Only a completed, verified update shows the non-blocking **Update ready** sheet. It is suppressed while Checkout is open. **Later** retains the verified APK for a later install from Workspace Settings; it neither redownloads the file nor changes the cart, SQLite cache, outbox, session, or customer ERPNext configuration. **Install Update** opens Android's normal installer. Android may require the user to allow VunaPOS to install unknown apps in system settings (`REQUEST_INSTALL_PACKAGES`); VunaPOS opens that scoped setting and requires the user to retry after approval. It never silently installs an APK.

For a real local upgrade test, build version code `100`, install it, then build and publish version code `101` with the **same release signing certificate** through Mobile Release Manager. Configure the development build with a reachable HTTPS test release URL, then confirm the background download, checksum verification, Later behavior, installer, and retained local data. The server must be deployed with its `mobile_release_manager` app and must publish the APK before any build can discover it.

### Production signing and release candidates

`android/` is generated by Expo and intentionally not committed. The version-controlled `scripts/prepare-android-release.mjs` runs after Expo prebuild in CI and makes `assembleRelease` fail if a release keystore and its passwords are not supplied. It will never fall back to the Android debug key. The Android package identity is fixed as `ke.co.navari.vunapos`; GitHub Actions validates this identity, the generated version code, and the APK signature before uploading a **Draft** candidate to Mobile Release Manager.

Add these protected GitHub Actions secrets before using **Android Release Candidate**:

| Secret | Purpose |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 of the persistent production `.jks` file. |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password. |
| `ANDROID_KEY_ALIAS` | Release-key alias. |
| `ANDROID_KEY_PASSWORD` | Release-key password. |
| `FRAPPE_API_KEY` / `FRAPPE_API_SECRET` | Token for a Frappe user with **Mobile Release Uploader** and VunaPOS `can_upload`. |

Set `FRAPPE_URL` to `https://nl-vms.frappe.cloud` in the protected GitHub **production** environment (a variable is preferred; a secret also works). The workflow explicitly rejects any other URL so a production APK cannot be sent to a different release server.

Encode an existing keystore as one line before adding `ANDROID_KEYSTORE_BASE64`; do not create a replacement key or commit the result:

```bash
base64 < /secure/path/vunapos-release.jks | tr -d '\n'
```

`Android Release Candidate` runs automatically for **every push to protected `main`**, including styling and ordinary application-code changes, or manually from GitHub Actions. It does not publish the release-manager record: an authorized publisher reviews the Draft and publishes it separately.

`app.json` supplies the human-readable base version and Android version-code base:

- `expo.version` (for example, `1.0.0`); and
- `expo.android.versionCode` (a positive base for the deterministic CI code).

For each protected-main build, CI derives one deterministic Android version code from the complete `main` Git history: `expo.android.versionCode + commit_count - 1`. The generated version name is the base version plus that code, for example `1.0.0+142`. This allows every merge—including a styling-only merge—to produce a distinct installable APK without relying on GitHub run numbers. CI rejects a code that is not newer than the latest Published release, which means an exceptional manually published higher code requires deliberately increasing `expo.android.versionCode` to establish a new base.

Draft releases are intentionally not included in version selection. A retry of the same unmerged `main` commit has the same identity and is accepted only when its APK bytes are identical; Mobile Release Manager rejects a conflicting artifact rather than silently allocating another production version. A later `main` commit always has a greater commit count and therefore a distinct identity.

Production APKs include both 32-bit and 64-bit ARM native libraries (`armeabi-v7a` and `arm64-v8a`) so one APK can install on either class of physical device. x86/x86_64 libraries remain excluded from production; use a debug/emulator build for an x86_64 Android emulator. Carrying both ARM architectures makes the production APK larger than an ARM64-only build.

For a local upload after independently building and verifying a signed APK:

```bash
FRAPPE_URL=https://nl-vms.frappe.cloud \
FRAPPE_API_KEY=... \
FRAPPE_API_SECRET=... \
node scripts/publish-android-release.mjs \
  --apk vunapos-1.2.0-120.apk \
  --application-id ke.co.navari.vunapos \
  --version-name 1.2.0 \
  --version-code 120 \
  --release-channel Production
```

The script streams SHA-256 calculation, performs the authenticated multipart upload, and accepts success only when Frappe returns matching metadata with `Draft` status. It prints no credentials. A `401`/`403`, `413`, conflict, malformed response, or non-Draft result fails the command. Rotate a compromised Frappe API key in Frappe, replace the two GitHub secrets, and remove the old key immediately. Back up the production keystore outside GitHub in access-controlled, recoverable storage; losing it prevents future in-place Android upgrades.

### Build a signed Android APK locally

Only do this when you have the **existing** production signing key and an approved release version. Do not generate a new key for an update: Android will reject an in-place upgrade signed with a different certificate. The build script requires these environment variables; provide them through your secure shell or CI secret store, not a project `.env` file:

| Variable | Value |
| --- | --- |
| `VUNAPOS_RELEASE_STORE_FILE` | Absolute path to the existing `.jks` keystore |
| `VUNAPOS_RELEASE_STORE_PASSWORD` | Keystore password |
| `VUNAPOS_RELEASE_KEY_ALIAS` | Alias of the release key |
| `VUNAPOS_RELEASE_KEY_PASSWORD` | Release-key password |

With those variables set, run from the repository root:

```bash
npm ci
npx expo prebuild --platform android --no-install --non-interactive
node scripts/prepare-android-release.mjs
cd android
./gradlew :app:assembleRelease \
  -PreactNativeArchitectures=armeabi-v7a,arm64-v8a \
  -PVUNAPOS_VERSION_NAME=1.0.0+123 \
  -PVUNAPOS_VERSION_CODE=123 \
  --build-cache
cd ..
```

Replace the example version name and code with approved values newer than the installed/published release. The APK is written to `android/app/build/outputs/apk/release/app-release.apk`. Verify its package, version, and signing certificate before distribution:

```bash
aapt dump badging android/app/build/outputs/apk/release/app-release.apk
apksigner verify --verbose --print-certs android/app/build/outputs/apk/release/app-release.apk
```

The APK must identify `ke.co.navari.vunapos`, have the intended version code, and match the existing production certificate. The release script refuses to sign with a debug key. If you do not have the production key, use the debug instructions above or the protected GitHub Actions release workflow; do not distribute a locally generated replacement-key APK as an update. Prefer a separate clean checkout for local release builds: the preparation script modifies the generated `android/` project and restricts its native architectures to ARM, which is unsuitable for a later x86_64 emulator debug build.

Before the first workflow run, a System Manager must create one enabled **Mobile Release Application** on `https://nl-vms.frappe.cloud` with Android Application ID `ke.co.navari.vunapos`, create the dedicated CI Frappe user, grant it the **Mobile Release Uploader** role, and add it to that application's Authorized Users table with **Can Upload**. The release manager intentionally does not pin an APK certificate fingerprint; CI and the publisher establish signing trust, and the installed VunaPOS client checks signing compatibility again before installation.

## Repository layout

```text
src/          application routes, POS features, services, cache, and theme
__tests__/    unit and integration tests
assets/       application images
modules/      local native modules
scripts/      Android release preparation and publishing helpers
test/         Jest setup
app.json      Expo application metadata and permissions
```
