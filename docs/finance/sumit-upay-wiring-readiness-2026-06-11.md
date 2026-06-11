# SUMIT + UPay — Ready-to-Wire Spec (2026-06-11)

| | |
|---|---|
| **Status** | Research synthesis — implementation-ready EXCEPT 6 field-level UNKNOWNs to confirm with SUMIT/UPay (listed §6). NO live wiring yet (firewall in `sumit-upay-operating-model.md` §9 still stands). |
| **Purpose** | CEO 2026-06-11: "be ready as possible" — keys arriving from UPay soon. This is the spec to wire the moment they land. |
| **Companions** | `sumit-api-known-vs-assumed-2026-05-23.md` (endpoint inventory), `sumit-upay-operating-model.md` (firewall + roles), `platform-tax-360-2026-06.md` (VAT/disclosed-agent posture) |

## 0. The architecture correction that matters most

**UPay issues NO API key and NO developer credential.** SUMIT is the *only* integration surface. You always call `api.sumit.co.il` with SUMIT `Credentials { CompanyID, APIKey }`. UPay sits *behind* SUMIT as the acquiring/clearing licence (the SHVA terminal + merchant relationship). On UPay approval, clearing **auto-activates inside SUMIT** and the terminal number appears in SUMIT → Settings → סליקת אשראי.

→ **Do not wait for / ask UPay for an "API key."** The only UPay-produced values that ever touch our config are the **Full Merchant Number + MCC**, and those are needed only to turn on **3-D Secure** (entered into SUMIT settings, not called by our code). Source: help.sumit.co.il/he/articles/5832995, 5832830.

## 1. Endpoint payloads (PetWash-critical subset)

Common envelope on every call: `Credentials: { CompanyID, APIKey }`. Base `https://api.sumit.co.il`. Sandbox = a testing org (name must contain **בדיקות**) + test cards on the SAME endpoint — no sandbox subdomain.

- **`POST /billing/payments/charge/`** — one-time card charge. Body: `Credentials`, `Customer` (name/ID/email/phone → drives the fiscal doc), `Items[]` (become invoice lines), **`SingleUseToken`** (the `og-token` from the JS tokenizer — PCI-safe path). Response carries a transaction **`ID`** + SHVA `Result`. Exact response field names, installments field, `DocumentType`/`SendDocument` enums = UNKNOWN (Swagger).
- **`POST /billing/payments/multivendorcharge/`** — **marketplace split (our model)**. Auto-issues the invoice/receipt **in the vendor's name** per leg. Takes card/token + customer + items + the **Marketplace's own API key**. Vendor onboarding via `POST /website/companies/create/`. **Split/commission field shape = UNKNOWN — confirm before wiring (drives our data model).**
- **`POST /billing/payments/beginredirect/`** — hosted page / IFrame (zero card-form code). Returns to our `RedirectURL` with querystring `Valid` (0/1), `Result` (SHVA), `ID` (txn). Has a `TokenizeOnly` mode. **Always re-verify server-side via `GetTransaction` — the querystring is spoofable.** Request field names = UNKNOWN (Swagger).
- **JS tokenizer (PCI-safe, branded form):** include SUMIT Payments JS, `OfficeGuy.Payments.BindFormSubmit({ CompanyID, APIPublicKey })` on a `data-og="form"`; it injects `og-token`; POST that → server sends as `SingleUseToken`. **Two keys: public `APIPublicKey` (browser) vs secret `APIKey` (server).**
- **`POST /creditguy/vault/tokenizesingleuse/`** (single-use) and **`/tokenize/`** (reusable, for recurring).
- **`POST /triggers/triggers/subscribe/`** — webhooks. POSTs event to our HTTPS endpoint; **does NOT include cross-folder fields → must follow up with `GetTransaction`**. **Signature scheme = UNKNOWN — ask SUMIT;** until then secure with a secret-bearing URL + mandatory `GetTransaction` re-verification.

## 2. Marketplace recommendation (consumer → 15% platform / rest → station owner)

**Use `/billing/payments/multivendorcharge/`.** Purpose-built for our model; auto-issues the fiscal doc in the vendor's name per leg → aligns with the disclosed-agent VAT posture (each leg invoiced to the correct legal party — see tax 360 doc). Onboard each station owner / provider as a SUMIT sub-company via `/website/companies/create/` ("documents only" until they have their own clearing). **Confirm with SUMIT how the platform 15% is expressed (percentage / fixed / separate line) and whether it generates its own platform invoice** — this answer fixes our data model.

## 3. PCI / security recommendation

