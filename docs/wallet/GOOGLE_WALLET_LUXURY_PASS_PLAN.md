# PetWash Google Wallet Luxury Pass Plan

Apple Wallet uses `.pkpass`.
Google Wallet uses a Google Wallet issuer, class, object, and JWT save link.

## Safe Launch Shape

1. Apple Wallet founder pass first.
2. Google Wallet loyalty pass second.
3. Mobile web membership card fallback for Android/Galaxy until issuer approval is confirmed.

## Required Server Env Names

- `GOOGLE_WALLET_ISSUER_ID`
- `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_SECRET`
- `GOOGLE_WALLET_CLASS_ID`

The service account JSON must stay in Secret Manager or another server-side secret store. It must never be committed, logged, shown in the browser, or pasted into chat.

## Member Pass Data

- member name
- membership number
- tier
- pet name
- status
- QR/barcode value generated server-side
- support link
- website link

## Rules

- No fake pass if Google Wallet issuer config is missing.
- No fake balance, fake tier, or fake QR.
- No pass for unverified users.
- No provider/staff pass mixed with customer membership pass.
- Every save link should be short-lived or signed server-side.

## Fallback

Until Google Wallet is fully approved, Android users should see a mobile web membership card with the same verified data and QR, but without pretending it is a Google Wallet pass.
