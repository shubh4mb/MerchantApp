# MerchantApp documentation index

> ## ⚠ This repo is a retirement candidate
>
> Every screen here also exists in [`../../MerchantModule`](../../MerchantModule), which additionally has
> bulk product upload, courier orders, brand management, a four-screen warehouse module and product matching.
>
> **Build new merchant features in `MerchantModule`.** Read
> [../../FF_api_web/docs/reports/merchant-consolidation.md](../../FF_api_web/docs/reports/merchant-consolidation.md)
> before changing anything here.

There is deliberately **no `PRODUCT.md`, `DESIGN.md` or `docs/` mirror** in this repo: writing a full design
document for a codebase that may be retired is work that would be deleted. They will be written if the
consolidation is declined.

## What exists

| | |
|---|---|
| [../README.md](../README.md) | setup, commands, layout, **store identity — do not change the bundle ID** |
| [../AGENTS.md](../AGENTS.md) | rules for AI coding agents, and this repo's status |
| [../VERIFY.md](../VERIFY.md) | post-build verification — the alert on a **real Android device, locked** |
| [KNOWN-ISSUES.md](KNOWN-ISSUES.md) | problems that resisted three fix attempts |

## The merchant product definition

Shared with `MerchantModule`, documented there:

| | |
|---|---|
| [../../MerchantModule/PRODUCT.md](../../MerchantModule/PRODUCT.md) | what a merchant does, onboarding to payout |
| [../../MerchantModule/DESIGN.md](../../MerchantModule/DESIGN.md) | §7 has the Capacitor migration plan |

## Cross-repo

| | |
|---|---|
| [../../FF_api_web/docs/ecosystem/README.md](../../FF_api_web/docs/ecosystem/README.md) | IST, money, identity, the order lifecycle |
| [../../FF_api_web/docs/ecosystem/PRINCIPLES.md](../../FF_api_web/docs/ecosystem/PRINCIPLES.md) | the ten non-negotiables, git hooks, the 3-strike rule |
| [../../FF_api_web/docs/security-findings.md](../../FF_api_web/docs/security-findings.md) | **read first** |

## The things to know if you must work here

- **Bundle ID `com.shubhamexpo7.FlashFitsMerchantApp`** (Android + iOS) and EAS project
  `afb120d4-1db6-48f5-acf0-bdb195b2efd8`. Store listings are keyed to these. **Export the EAS Android
  keystore before any migration work.**
- **`appConfig.merchantAppVersion.storeUrlIos` points at the wrong bundle ID**, so the iOS force-update deep
  link is broken. `storeUrl` defaults to a GitHub APK URL, suggesting this app may be sideloaded rather than
  published on Play — verify before planning store work.
- **Backgrounded looping audio does not work on iOS.** `src/utils/alertManager.ts` sets
  `staysActiveInBackground: true`, but the OS suspends the app and the audio stops. The indefinite alarm is
  Android-and-foreground only — which is why the Capacitor migration loses far less than it appears to.
- `expo-av` is deprecated; `expo-file-system/legacy` is in use in two files.
- `src/app/explore.tsx` may be dead scaffold — confirm before relying on it.
