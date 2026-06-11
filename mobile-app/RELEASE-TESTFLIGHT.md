# PetWash Staff app → TestFlight — operator runbook

**Status (2026-06-11):** Apple credentials WIRED in `eas.json` (ASC API key DZ68Q258JX,
issuer f8d9…b365, team U22NC3Q5Z4 — all non-secret IDs). The `.p8` private key is NOT
in this repo and never should be. The pipeline is NOT yet active — `eas init` has never
run (no Expo project linked). Below is the exact sequence to go live.

## What's already done (in code)
- `eas.json` → `submit.production.ios` carries the ASC API key ID + issuer + team ID.
- `.gitignore` blocks `*.p8` and the Play service-account from ever being committed.
- Bundle id `il.co.petwash.staff`, slug `petwash-staff` (in `app.json`).

## Prerequisites only YOU can do (need your login on your Mac)
1. **Expo account** — sign up at https://expo.dev (free tier exists; iOS production
   builds consume build-minutes — check current free allowance before relying on it).
2. The `.p8` file you downloaded from App Store Connect (`AuthKey_DZ68Q258JX.p8`),
   sitting in your Downloads. **Do not open or paste it.**

## The sequence (run from `mobile-app/`)
```bash
cd mobile-app
npm install                         # if not already
npx eas-cli login                   # your Expo account
npx eas-cli init                    # creates the project → fills owner + projectId in app.json
                                    #   COMMIT that app.json change (those values are not secret)

# Upload the ASC API key ONCE — it goes encrypted to Expo's servers, never the repo:
npx eas-cli credentials             #   → iOS → App Store Connect API Key → "Add new"
                                    #   → point it at ~/Downloads/AuthKey_DZ68Q258JX.p8
                                    #   → Key ID DZ68Q258JX, Issuer f8d92710-0d49-42f2-876b-d400bb6b3365

# Build + submit:
npx eas-cli build  -p ios --profile production
npx eas-cli submit -p ios --profile production
```
- First `submit` will offer to **create the App Store Connect app record** for
  `il.co.petwash.staff` (your Apps list is currently empty) — say yes; that produces the
  `ascAppId` automatically, no manual step.
- After submit, the build appears in **App Store Connect → your app → TestFlight** in
  ~5–15 min (Apple processing). Add yourself as an internal tester to install on your phone.

## After the .p8 is uploaded to EAS
Delete the local copy — it now lives encrypted on Expo:
```bash
rm ~/Downloads/AuthKey_DZ68Q258JX.p8
```
If the key is ever exposed: App Store Connect → Users and Access → Integrations →
revoke + regenerate (30 seconds). The IDs in `eas.json` are not secret; the `.p8` is.

## Honest cost note
EAS iOS production builds use Expo build-minutes. Free tier is limited and may queue;
heavy/parallel use is paid. If budget is tight this week, the web app already works on
phones — the native TestFlight app is additive, not a launch blocker. Do this when there's
build budget.
