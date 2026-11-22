# VERIFY — MerchantApp (merchant mobile app — retirement candidate)

**The protocol is defined once, for every repo and every agent, in
[../FF_api_web/docs/ecosystem/VERIFY.md](../FF_api_web/docs/ecosystem/VERIFY.md). Read it.**
This file lists the flows *this* repo participates in, and the checks specific to it.

> A green test suite proves the code does what the test says. It does not prove the feature works.
> Run this after a feature build, **even when all tests pass**.

## The short version

0. **Preconditions** — lint clean, typecheck clean, all tests green, the feature's own tests genuinely fail
   when the feature is reverted, docs updated in the same commit.
1. **Name the flows** the change touches — including the ones you did *not* change but which share code
   (`grep` the callers; that is where regressions live).
2. **Walk each one as the user** — fresh account, real UI, real device, small screen, whole journey.
3. **Run the standing checklist** from the hub file: empty states, first-time user, boundaries, offline,
   backgrounding, double-tap, back button, API 500, money formatting, IST dates, cross-role consistency,
   access control.
4. **Capture evidence** — a screenshot or a response body per flow. "It should work" is not evidence.
5. **Verdict** — PASS (record it in `verify/<date>-<feature>.md`), FAIL (fix, re-run from step 0), or
   BLOCKED (see below).

## Flows owned by this repo

Same merchant flows as [MerchantModule](../MerchantModule/VERIFY.md) — M1–M12 — for the subset this app
implements. `MerchantModule` is the primary surface; see
[../FF_api_web/docs/reports/merchant-consolidation.md](../FF_api_web/docs/reports/merchant-consolidation.md).

Changes here should be bug fixes on the shipped build, so in practice you are verifying **the one flow you
fixed plus its siblings**, not the whole catalogue.

The full catalogue, including the cross-role flows, is in the hub file. **X1 — the whole Try & Buy journey
across all four roles — is run before any release.**

## Checks specific to this repo

- [ ] **The order alert on a real Android device with the screen locked.** The `order_alerts` channel uses
      `importance: MAX` and `bypassDnd: true`, neither of which can be verified on a simulator.
- [ ] **iOS: confirm what actually happens when backgrounded.** The looping audio stops because iOS suspends
      the app — do not report a working background alarm on iOS without seeing it.
- [ ] **The force-update gate** (`useAppUpdate` → `appConfig.merchantAppVersion`). Note the iOS store URL in
      `appConfig` points at the wrong bundle ID today.
- [ ] **Amounts match `MerchantModule`** for the same merchant and period. Two clients disagreeing about a
      payout is the clearest symptom of the duplication this repo represents.
- [ ] Every screen at a small device size.

## When something will not fix

Three genuine fix attempts on one specific failure and no further. Then: **stop**, revert the attempts,
record it in `docs/KNOWN-ISSUES.md` in the documented format, and tell the human the one decision or
credential that would unblock it.

A fourth attempt built on a wrong model of the problem is the one that breaks something adjacent.

## For non-Claude agents

Nothing here is Claude-specific. Claude Code has `/verify`; every other agent reads this file and the hub
file and executes the steps. If you have no device or browser, run what you can and report
**PARTIAL — manual device verification outstanding**, naming the flows a human must walk. Never report PASS
for a flow you could not execute.
