# PetWash Founder Pass - Simple Steps

Apple Wallet pass is not the App Store app.

Apple Wallet pass = `first-founder-pass.pkpass`.
The iPhone app icon = the Xcode app shell icon.
Google Wallet / Android pass = separate Google Wallet issuer setup.

## Open The Founder Pass

```bash
cd ~/Documents/GitHub/petwash-marketplace
open first-founder-pass.pkpass
```

Or:

```bash
./scripts/pass/open-founder-pass.sh
```

If the pass is missing:

```bash
./scripts/pass/regenerate-founder-pass.sh
```

The regenerate script is pass-only. It writes `first-founder-pass.pkpass` and does not write to the database, SUMIT, bank, or payments.

## Rebuild The Luxury Artwork

The Apple Wallet pass model uses the black/gold Prestige artwork and the Xcode PetWash app icon. To rebuild those Wallet image assets:

```bash
npm run pass:images:prepare
npm run pass:founder:generate
```

This writes images into `wallet/apple-model.pass/` and regenerates `first-founder-pass.pkpass`. It does not print secrets and does not call SUMIT, bank, or payments.

## Put It On iPhone

- AirDrop `first-founder-pass.pkpass` to iPhone.
- Email it to yourself as an attachment.
- Put it in iCloud Drive and open it on iPhone.

## Safety

- Do not commit `.pkpass` files.
- Do not commit `.env`, Apple certificates, private keys, passphrases, or Secret Manager values.
- If signing config is missing, the script must fail instead of making an unsigned or fake pass.

## Google Wallet / Android

Android does not use `.pkpass` by default. Google Wallet needs server-side issuer setup:

- `GOOGLE_WALLET_ISSUER_ID`
- `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_SECRET`
- `GOOGLE_WALLET_CLASS_ID`

No Google service account JSON should be committed or pasted into chat.
