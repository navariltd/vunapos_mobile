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

The release workflow uses conventional commits and Semantic Release to create GitHub releases from `develop`. If production releases will instead come from `main` or a dedicated release branch, update `.releaserc` and the release workflow together before enabling releases.

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

Current local Android release builds are debug-signed by the generated native project. That is suitable only for development: a production release pipeline must configure and protect a persistent VunaPOS release keystore, increment `android.versionCode` for every APK, and use the same key for every in-place update. Changing the package ID or signing key prevents Android from upgrading existing installations.

## Repository layout

```text
src/          application routes, POS features, services, cache, and theme
__tests__/    unit and integration tests
assets/       application images
test/          Jest setup
app.json      Expo application metadata and permissions
```