- **Never let the PAN hit our server.** Use the **JS tokenizer** for the in-app branded luxury flow + keep **`beginredirect`** as the link/fallback. Both keep us OUT of PCI scope (SUMIT hosted env is PCI-DSS L1). Raw server-to-server card POST = in-scope → forbidden.
- **3-D Secure:** ON for all web charges (SUMIT "Growth" plan+). Needs UPay's Full Merchant Number + MCC. Shifts chargeback liability to issuer.
- **Idempotency:** UNKNOWN if SUMIT honors a key — dedupe on our order id + persist returned txn `ID`; never blind-retry a charge whose outcome is unverified.
- **Webhook + redirect trust:** re-verify EVERY event server-side via `GetTransaction` before acting.

## 4. UPay activation checklist (CEO's job, no code)

Account is OPENED-not-ACTIVE. To activate: respond to UPay's SMS upload link with (a) holder photo ID, (b) business registration / bookkeeping approval, (c) bank-account verification. Fast-track ~3 business days if PetWash already holds a Cal/Isracard/Max/Cardcom supplier number. Can process before final approval but **payouts withheld** until verified. **UPay contact: 03-8008729 / upay.co.il/contact.**

**Ask UPay's activation team, in writing:**
1. Confirm account **ACTIVE** + payouts enabled.
2. **Terminal number** + **Full Merchant Number + MCC** (for 3DS).
3. **MDR/commission** (advertised 0.9%+VAT for new merchants — get in writing) + **payout/settlement cycle**.
4. Which rails enabled: **Bit, card-present, payment links, digital cheque**.
5. Anything UPay-side to toggle for **marketplace/multivendor** clearing.

## 5. Ready-to-wire checklist + env vars

1. Create SUMIT testing org ("…- בדיקות") + test terminal. Pull `CompanyID`, server `APIKey`, browser `APIPublicKey`.
2. Implement JS tokenizer → `SingleUseToken`.
3. Wire `/charge/` then `/multivendorcharge/` (confirm split fields first).
4. Onboard a test station owner via `/website/companies/create/`; verify per-leg invoice in vendor's name.
5. Register `/triggers/.../subscribe/` webhook + `GetTransaction` re-verify (ask SUMIT for signature scheme).
6. Test with SUMIT test card **`4580 4580 4580 4580`, exp 12/2026, CVV 123**; verify docs via `getpdf`.
7. Switch to production org + activated UPay terminal; enable 3DS (Full Merchant Number + MCC); flip env to live.

```
SUMIT_API_BASE_URL=https://api.sumit.co.il
SUMIT_COMPANY_ID=
SUMIT_API_KEY=                  # server secret
SUMIT_API_PUBLIC_KEY=           # browser tokenizer (NEW — not yet in our env)
SUMIT_MARKETPLACE_API_KEY=      # platform key for multivendorcharge (confirm if distinct)
SUMIT_WEBHOOK_SHARED_SECRET=    # our own until SUMIT confirms a signing scheme
SUMIT_ENABLE_3DS=true
SUMIT_ENABLED=true              # the on-switch (currently absent → client returns wired:false)
# NO UPAY_* API credentials exist. For 3DS config only (entered in SUMIT, not called by code):
#   UPAY_FULL_MERCHANT_NUMBER, UPAY_MCC
```

## 6. Open questions to send SUMIT/UPay (the only blockers to a clean build)
1. `multivendorcharge` split/commission field structure + does platform 15% get its own invoice leg.
2. Webhook signature verification scheme (header + secret + algorithm), if any.
3. Idempotency-key support on `charge`/`multivendorcharge`.
4. `charge` response object field names + `DocumentType`/`SendDocument` enum values.
5. `beginredirect` request field names (amount, doc type, success/fail URLs, external id).
6. UPay: ACTIVE confirmation, terminal + Full Merchant Number + MCC, MDR in writing, payout cycle, Bit/marketplace enablement.

## 7. What gets built when keys land (the PR plan, pending firewall approval)
- PR-PAY-1: `SumitClient` charge + tokenize methods (flag-off no-op until `SUMIT_ENABLED`, same pattern as existing `createDocument`).
- PR-PAY-2: JS tokenizer in the shop checkout + eGift; wire `PaymentGatewayService` UPay/SUMIT branch (replace the current `throw`).
- PR-PAY-3: `multivendorcharge` for marketplace bookings (after split-config answer).
- PR-PAY-4: webhook receiver + `GetTransaction` re-verification + fiscal-doc linkage.
- Each gated, sandbox-first, money-domain approval per operating-model §9/§11.

**Sources:** help.sumit.co.il articles 5833033 (charge), 5832873 (marketplace), 5893615 (JS API), 5840939 (test cards), 10257999 (3DS), 11577644 (webhook), 5832995 (UPay join), 5832830 (terminal); app.sumit.co.il/help/developers/redirectapi/ + swagger; upay.co.il.
