# MerchantApp — agent instructions

The FlashFits **merchant mobile app**. Expo SDK 54, expo-router, NativeWind, TypeScript.

> ## ⚠ Read this before writing any code here
>
> **This app is a feature subset of [`MerchantModule`](../MerchantModule) and is a candidate for
> retirement.** Every screen here exists there, while `MerchantModule` additionally has bulk product upload,
> courier orders, brand management, a four-screen warehouse module and product matching.
>
> **Build new merchant features in `MerchantModule`, not here.** Read
> `../FF_api_web/docs/reports/merchant-consolidation.md` first.
>
> Changes that are still appropriate in this repo: bug fixes for merchants on the shipped build, and the
> parity gaps listed in that report. If you are about to add a feature, stop and ask.

**Read before changing anything:**

| | |
|---|---|
| `../FF_api_web/docs/reports/merchant-consolidation.md` | **the status of this repo** |
| `../MerchantModule/PRODUCT.md` | what a merchant does — the shared product definition |
| `../FF_api_web/docs/ecosystem/README.md` | cross-repo facts: IST, money, the order lifecycle, vocabulary |
| `../FF_api_web/docs/ecosystem/PRINCIPLES.md` | the ten non-negotiables |
| `../FF_api_web/docs/ecosystem/TESTING.md` | the test stack |
| `VERIFY.md` | what to do when you think you are finished |

## Expo has changed

**Read the versioned docs for the installed SDK before writing code:**
https://docs.expo.dev/versions/v54.0.0/

SDK 54 with `experiments.reactCompiler` and `typedRoutes` on. Patterns from older SDKs or from memory are
frequently wrong — note this repo already uses `expo-file-system/legacy` and the deprecated `expo-av`.

## Principles

Full statements in `../FF_api_web/docs/ecosystem/PRINCIPLES.md`. Here specifically:

1. **The server owns every amount.** Payouts, commission, revenue — display what the API returned.
2. **A missed order alert costs a sale.** `src/utils/alertManager.ts` and the `order_alerts` notification
   channel in `src/context/SocketContext.tsx` (`importance: MAX`, `bypassDnd: true`) are critical-path.
3. **Dates are IST.** Earnings periods come resolved from the server.
4. **Tests ship with the feature**, and **`/verify` before done.**

## Commands

```bash
npm install
npx expo start
npm run android|ios|web
npm run lint

eas build --profile production        # or production-apk for a sideloadable APK
git config core.hooksPath .githooks   # once per clone
```

**No test runner is configured.** Given this repo's status, add tests only for code you are fixing.

## Layout

```
src/app/                   expo-router routes
  (auth)/                  login, register, forgot-password
  (tabs)/                  dashboard, orders, products, revenue, profile
  onboarding, bank-and-documents, pending-verification, rejected, payment, policies
  add-product, edit-product, add-variant, stock-update, warehouse-stock,
  matching-products, offers, payouts, zip-covers, notifications, explore
src/context/               Auth, Socket (sockets + push + the incoming-order modal)
src/utils/                 api, alertManager, imageDownloader
src/hooks/                 useAppUpdate (force-update gate from appConfig)
src/components/            ui, modals
```

## Store identity — do not change these

| | |
|---|---|
| Android `package` | `com.shubhamexpo7.FlashFitsMerchantApp` |
| iOS `bundleIdentifier` | `com.shubhamexpo7.FlashFitsMerchantApp` |
| EAS project | `afb120d4-1db6-48f5-acf0-bdb195b2efd8` |

These identifiers are what any store listing is keyed to. A Capacitor replacement must reuse them exactly to
publish as an *update* rather than a new app. **Export the EAS Android keystore before any migration work**
(`eas credentials` → Android → production → download) — without the upload key you cannot update the Play
listing.

**Known mismatch:** `appConfig.merchantAppVersion.storeUrlIos` points at `com.flashfits.merchant`, which is
not this app's bundle ID. The force-update deep link is broken. Also
`merchantAppVersion.storeUrl` defaults to a GitHub APK release URL, which suggests this app may be
distributed by sideloading rather than through Play — **verify before planning any store work.**

## Known debt

1. **Duplicate of `MerchantModule`, minus features.** The core issue; see the report.
2. **`expo-av` is deprecated** but `src/utils/alertManager.ts` depends on it.
3. **`expo-file-system/legacy`** import path in `add-product.tsx` and `utils/imageDownloader.ts`.
4. **Backgrounded looping audio does not work on iOS** — `alertManager.ts` sets
   `staysActiveInBackground: true`, but iOS suspends the app and stops the audio. The indefinite alarm is in
   practice Android-and-foreground only. Relevant because it means the Capacitor migration loses far less
   than it appears to (report §4).
5. **`src/app/explore.tsx`** may be dead scaffold — confirm before relying on it.
6. **Socket identity travels in the handshake query.** See
   `../FF_api_web/docs/security-findings.md` S1.
7. **`AGENTS.md` was two lines and `README.md` is the Expo scaffold** — this file replaces the former.

## When you are finished

Run `VERIFY.md`. For this app: **the order alert with the screen locked**, on a **real Android device** (the
`bypassDnd` channel cannot be verified on a simulator), and the force-update gate.

Three failed fix attempts on one problem → stop, revert, record it in `docs/KNOWN-ISSUES.md`, tell the human.

## Git

Commit explicit paths, never `git add -A`. `type(scope): description`. Branch `main` is latest.
