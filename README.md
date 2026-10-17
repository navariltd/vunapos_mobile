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

The source tree is an Expo project. It is not a Python package and is not installed with Bench or `bench --site ... install-app`. Before distributing a production build, replace the placeholder Android application ID (`com.anonymous.vunaposmobile`) and configure the definitive iOS bundle identifier, signing credentials, and EAS project/build profiles for the Vuna Technologies accounts.

The release workflow uses conventional commits and Semantic Release to create GitHub releases from `develop`. If production releases will instead come from `main` or a dedicated release branch, update `.releaserc` and the release workflow together before enabling releases.

## Repository layout

```text
src/          application routes, POS features, services, cache, and theme
__tests__/    unit and integration tests
assets/       application images
test/          Jest setup
app.json      Expo application metadata and permissions
```
