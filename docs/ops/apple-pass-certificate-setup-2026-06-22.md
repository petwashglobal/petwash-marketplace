# Apple Wallet Pass Certificate — Setup Recipe (Ops)

**Goal:** produce the 4 server secrets that let the PetWash app sign `.pkpass` files, so the
"Add to Apple Wallet" button on the member pass goes live.

**Pass Type ID:** `pass.il.petwash.prestige`
**Apple account:** Pet Wash Ltd (developer.apple.com)
**Status:** the in-app pass at `/prestige-pass` already works WITHOUT this. This is only for the
native Apple Wallet `.pkpass` download.

---

## Part 1 — Create the certificate (must be done by the account owner; touches the private key)

These five steps must be performed by hand on a Mac signed into the Apple Developer account,
because step 5 exports a **private key**. No automation/agent can or should do this.

1. Open: `https://developer.apple.com/account/resources/identifiers/list/passTypeId`

2. Click the blue **➕** → choose **Pass Type IDs** →
   - **Description:** `PetWash Prestige Pass`
   - **Identifier:** `pass.il.petwash.prestige`
   → **Continue** → **Register**

3. Click into the new Pass Type ID → **Create Certificate**. It asks for a **CSR** file.
   Make one in **Keychain Access**:
   - Menu: **Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority**
   - Enter your email; **CA Email Address: leave blank**; select **Saved to disk** → **Continue**
   - Save the `.certSigningRequest` file.

4. Back in the browser: **Choose File** → select the CSR → **Continue** → **Download** the `.cer`.

5. **Double-click the `.cer`** to install it into Keychain. Then in Keychain Access find the entry
   **"Pass Type ID: pass.il.petwash.prestige"**, expand it, right-click → **Export** →
   save as **`pass.p12`** and set a password. Keep the password.

You now have: `pass.p12` + its password.

---

## Part 2 — Convert to the 4 server secrets (ops, on any machine with openssl)

The app reads four environment values. Produce them from `pass.p12`:

### `APPLE_SIGNER_CERT_PEM` — the pass signing certificate
```bash
openssl pkcs12 -in pass.p12 -clcerts -nokeys -out signerCert.pem -passin pass:THE_P12_PASSWORD
```

### `APPLE_SIGNER_KEY_PEM` — the pass signing private key
```bash
openssl pkcs12 -in pass.p12 -nocerts -nodes -out signerKey.pem -passin pass:THE_P12_PASSWORD
```
(`-nodes` outputs an unencrypted key; store it only in the secret manager, never in git.)

### `APPLE_WWDR_PEM` — Apple's Worldwide Developer Relations intermediate cert
```bash
curl -o AppleWWDRCAG4.cer https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
```

### `APPLE_TEAM_IDENTIFIER` — the 10-character Team ID
Find it at `https://developer.apple.com/account` → **Membership details** → **Team ID**
(e.g. `ABCDE12345`).

---

## Part 3 — Install the secrets

Set these on the API service (Cloud Run / secret manager — NOT in git):

| Secret | Value |
|---|---|
| `APPLE_TEAM_IDENTIFIER` | the 10-char Team ID |
| `APPLE_WWDR_PEM` | contents of `wwdr.pem` |
| `APPLE_SIGNER_CERT_PEM` | contents of `signerCert.pem` |
| `APPLE_SIGNER_KEY_PEM` | contents of `signerKey.pem` |

Redeploy. The pass type id `pass.il.petwash.prestige` is already wired in
`AppleWalletService.ts`; once the four secrets resolve, the "Add to Apple Wallet"
button stops returning the not-configured error and signs real passes.

---

## Security notes

- `pass.p12` and `signerKey.pem` are **private keys**. Never commit them, never email them in
  plaintext, never put them in a ticket body. Hand them over via the secret manager only.
- The `.cer` and `wwdr.pem` are public certs — safe to share.
- If the private key is ever exposed, **revoke** the Pass Type ID certificate in the Apple
  Developer portal and repeat Part 1.
