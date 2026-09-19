# Turning on Google Wallet passes (Android / Galaxy)

**Status: NOT LIVE. Two separate blockers, one now fixed in code.**

Apple `.pkpass` files cannot be installed on Android at all — Google Wallet is a
different standard. Android has never worked, and could not have.

Verified against Google's own documentation on 2026-09-19
(developers.google.com/wallet/generic, pages last updated 2026-09-16).

## Blocker 1 — the token was never signed (FIXED)

`server/googleWallet.ts` returned `base64url(JSON.stringify(claims))` in five
places, commented *"Google Wallet will sign it"*. That is wrong. Google's
prerequisites say plainly:

> Sign your JWT with your Google Cloud service account key

and the save link is `https://pay.google.com/gp/v/save/<signed_jwt>`. Google
**verifies** your signature; it never produces one. An unsigned payload is
rejected. Now signed RS256 with the service-account key.

## Blocker 2 — no credentials exist (NEEDS THE CEO)

`GOOGLE_WALLET_ISSUER_ID` and `GOOGLE_WALLET_SERVICE_ACCOUNT` appear **zero**
times anywhere in `.github/`. Nothing to sign with.

### What to obtain

1. **A Google Wallet API Issuer account.**
   Go to the Google Pay & Wallet Console, sign in with the Google account that
   should own it, give the public business name (פט וואש בע"מ), accept the
   Google Wallet API terms, then *Create a pass* → *Build your first pass*.
   You end up on the Google Wallet API Dashboard holding an **Issuer ID**
   (a long number).

2. **A Google Cloud service account + JSON key**, in the same project, with the
   Google Wallet API enabled. Download the key file.

3. **Authorise the service account** in the Wallet Console so it may issue
   passes for that Issuer ID.

### Where each piece goes

| Secret | Value |
|---|---|
| `GOOGLE_WALLET_ISSUER_ID` | the Issuer ID number from the dashboard |
| `GOOGLE_WALLET_SERVICE_ACCOUNT` | the **whole contents** of the service-account JSON key file (raw JSON, or base64 of it — the code accepts either, because a multi-line private key often does not survive a secrets field) |

`GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL` is optional; the email is read from the
JSON so the two cannot disagree.

Bind them the same way every other production secret is bound, and nothing
else needs changing — the code reads them the moment they exist.

## Two things to expect, so they are not mistaken for bugs

- **Every pass will say "[TEST ONLY]" in its title** until Google grants
  publishing access. New issuer accounts start in demo mode, and in demo mode
  passes can only be saved by accounts holding the Admin or Developer role, or
  added as test accounts. Request publishing access from the dashboard.
- **The save link dies past ~1800 characters.** Google truncates it and the
  save silently does nothing — no error for the customer, nothing in our logs.
  The signer now logs a warning when a token crosses that line.

## What is NOT covered here

Apple passes. Those are fixed separately in #2638 — the booking, gift-card and
CEO passes were reading the signing certificates under environment names nobody
had set, so the server refused to build a pass at all.
