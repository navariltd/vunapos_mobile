# VunaPOS Mobile

VunaPOS Mobile is the native point-of-sale client for VunaPOS. It gives store teams a responsive Android and iOS experience for signing in to a VunaPOS/ERPNext site, browsing the POS catalogue, building and processing carts, managing customers and shifts, viewing sales history, and continuing to work with locally cached POS data when connectivity is intermittent.

The app is deliberately separate from the VunaPOS Frappe backend and the browser SPA. The backend remains the system of record and owns business rules, authentication, POS APIs, and realtime events. This repository owns only the Expo/React Native client: its user experience, device permissions, local encrypted session/cache storage, and mobile build and release process. Keeping it separate lets mobile work move and ship independently without making it a Frappe app that must be installed on a site.

## Technology

- Expo SDK 57 and Expo Router
- React Native and React Native Paper
- TypeScript, Jest, and Expo's ESLint configuration
- SQLite cache, SecureStore sessions, and Socket.IO realtime updates

## Prerequisites

- Node.js 24 (the version used in CI)
- npm 10 or later
- A reachable VunaPOS/ERPNext site that exposes the supported VunaPOS POS APIs
- Android Studio for local Android native builds, or Xcode on macOS for local iOS native builds

## Install and run

```bash
git clone <repository-url> vunapos_mobile
cd vunapos_mobile
npm ci
npm start
```

Open the Expo development server with an emulator, simulator, or development build. You can also use:

```bash
npm run android
npm run ios
npm run web
```

On first launch, enter the URL of the VunaPOS site and sign in with an authorized ERPNext user. Do not commit site credentials, signing keys, or environment files. Copy an explicitly provided `.env.example` to a local `.env` file when configuration is introduced.

## Verify a change

```bash
npm run typecheck
npm run lint
npm test
```

Optionally install the repository hooks with `pre-commit install`; they run linting and type-checking for changed JavaScript and TypeScript files. GitHub Actions runs the complete verification suite for pull requests and pushes to `develop`.

## Builds and releases

The source tree is an Expo project. It is not a Python package and is not installed with Bench or `bench --site ... install-app`. Android releases use the `ke.co.navari.vunapos` application ID. Before distributing a production build, configure the definitive iOS bundle identifier, signing credentials, and EAS project/build profiles for the Vuna Technologies accounts.

The release workflow uses conventional commits and Semantic Release to create GitHub releases from protected `main`. The signed Android candidate workflow also runs only from `main` when the app version changes. Keep `.releaserc`, `.github/workflows/release.yml`, and `.github/workflows/android-release.yml` aligned if this release branch changes.

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

`Android Release Candidate` runs automatically for a push to protected `main` only when `app.json` changes, or manually from GitHub Actions. It does not publish the release-manager record: an authorized publisher reviews the Draft and publishes it separately.

`app.json` is the authoritative Android version source. Before a new production candidate, deliberately increase both:

- `expo.version` for the human-readable `version_name`; and
- `expo.android.versionCode` for the positive, monotonically increasing Android version code.

The workflow extracts both values from the generated APK and requires an exact match. Mobile Release Manager rejects a version code that is not greater than an already Published release and rejects a non-identical artifact reusing an existing identity. A retry of identical bytes is idempotent. Do not use GitHub run numbers as Android version codes.

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

For a local signed build, export the four `ANDROID_*` values, generate Android with `npx expo prebuild --platform android --no-install --non-interactive`, run `node scripts/prepare-android-release.mjs`, then invoke `./gradlew :app:assembleRelease` from `android/` with `-PVUNAPOS_VERSION_NAME` and `-PVUNAPOS_VERSION_CODE` matching `app.json`. Use `aapt dump badging` and `apksigner verify --verbose --print-certs` before the local upload command above.

Before the first workflow run, a System Manager must create one enabled **Mobile Release Application** on `https://nl-vms.frappe.cloud` with Android Application ID `ke.co.navari.vunapos`, create the dedicated CI Frappe user, grant it the **Mobile Release Uploader** role, and add it to that application's Authorized Users table with **Can Upload**. The release manager intentionally does not pin an APK certificate fingerprint; CI and the publisher establish signing trust, and the installed VunaPOS client checks signing compatibility again before installation.

## Repository layout

```text
src/          application routes, POS features, services, cache, and theme
__tests__/    unit and integration tests
assets/       application images
test/          Jest setup
app.json      Expo application metadata and permissions
```
