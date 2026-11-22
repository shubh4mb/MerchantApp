# MerchantApp

The FlashFits **merchant mobile app**. Expo SDK 54, expo-router, NativeWind, TypeScript.

> ## ⚠ Retirement candidate
>
> Every screen here also exists in [`MerchantModule`](../MerchantModule), which additionally has bulk
> product upload, courier orders, brand management, a four-screen warehouse module and product matching.
>
> **Build new merchant features in `MerchantModule`, not here.** Appropriate changes in this repo: bug fixes
> for merchants on the shipped build, and the parity gaps listed in
> [../FF_api_web/docs/reports/merchant-consolidation.md](../FF_api_web/docs/reports/merchant-consolidation.md).

## Setup

```bash
git config core.hooksPath .githooks     # once per clone
npm install
npx expo start
```

## Commands

| | |
|---|---|
| `npx expo start` | dev server |
| `npm run android` / `ios` / `web` | platform targets |
| `npm run lint` | `expo lint` |
| `eas build --profile production` | store build; `production-apk` for a sideloadable APK |
| `bash .githooks/test-hooks.sh` | self-check the git hooks |

## Store identity — do not change

| | |
|---|---|
| Android `package` / iOS `bundleIdentifier` | `com.shubhamexpo7.FlashFitsMerchantApp` |
| EAS project | `afb120d4-1db6-48f5-acf0-bdb195b2efd8` |

Any store listing is keyed to these. A Capacitor replacement must reuse them exactly to publish as an
*update*. **Export the EAS Android keystore before any migration work** (`eas credentials` → Android →
production → download); without the upload key you cannot update the Play listing.

Note `appConfig.merchantAppVersion.storeUrl` defaults to a GitHub APK release URL, which suggests this app
may be sideloaded rather than published through Play — verify before planning store work. The iOS store URL
in `appConfig` also points at the wrong bundle ID.

## Where things are

```
src/app/(auth)/      login, register, forgot-password
src/app/(tabs)/      dashboard, orders, products, revenue, profile
src/app/             onboarding, bank-and-documents, pending-verification, rejected, payment,
                     policies, add-product, edit-product, add-variant, stock-update,
                     warehouse-stock, matching-products, offers, payouts, zip-covers,
                     notifications, explore
src/context/         Auth, Socket (sockets + push + the incoming-order modal)
src/utils/           api, alertManager, imageDownloader
src/hooks/           useAppUpdate — the force-update gate
```

## Documentation

| | |
|---|---|
| [AGENTS.md](AGENTS.md) | rules for AI coding agents — **read the status note first** |
| [VERIFY.md](VERIFY.md) | post-build verification flows |
| [../MerchantModule/PRODUCT.md](../MerchantModule/PRODUCT.md) | the shared merchant product definition |
| [../FF_api_web/docs/ecosystem/README.md](../FF_api_web/docs/ecosystem/README.md) | cross-repo facts |

No `PRODUCT.md`/`DESIGN.md` here deliberately — writing full design docs for a repo that may be retired is
work that may be deleted. They will be written if the consolidation is declined.

Branch `main` is latest.
