# PetWash — iOS apps + Wallet pass runbook (2026-06-15)

Plain-English, step-by-step. Two separate jobs that people keep conflating:
**(A)** build the two iPhone apps in Xcode, and **(B)** make the Royal-Tier card
installable into the phone's Apple/Google **Wallet**. Plus a note on the **two
different "wallets"** so nobody mixes them up.

> Everything below is **operator/CEO work** (Mac + your Apple/Google/Firebase
> accounts). The *code* is already in the repo — these are the accounts, certs,
> and env values only you can provide. None of it can be done from inside the
> codebase.

---

## 0. The two "wallets" — do not confuse them
1. **Money wallet** — the customer's balance (cash credit, eGift, loyalty,
   wash-packages). Lives in the DB (`walletAccounts`), shown via
   `/api/credit-wallet/summary`. The card's "STORED CREDIT ₪0" is this.
2. **Device Wallet pass** — the Royal-Tier card itself, added to the iPhone's
   **Apple Wallet** app (or Google Wallet). It carries the **Member/Pass ID**
   (e.g. `pass-founder-001c-f8f9e9fc`) + a signed QR ("Scan to identify").

This runbook's **§B** is about #2 (the device pass). #1 needs no Xcode/cert work.

---

## A. Build & run the two iOS apps in Xcode

**The apps**
| App | Folder | Bundle ID |
|---|---|---|
| Customer | `ios-customer/App` | `com.petwash.il` |
| Provider | `ios/App` | `il.co.petwash.provider` |

**Prerequisites (one time)**
- A Mac with **Xcode** installed.
- An **Apple Developer Program** membership ($99/yr) — for signing + TestFlight.
- Node + repo installed (`npm install`).
- **Firebase iOS config** for each bundle id (see step 3 — without it the app
  crashes on launch).

**Build steps — do these per app (customer shown; swap `customer`→`provider`)**
1. Build the web bundle and sync it into the native shell:
   ```
   npm run build
   npm run cap:customer:sync
   ```
   (This swaps in `config/capacitor/customer.config.ts` automatically via
   `scripts/mobile/run-capacitor-app.mjs`.)
2. Open the native project in Xcode:
   ```
   npm run cap:customer:open:ios
   ```
3. **Add Firebase config (critical — app crashes without it):**
   - Firebase Console → Project settings → add an **iOS app** for bundle
     `com.petwash.il` → download **`GoogleService-Info.plist`**.
   - Drag it into Xcode under `App/App/` (check "Copy items if needed").
   - Repeat with a **separate** iOS app for `il.co.petwash.provider` →
     its own `GoogleService-Info.plist` into `ios/App/App/`.
4. **Signing:** Xcode → target **App** → *Signing & Capabilities* → check
   *Automatically manage signing* → pick your **Team**. Xcode provisions it.
5. **Run:**
   - Simulator: pick a simulator, press ▶ (no signing needed).
   - Real iPhone: plug in, select it, press ▶ (needs step 4).
6. **Ship to TestFlight:** Xcode → *Product → Archive* → *Distribute App* →
   *App Store Connect* → *Upload*. It appears in TestFlight after processing.

**Known blockers (all operator-side, not code):**
- `GoogleService-Info.plist` missing → app crashes at launch. (Step 3.)
- No distribution cert / provisioning profile → archive fails. (Apple Developer.)
- App Store rule **4.8**: if the app shows Google sign-in, it must also offer
  **native Sign in with Apple**. Native Apple sign-in is **not built yet**
  (~a few days of work) — can cause App Store rejection.

---

## B. The "Wallet ID" — getting the Royal-Tier card into Apple/Google Wallet

**Status: the code is built; it is blocked on certificates + env values.**

The backend already generates the pass:
- In-app/web card: `GET /api/pass/:token`
- **Apple Wallet `.pkpass`**: `GET /api/pass/apple/:token` (`server/appleWallet.ts`)
- **Google Wallet**: `GET /api/pass/google/:token` (`server/googleWallet.ts`)

Today, `/api/pass/apple/:token` throws **"Apple Wallet certificates not
configured"** until you provide the cert/env below — so the card shows *in the
app* but won't "Add to Apple Wallet."

### B1 — Apple Wallet (the "Pass Type ID" = the wallet id)
1. developer.apple.com → **Certificates, Identifiers & Profiles → Identifiers →
   Pass Type IDs** → create one, e.g. **`pass.com.petwash.vip`**. *This is the
   "wallet id."*
2. Generate that Pass Type ID's **certificate**; export from Keychain as a
   `.p12`; split into the **signer cert** and **signer key**.
3. Download the **Apple WWDR** certificate.
4. Set these env vars on the server (Cloud Run secrets):
   - `APPLE_PASS_TYPE_ID` = `pass.com.petwash.vip`
   - `APPLE_TEAM_ID` = your Apple Team ID
   - `APPLE_WWDR_CERT`, `APPLE_SIGNER_CERT`, `APPLE_SIGNER_KEY`
   - `APPLE_KEY_PASSPHRASE` (if the key has one)
5. (Optional, for live pass updates/push) `APPLE_APNS_KEY`, `APPLE_APNS_KEY_ID`.

Once set, the card's "Add to Apple Wallet" works and signs a real `.pkpass`.

### B2 — Google Wallet
Set: `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT` (+
`GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`) from the Google Wallet Console /
a service account. Until set, the Google pass route returns not-configured.

### B3 — Pass identity / secrets (already required elsewhere)
The signed QR uses `PRESTIGE_QR_SECRET` / `PASS_LINK_SECRET` (min 16 chars).
These should already be set (the in-app QR works); the Apple/Google steps above
are the only *additional* secrets for device-Wallet install.

---

## C. Quick checklist (hand this to whoever has the Mac + accounts)
- [ ] Apple Developer membership active
- [ ] Firebase iOS app + `GoogleService-Info.plist` for **both** bundle ids
- [ ] `npm run build && npm run cap:customer:sync && npm run cap:customer:open:ios`
- [ ] same for `provider`
- [ ] Xcode signing Team selected; runs on a device
- [ ] (Wallet) Pass Type ID `pass.com.petwash.vip` created + certs exported
- [ ] (Wallet) `APPLE_*` pass env vars set on the server
- [ ] (Wallet, optional) Google Wallet issuer + service account set
- [ ] Decide on native Sign in with Apple before App Store submit (rule 4.8)

*Code references: `ios-customer/App`, `ios/App`, `config/capacitor/*.config.ts`,
`scripts/mobile/run-capacitor-app.mjs`, `server/appleWallet.ts`,
`server/googleWallet.ts`, `server/routes/pass-universal.ts`,
`server/lib/passTokens.ts`.*
