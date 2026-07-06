# Kfar Saba prepaid-QR wash — the 100% go-live plan (2026-07-06)

Synthesis of a full agent sweep: the complete Nayax Cortina spec, our integration
code, and the actual mobile redeem UX. This is the source of truth.

## The one thing that was confusing us: THREE separate QR paths exist

| Path | What it does | Verdict |
|------|--------------|---------|
| **A. `/wallet/redeem` (K9000Redeem.tsx)** | App *generates* a `signedRedeemToken` QR for a kiosk to scan → `/api/k9000/redeem-wash` → `START_PUMP` | **DEAD END.** Assumes PetWash firmware on the bay. The K9000 is Nayax-MDB with **no native API**; the LAN command is also SSRF-blocked. Self-aware "Demo Mode" banner. Do NOT rely on it. |
| **B. Cortina inbound (`server/routes/nayax-cortina.ts`)** | Customer shows app QR at the bay's Nayax **QR reader** → Nayax posts to our webhook → we verify prepaid credit → approve → **Nayax** starts the vend. Card never charged. | ✅ **THE correct rail.** Code-complete, money-safe, DARK. |
| **C. Outbound Start (`NayaxCortinaClient.startStaticQr`)** | App *scans the bay's* Monyx QR (device id) → our backend calls Nayax `/start`. | Built, alt model (app-scans-bay). Not needed if the bays have QR readers (Model B). |

**For Kfar Saba the correct rail is B** — the machines have QR readers (`nayaxQrReaderId`),
so the customer **shows their PetWash pass QR and the bay reads it**. No app camera needed.

## The critical code finding: TOKEN MISMATCH (app-side, fixable by us)

- Cortina inbound verifies the scanned `Code` with **`verifyPassLinkToken`** (`server/lib/passTokens.ts`).
- The customer's **Apple/Google wallet pass QR is already built with `buildPassLinkToken`**
  (`server/routes/pass-universal.ts`, `prestige-pass.ts`) → **Cortina-compatible.** ✅
- BUT the in-app `/wallet/redeem` screen mints a **different** token (`signedRedeemToken`,
  for the dead Path A). If a customer uses that screen at a Cortina bay, it declines.

**Implication (the good news):** the app side is essentially **already done** — the customer
just presents their existing **PetWash wallet pass QR** at the bay reader. The only app work
is to stop pointing customers at the Path-A demo screen and point them at the wallet-pass QR.

## Money safety — VERIFIED sound (server/routes/nayax-cortina.ts)

Reserve-then-commit (TCC), exactly-once:
- **Authorize/Sale:** verify credit (`pickRedemptionType`) → reserve with two partial-unique
  indexes (one reserved per bay, one per user+station) → approve. No debit. Double-scan
  impossible at DB level.
- **Settlement/SaleEnd:** replay-guard on `terminalId+transactionId`; if committed → approve,
  no re-debit; else atomic reserved→committed → `authorizeRedemption` debits once; on debit
  failure roll back + decline.
- **Void/Cancel:** release reserve; committed → reconciliation-break row (refund rail gap).
- **One edge to pin:** the replay key falls back to the pass-link token when Nayax omits
  `transactionId`. Confirm on the FIRST live sandbox payload that `transactionId` is always
  present (StaticQR spec sends it); if ever absent, a same-user/same-bay second wash within
  the token TTL could be mis-flagged as a replay. Low risk, verify then relax.

## Decline codes — confirmed against the Nayax StaticQR table

1 insufficient funds · 2 txn id unknown · 5 fraud · 6 general fail · 8 parse · 20 no VPN/MQTT ·
30 machine not responding · 50 unknown machine · 990/991/1010 cert/cipher · 992 timeout ·
996 dup txn · 997 missing params · 999 general. Our handlers use 1/2/6/50/992/999 correctly.

## What blocks go-live — split honestly

### External / self-serve (YOURS — devzone.nayax.com + MoMa). The real blockers.
1. **Register PetWash as a Cortina payment method** → get **payment-method name + SecretToken**
   (sandbox first). This is `OnboardActor` / the portal — no integrator engineer.
2. **Per bay: enable "PreSelection = Yes"** (or PreAuthorization) + confirm the **QR reader**
   is active on each Kfar Saba virtual machine; set "QR" as an Idle Mode Screen.
3. **Each bay's TerminalId** (from `OnboardMachine` / the portal) — to map bay ↔ terminal.
4. **Fix LEFT machine (182462) currency USD → ILS.** 30 seconds, must-do.

### Our code (ME — mostly done; small items left)
1. ✅ Cortina inbound + outbound + AES handshake + money safety — DONE (#1298 merged).
2. **Point the app's redeem UX at the wallet-pass (pass-link) QR**, not `signedRedeemToken`.
   (Align/retire the Path-A demo screen so no customer is sent to a dead rail.)
3. **Map the 2 bays** in `station_bays` (`nayaxTerminalId` + `nayaxQrReaderId`) — ready to
   apply the moment we have TerminalIds. Known identifiers: RIGHT 182443/369617593,
   LEFT 182462/188843334 (map both numbers per bay so `resolveBay` matches either).
4. **Pin the `transactionId` idempotency edge** with a source test.
5. Config staging: `NAYAX_CORTINA_*` in QA sandbox, flip `ENABLED` last.

## Go-live sequence (once you paste payment-method name + SecretToken)
1. I run `OnboardMachine` (or use portal TerminalIds) → get each bay's TerminalId/QrString.
2. Map both bays; stage `NAYAX_CORTINA_*` in QA sandbox; flip `NAYAX_CORTINA_ENABLED=true`.
3. Load a test wallet with a wash-package credit; show its pass QR at the bay reader.
4. Confirm: reserve → approve → vend → settlement debits once. Test declines (no credit=1,
   wrong bay=50). Capture the first live payload; verify `transactionId` present.
5. Flip `NAYAX_CORTINA_SANDBOX=false` + prod base URL → live.
